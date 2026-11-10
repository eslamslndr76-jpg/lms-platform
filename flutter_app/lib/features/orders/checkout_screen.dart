import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';
import '../../core/cart/cart_provider.dart';
import '../../core/orders/orders_provider.dart';

/// إتمام الشراء (المرحلة 11).
///
/// خطوات بمؤشر تقدم:
/// 1) مراجعة الطلب — الكورسات والمبلغ من السيرفر.
/// 2) بيانات ناقصة — تُعرض فقط إن أرجع `checkout-requirements` حقولاً ناقصة.
/// 3) تأكيد الحجز — ينشئ الطلب ويعرض رقمه، وتُفرَّغ السلة.
/// 4) الدفع — طرق الدفع من API. رقمي: إيصال + رقم هاتف. كاش: رقم الحجز + تعليمات الخزنة، بلا إيصال.
class CheckoutScreen extends StatefulWidget {
  /// معرفات الكورسات المراد حجزها (من السلة أو "اشترِ الآن").
  final List<int> courseIds;
  /// إذا تم تمريره، الشاشة تفتح في وضع "دفع طلب موجود" بدلاً من إنشاء طلب جديد.
  final int? existingOrderId;

  const CheckoutScreen({
    super.key,
    required this.courseIds,
    this.existingOrderId,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

enum _CheckoutStep { review, missing, confirm, pay, done }

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _api = ApiClient();

  _CheckoutStep _step = _CheckoutStep.review;
  bool _isLoading = false;
  String? _error;

  // Review
  List<Map<String, dynamic>> _reviewItems = [];
  double _total = 0;

  // Missing fields
  List<Map<String, dynamic>> _missingFields = [];
  final Map<String, TextEditingController> _missingCtrls = {};

  // Confirm
  int? _newOrderId;
  final String _newOrderStatus = 'pending';

  // Pay
  List<Map<String, dynamic>> _paymentMethods = [];
  Map<String, dynamic>? _selectedMethod;
  final _senderPhoneCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  File? _receiptFile;
  String _receiptBase64 = '';

  bool get _isDigital =>
      (_selectedMethod ?? {})['kind'] == 'digital';

  @override
  void initState() {
    super.initState();
    _loadReview();
    if (widget.existingOrderId != null) {
      _step = _CheckoutStep.pay;
      _loadPaymentMethods();
    } else {
      _checkMissingFields();
    }
  }

  @override
  void dispose() {
    _senderPhoneCtrl.dispose();
    _noteCtrl.dispose();
    for (final c in _missingCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  // ── Step 1: Review ─────────────────────────────────────────────────────────
  Future<void> _loadReview() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final cart = context.read<CartProvider>();
      await cart.fetchCart(silent: true);
      final items = cart.items.where((i) => widget.courseIds.contains(i.courseId)).toList();
      if (!mounted) return;
      setState(() {
        _reviewItems = items
            .map((i) => {
                  'course_id': i.courseId,
                  'title_ar': i.titleAr,
                  'price': i.price,
                })
            .toList();
        _total = cart.total;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'فشل تحميل تفاصيل الطلب';
      });
    }
  }

  // ── Step 2: Missing fields ─────────────────────────────────────────────────
  Future<void> _checkMissingFields() async {
    final req = await context.read<OrdersProvider>().checkoutRequirements();
    if (!mounted) return;
    if (req == null || req.isEmpty) {
      setState(() => _step = _CheckoutStep.confirm);
      return;
    }
    setState(() {
      _missingFields = List<Map<String, dynamic>>.from(req);
      for (final f in _missingFields) {
        final key = f['key'];
        if (key is String && !_missingCtrls.containsKey(key)) {
          _missingCtrls[key] = TextEditingController();
        }
      }
      _step = _CheckoutStep.missing;
    });
  }

  // ── Step 3: Confirm order ──────────────────────────────────────────────────
  Future<void> _confirmOrder() async {
    final missingAnswers = <String, dynamic>{};
    for (final entry in _missingCtrls.entries) {
      missingAnswers[entry.key] = entry.value.text.trim();
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final orders = context.read<OrdersProvider>();
      if (missingAnswers.isNotEmpty) {
        await _api.put(ApiConstants.updateProfile, data: missingAnswers);
        if (!mounted) return;
      }

      final newId = await orders.createOrder(
        courseIds: widget.courseIds,
        noteStudent: _noteCtrl.text.trim().isEmpty
            ? null
            : _noteCtrl.text.trim(),
        senderPhone: _senderPhoneCtrl.text.trim().isEmpty
            ? null
            : _senderPhoneCtrl.text.trim(),
      );

      if (!mounted) return;
      if (newId != null) {
        setState(() {
          _newOrderId = newId;
          _step = _CheckoutStep.done;
        });
        await context.read<CartProvider>().fetchCart(silent: true);
      } else {
        setState(() {
          _isLoading = false;
          _error = 'فشل إنشاء الحجز، حاول مرة أخرى';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  // ── Step 4: Payment ────────────────────────────────────────────────────────
  Future<void> _loadPaymentMethods() async {
    final methods = await context.read<OrdersProvider>().paymentMethods();
    if (!mounted) return;
      setState(() {
        _paymentMethods = methods ?? [];
        if (_paymentMethods.isNotEmpty) {
          _selectedMethod = _paymentMethods.first;
        }
      });
  }

  Future<void> _pickReceipt(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: source,
      maxWidth: 800,
      imageQuality: 70,
    );
    if (picked == null || !mounted) return;
    final file = File(picked.path);
    final bytes = file.readAsBytesSync();
    setState(() {
      _receiptFile = file;
      _receiptBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
    });
  }

  Future<void> _pay() async {
    if (_selectedMethod == null) {
      setState(() => _error = 'يرجى اختيار طريقة الدفع');
      return;
    }
    final method = _selectedMethod!['key'] as String?;
    if (method == null) {
      setState(() => _error = 'طريقة الدفع غير صالحة');
      return;
    }

    if (_isDigital) {
      if (_receiptBase64.isEmpty) {
        setState(() => _error = 'يرجى إرفاق صورة الإيصال');
        return;
      }
      if (_senderPhoneCtrl.text.trim().isEmpty) {
        setState(() => _error = 'يرجى إدخال رقم هاتف المحوِّل');
        return;
      }
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final orderId = widget.existingOrderId ?? _newOrderId;
    if (orderId == null) {
      setState(() {
        _isLoading = false;
        _error = 'معرف الطلب غير موجود';
      });
      return;
    }

    try {
      await context.read<OrdersProvider>().payOrder(
            orderId: orderId,
            method: method,
            senderPhone: _isDigital
                ? _senderPhoneCtrl.text.trim()
                : null,
            receiptUrl: _isDigital ? _receiptBase64 : null,
            noteStudent: _noteCtrl.text.trim().isEmpty
                ? null
                : _noteCtrl.text.trim(),
          );
      if (!mounted) return;
      setState(() {
        _step = _CheckoutStep.done;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _reload() async {
    setState(() {
      _error = null;
      _isLoading = false;
    });
    if (widget.existingOrderId != null) {
      _loadPaymentMethods();
    } else {
      switch (_step) {
        case _CheckoutStep.review:
          _loadReview();
        case _CheckoutStep.missing:
          _checkMissingFields();
        case _CheckoutStep.confirm:
          setState(() => _step = _CheckoutStep.confirm);
        case _CheckoutStep.pay:
          _loadPaymentMethods();
        case _CheckoutStep.done:
          break;
      }
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existingOrderId != null ? 'دفع الطلب' : 'إتمام الشراء'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _reload)
              : _step == _CheckoutStep.done
                  ? _DoneView(
                      orderId: widget.existingOrderId ?? _newOrderId,
                      status: _newOrderStatus,
                      onClose: () => Navigator.of(context).pop(true),
                    )
                  : Column(
                      children: [
                        _StepIndicator(step: _step),
                        Expanded(child: _buildBody(cs, tt)),
                        _buildBottomBar(cs),
                      ],
                    ),
    );
  }

  Widget _buildBody(ColorScheme cs, TextTheme tt) {
    switch (_step) {
      case _CheckoutStep.review:
        return _ReviewBody(items: _reviewItems, total: _total, error: _error);
      case _CheckoutStep.missing:
        return _MissingFieldsBody(
          fields: _missingFields,
          ctrls: _missingCtrls,
          error: _error,
        );
      case _CheckoutStep.confirm:
        return _ConfirmBody(items: _reviewItems, total: _total, error: _error);
      case _CheckoutStep.pay:
        return _PayBody(
          methods: _paymentMethods,
          selected: _selectedMethod,
          onSelect: (m) => setState(() => _selectedMethod = m),
          senderPhoneCtrl: _senderPhoneCtrl,
          noteCtrl: _noteCtrl,
          receiptFile: _receiptFile,
          onPick: _pickReceipt,
          error: _error,
          isDigital: _isDigital,
        );
      case _CheckoutStep.done:
        return const SizedBox.shrink();
    }
  }

  Widget _buildBottomBar(ColorScheme cs) {
    if (_step == _CheckoutStep.done) {
      return const SizedBox.shrink();
    }

    final isLast = _step == _CheckoutStep.pay;
    final canProceed = _canProceed();

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        color: cs.surface,
        child: Row(
          children: [
            if (_step != _CheckoutStep.review)
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    final steps = _CheckoutStep.values;
                    final cur = steps.indexOf(_step);
                    if (cur > 0) setState(() => _step = steps[cur - 1]);
                  },
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: const Text('العودة'),
                ),
              ),
            if (_step != _CheckoutStep.review) const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: canProceed ? _next : null,
                icon: _isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded, size: 18),
                label: Text(
                  isLast ? 'دفع الآن' : _stepLabel(),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _stepLabel() {
    switch (_step) {
      case _CheckoutStep.review:
        return 'متابعة';
      case _CheckoutStep.missing:
        return 'حفظ البيانات';
      case _CheckoutStep.confirm:
        return 'تأكيد الحجز';
      case _CheckoutStep.pay:
        return 'اختيار طريقة الدفع';
      case _CheckoutStep.done:
        return 'تم';
    }
  }

  bool _canProceed() {
    switch (_step) {
      case _CheckoutStep.review:
        return _reviewItems.isNotEmpty;
      case _CheckoutStep.missing:
        return _missingFields.every((f) {
          final key = f['key'];
          if (key == null) return true;
          final v = _missingCtrls[key]?.text.trim();
          return v != null && v.isNotEmpty;
        });
      case _CheckoutStep.confirm:
        return true;
      case _CheckoutStep.pay:
        return _selectedMethod != null &&
            (!_isDigital ||
                (_receiptBase64.isNotEmpty &&
                    _senderPhoneCtrl.text.trim().isNotEmpty));
      case _CheckoutStep.done:
        return false;
    }
  }

  void _next() {
    switch (_step) {
      case _CheckoutStep.review:
        setState(() => _step = _CheckoutStep.missing);
      case _CheckoutStep.missing:
        _confirmOrder();
      case _CheckoutStep.confirm:
        setState(() => _step = _CheckoutStep.pay);
        _loadPaymentMethods();
      case _CheckoutStep.pay:
        _pay();
      case _CheckoutStep.done:
        break;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

class _StepIndicator extends StatelessWidget {
  final _CheckoutStep step;
  const _StepIndicator({required this.step});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final steps = ['مراجعة الطلب', 'البيانات الناقصة', 'تأكيد الحجز', 'الدفع', 'تم'];
    final cur = _CheckoutStep.values.indexOf(step);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(steps.length, (index) {
              final active = index <= cur;
              return Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: active ? cs.primary : cs.surfaceContainerHighest,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: active ? cs.primary : cs.outlineVariant,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: active ? cs.onPrimary : cs.onSurfaceVariant,
                            fontWeight: FontWeight.w900,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      steps[index],
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                        color: active ? cs.primary : cs.onSurfaceVariant,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step bodies
// ─────────────────────────────────────────────────────────────────────────────

class _ReviewBody extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final double total;
  final String? error;

  const _ReviewBody({required this.items, required this.total, this.error});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('مراجعة الطلب', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(
          'راجع الكورسات والإجمالي قبل تأكيد الحجز. المبلغ من النظام ولا يمكن تعديله.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        ...items.map(
          (item) => Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: const Icon(Icons.play_lesson_outlined),
              title: Text(
                item['title_ar']?.toString() ?? 'دورة تدريبية',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              trailing: Text(
                '${(item['price'] as num? ?? 0).toInt()} ج.م',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          color: cs.primaryContainer,
          child: ListTile(
            title: const Text('إجمالي الطلب', style: TextStyle(fontWeight: FontWeight.w800)),
            trailing: Text(
              '${total.toInt()} ج.م',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: cs.onPrimaryContainer),
            ),
          ),
        ),
        if (error != null && error!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            color: cs.errorContainer,
            child: Text(error!, style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
          ),
        ],
      ],
    );
  }
}

class _MissingFieldsBody extends StatelessWidget {
  final List<Map<String, dynamic>> fields;
  final Map<String, TextEditingController> ctrls;
  final String? error;

  const _MissingFieldsBody({required this.fields, required this.ctrls, this.error});

  static String _labelFor(Object? key) {
    final k = key as String?;
    switch (k) {
      case 'name':
        return 'الاسم completo';
      case 'phone':
        return 'رقم الهاتف';
      case 'national_id':
        return 'الرقم القومي (14 رقمًا)';
      case 'university_name':
        return 'اسم الجامعة';
      case 'university_code':
        return 'الكود الجامعي';
      default:
        return key ?? '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('بيانات ناقصة', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text('أكمل الحقول التالية قبل متابعة الدفع:',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
        const SizedBox(height: 16),
        ...fields.map((f) {
          final key = f['key'];
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: TextFormField(
              controller: ctrls[key as String? ?? ''],
              decoration: InputDecoration(
                labelText: _labelFor(key),
                border: const OutlineInputBorder(),
              ),
            ),
          );
        }),
        if (error != null && error!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            color: cs.errorContainer,
            child: Text(error!, style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
          ),
        ],
      ],
    );
  }
}

class _ConfirmBody extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final double total;
  final String? error;

  const _ConfirmBody({required this.items, required this.total, this.error});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('تأكيد الحجز', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(
          'بعد الضغط على "تأكيد الحجز" سيتم إنشاء طلبك وحجز دورتك. يمكنك الدفع فوراً أو لاحقاً من "طلباتي".',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        ...items.map(
          (item) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(item['title_ar']?.toString() ?? 'دورة تدريبية'),
            trailing: Text(
              '${(item['price'] as num? ?? 0).toInt()} ج.م',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ),
        const Divider(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('الإجمالي', style: tt.labelMedium),
            Text(
              '${total.toInt()} ج.م',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: cs.primary),
            ),
          ],
        ),
        if (error != null && error!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            color: cs.errorContainer,
            child: Text(error!, style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
          ),
        ],
      ],
    );
  }
}

class _PayBody extends StatelessWidget {
  final List<Map<String, dynamic>> methods;
  final Map<String, dynamic>? selected;
  final void Function(Map<String, dynamic>?) onSelect;
  final TextEditingController senderPhoneCtrl;
  final TextEditingController noteCtrl;
  final File? receiptFile;
  final void Function(ImageSource) onPick;
  final String? error;
  final bool isDigital;

  const _PayBody({
    required this.methods,
    required this.selected,
    required this.onSelect,
    required this.senderPhoneCtrl,
    required this.noteCtrl,
    required this.receiptFile,
    required this.onPick,
    this.error,
    required this.isDigital,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('اختيار طريقة الدفع', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(
          'اختر طريقة الدفع المناسبة. الطرق الرقمية تتطلب إيصالاً.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        ...methods.map((m) {
          final value = m['key'] as String? ?? '';
          return Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: RadioListTile<String>(
              title: Text(
                m['label']?.toString() ?? 'طريقة دفع',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                (m['kind'] == 'cash' ? 'الدفع في الخزنة' : 'دفع رقمي (إيصال مطلوب)'),
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
              ),
              value: value,
              groupValue: (selected?['key'] as String? ?? ''),
              onChanged: (_) => onSelect(m),
            ),
          );
        }),
        const SizedBox(height: 16),
        TextFormField(
          controller: senderPhoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'رقم هاتف المحوِّل',
            hintText: '01000000000',
            prefixIcon: Icon(Icons.phone_android_outlined),
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 14),
        if (isDigital) ...[
          Text('صورة الإيصال', style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => onPick(ImageSource.gallery),
                  icon: const Icon(Icons.image_outlined),
                  label: const Text('من المعرض'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => onPick(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: const Text('الكاميرا'),
                ),
              ),
            ],
          ),
          if (receiptFile != null) ...[
            const SizedBox(height: 10),
            Text('تم اختيار صورة الإيصال', style: tt.bodySmall?.copyWith(color: cs.primary)),
          ],
          const SizedBox(height: 14),
        ],
        TextFormField(
          controller: noteCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'ملاحظة (اختياري)',
            hintText: 'أي ملاحظات حول الدفع...',
            border: OutlineInputBorder(),
          ),
        ),
        if (error != null && error!.isNotEmpty) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            color: cs.errorContainer,
            child: Text(error!, style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
          ),
        ],
      ],
    );
  }
}

class _DoneView extends StatelessWidget {
  final int? orderId;
  final String status;
  final VoidCallback onClose;

  const _DoneView({required this.orderId, required this.status, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(color: cs.primaryContainer, shape: BoxShape.circle),
              child: Icon(Icons.check_circle_rounded, size: 56, color: cs.onPrimaryContainer),
            ),
            const SizedBox(height: 18),
            Text('تم الحجز بنجاح!', style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            if (orderId != null)
              Text('رقم طلبك: #$orderId', style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              status == 'review'
                  ? 'إرسالك الإيصال قيد المراجعة من قبل الإدارة.'
                  : 'يمكنك دفع الطلب لاحقًا من صفحة "طلباتي".',
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            FilledButton(onPressed: onClose, child: const Text('إغلاق')),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text('تعذر إتمام الشراء', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
            const SizedBox(height: 20),
            FilledButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }
}
