import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';
import '../../core/cart/cart_provider.dart';
import '../../core/courses/courses_provider.dart';
import '../../core/orders/orders_provider.dart';
import '../../core/utils/json_utils.dart';
import 'orders_screen.dart';

/// إتمام الشراء — بنفس خطوات المنصة:
/// مراجعة الطلب ← بياناتك (عند النقص فقط) ← المراجعة النهائية ← الدفع.
/// الحجز لا يُنشأ ولا تُرسل إشعاراته إلا في الخطوة الأخيرة (الدفع).
/// شاشة النجاح ليست خطوة في المؤشر.
///
/// - الأسعار والإجمالي من السيرفر دائماً.
/// - طريقة الدفع واحدة: خزنة المعهد. يُصدر رقم الحجز، يدفع الطالب في الخزنة
///   ثم يرفع صورة الإيصال من "طلباتي" ليعتمدها الأدمن.
/// - بعد الحجز تختفي كورسات الحجز من السلة (السيرفر هو المصدر)، والتطبيق يعيد قراءتها.
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

enum _CheckoutStep { review, missing, confirm, pay }

/// مفاتيح الحقول الناقصة كما يعيدها `GET /api/orders/checkout-requirements`
/// مقابل أسماء الحقول التي يقبلها `PUT /api/auth/profile`.
const Map<String, String> _profileKeys = {
  'name': 'name',
  'phone': 'phone',
  'national_id': 'nationalId',
  'university_name': 'universityName',
  'university_code': 'universityCode',
};

class _CheckoutScreenState extends State<CheckoutScreen> {
  final _api = ApiClient();

  _CheckoutStep _step = _CheckoutStep.review;
  bool _initializing = true;
  String? _fatalError;
  String? _stepError;
  bool _busy = false;
  bool _done = false;

  // Review
  List<Map<String, dynamic>> _reviewItems = [];
  double _total = 0;

  // Missing fields
  List<Map<String, dynamic>> _missingFields = [];
  final Map<String, TextEditingController> _missingCtrls = {};

  // Confirm
  final _noteCtrl = TextEditingController();

  // Order
  int? _orderId;
  double _orderAmount = 0;

  // Pay — treasury only: just the admin-written instructions.
  String? _cashInstructions;
  bool _methodsLoading = false;

  // 409 while booking (paid course / open booking) — replaces the confirm step.
  String? _conflictMessage;
  bool _conflictPaid = false;

  bool get _isExistingOrder => widget.existingOrderId != null;

  bool get _orderCreatedHere => _orderId != null && !_isExistingOrder;

  List<_CheckoutStep> get _steps {
    final steps = <_CheckoutStep>[_CheckoutStep.review];
    if (_missingFields.isNotEmpty) steps.add(_CheckoutStep.missing);
    steps.add(_CheckoutStep.confirm);
    steps.add(_CheckoutStep.pay);
    return steps;
  }

  /// Arabic message for a failed call — never a raw Dio error.
  String _errorText(Object error, [String fallback = 'تعذر إتمام العملية، حاول مرة أخرى']) {
    if (error is DioException) {
      final data = toJsonMap(error.response?.data);
      return toStrOrNull(data?['error']) ?? fallback;
    }
    final text = error.toString();
    return text.startsWith('Exception: ') ? text.substring(11) : text;
  }

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _noteCtrl.dispose();
    for (final c in _missingCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  // ── Load ───────────────────────────────────────────────────────────────────
  Future<void> _init() async {
    setState(() {
      _initializing = true;
      _fatalError = null;
    });

    if (_isExistingOrder) {
      final order = await context.read<OrdersProvider>().fetchOrder(widget.existingOrderId!);
      if (!mounted) return;
      if (order == null) {
        setState(() {
          _initializing = false;
          _fatalError = 'تعذر تحميل بيانات الطلب';
        });
        return;
      }
      setState(() {
        _orderId = order.id;
        _orderAmount = order.amount;
        _total = order.amount;
        _reviewItems = order.items
            .map((i) => {
                  'course_id': i.courseId,
                  'title_ar': i.displayTitle,
                  'price': i.price,
                })
            .toList();
        _step = _CheckoutStep.pay;
        _initializing = false;
      });
      await _loadPaymentInfo();
      return;
    }

    final items = await _loadReviewItems();
    if (!mounted) return;
    if (items == null) {
      setState(() {
        _initializing = false;
        _fatalError = 'تعذر تحميل تفاصيل الطلب';
      });
      return;
    }

    // Only the fields the server actually reports as missing.
    final requirements = await context.read<OrdersProvider>().checkoutRequirements();
    if (!mounted) return;
    setState(() {
      _reviewItems = items;
      _total = items.fold<double>(0, (sum, i) => sum + toDouble(i['price']));
      _missingFields = List<Map<String, dynamic>>.from(requirements ?? const []);
      for (final field in _missingFields) {
        final key = toStrOrNull(field['key']);
        if (key != null && !_missingCtrls.containsKey(key)) {
          _missingCtrls[key] = TextEditingController();
        }
      }
      _initializing = false;
    });
  }

  /// Review rows: cart prices when the course is in the cart, otherwise the
  /// course price from the server ("اشترِ الآن" does not touch the cart).
  Future<List<Map<String, dynamic>>?> _loadReviewItems() async {
    try {
      final cart = context.read<CartProvider>();
      await cart.fetchCart(silent: true);
      if (!mounted) return null;

      final byId = {for (final item in cart.items) item.courseId: item};
      final items = <Map<String, dynamic>>[];
      for (final id in widget.courseIds) {
        final cartItem = byId[id];
        if (cartItem != null) {
          items.add({
            'course_id': cartItem.courseId,
            'title_ar': cartItem.titleAr,
            'price': cartItem.price,
          });
          continue;
        }
        final course = await context.read<CoursesProvider>().fetchCourseDetails(id);
        if (!mounted) return null;
        if (course == null) return null;
        items.add({
          'course_id': course.id,
          'title_ar': course.titleAr,
          'price': course.price,
        });
      }
      return items;
    } catch (_) {
      return null;
    }
  }

  /// Treasury instructions written by the admin (cash method only).
  Future<void> _loadPaymentInfo() async {
    setState(() => _methodsLoading = true);
    final methods = await context.read<OrdersProvider>().paymentMethods();
    if (!mounted) return;
    setState(() {
      _methodsLoading = false;
      final cash = methods?.where((m) => toStr(m['kind']) == 'cash').firstOrNull;
      _cashInstructions = toStrOrNull(cash?['instructions']);
    });
  }

  // ── Navigation between steps ───────────────────────────────────────────────
  void _goNext() {
    switch (_step) {
      case _CheckoutStep.review:
        setState(() {
          _stepError = null;
          _step = _missingFields.isEmpty ? _CheckoutStep.confirm : _CheckoutStep.missing;
        });
      case _CheckoutStep.missing:
        _saveMissingData();
      case _CheckoutStep.confirm:
        _goToPay();
      case _CheckoutStep.pay:
        _submitPayment();
    }
  }

  void _goBack() {
    if (_step == _CheckoutStep.pay && _orderId != null) {
      _leaveToOrders();
      return;
    }
    final steps = _steps;
    final index = steps.indexOf(_step);
    if (index > 0) {
      setState(() {
        _stepError = null;
        _step = steps[index - 1];
      });
    }
  }

  /// Leaves the checkout without creating a second order: the booking is saved
  /// and payment continues from "طلباتي".
  void _leaveToOrders() {
    final messenger = ScaffoldMessenger.of(context);
    if (_isExistingOrder) {
      Navigator.of(context).pop(true);
      return;
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const OrdersScreen()),
    );
    if (_orderCreatedHere) {
      messenger.showSnackBar(
        const SnackBar(content: Text('حجزك محفوظ ويمكنك الدفع من طلباتي')),
      );
    }
  }

  void _goToOrders() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const OrdersScreen()),
    );
  }

  void _goToMyCourses() {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  // ── Step: missing data ─────────────────────────────────────────────────────
  Future<void> _saveMissingData() async {
    final body = <String, dynamic>{};
    for (final entry in _missingCtrls.entries) {
      body[_profileKeys[entry.key] ?? entry.key] = entry.value.text.trim();
    }
    if (body.isEmpty) {
      setState(() => _step = _CheckoutStep.confirm);
      return;
    }

    setState(() {
      _busy = true;
      _stepError = null;
    });
    try {
      await _api.put(ApiConstants.updateProfile, data: body);
      if (!mounted) return;
      final still = await context.read<OrdersProvider>().checkoutRequirements();
      if (!mounted) return;
      final remaining = List<Map<String, dynamic>>.from(still ?? const []);
      setState(() {
        _busy = false;
        _missingFields = remaining;
        if (remaining.isEmpty) {
          _stepError = null;
          _step = _CheckoutStep.confirm;
        } else {
          _stepError = 'ما زالت هناك بيانات ناقصة، أكملها للمتابعة';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _stepError = _errorText(e);
      });
    }
  }

  // ── Step: final review (nothing is booked yet) ─────────────────────────────
  Future<void> _goToPay() async {
    setState(() {
      _stepError = null;
      _conflictMessage = null;
      _step = _CheckoutStep.pay;
    });
    await _loadPaymentInfo();
  }

  // ── Step: pay (treasury only) ──────────────────────────────────────────────
  Future<void> _submitPayment() async {
    setState(() {
      _busy = true;
      _stepError = null;
      _conflictMessage = null;
    });

    final orders = context.read<OrdersProvider>();
    final cart = context.read<CartProvider>();
    final note = _noteCtrl.text.trim();

    try {
      final orderId = _orderId;
      if (orderId == null && !_isExistingOrder) {
        // Last step: the booking is created here (no receipt is uploaded yet —
        // the student pays in the treasury and uploads it from "طلباتي").
        final created = await orders.createOrder(
          courseIds: widget.courseIds,
          paymentMethod: 'cash',
          noteStudent: note.isEmpty ? null : note,
        );
        if (!mounted) return;
        if (created == null) {
          setState(() {
            _busy = false;
            _stepError = 'فشل تأكيد الحجز، حاول مرة أخرى';
          });
          return;
        }
        await cart.fetchCart(silent: true);
        if (!mounted) return;
        setState(() {
          _busy = false;
          _orderId = created.id;
          _orderAmount = created.amount;
          _total = created.amount;
          _done = true;
        });
        return;
      }

      await orders.payOrder(
        orderId: orderId!,
        method: 'cash',
      );
      if (!mounted) return;
      await cart.fetchCart(silent: true);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _done = true;
      });
    } on OrderConflictException catch (e) {
      if (!mounted) return;
      await cart.fetchCart(silent: true);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _conflictPaid = e.isPaid;
        _conflictMessage = e.message;
        _step = _CheckoutStep.confirm;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _stepError = _errorText(e);
      });
    }
  }

  void _reload() {
    setState(() {
      _fatalError = null;
      _stepError = null;
    });
    _init();
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return PopScope(
      // Once the booking exists, Back must not return to a step that could
      // create a second order.
      canPop: _done || !_orderCreatedHere,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leaveToOrders();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_isExistingOrder ? 'دفع الطلب' : 'إتمام الشراء'),
        ),
        body: _buildScreen(cs),
      ),
    );
  }

  Widget _buildScreen(ColorScheme cs) {
    if (_initializing) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_fatalError != null) {
      return _ErrorView(message: _fatalError!, onRetry: _reload);
    }
    if (_done) {
      return _SuccessView(
        orderId: _orderId,
        onOrders: _goToOrders,
      );
    }
    return Column(
      children: [
        // Paying an existing booking is a single step — no progress bar.
        if (!_isExistingOrder) _StepIndicator(steps: _steps, current: _step),
        Expanded(child: _buildBody(cs)),
        _buildBottomBar(cs),
      ],
    );
  }

  Widget _buildBody(ColorScheme cs) {
    switch (_step) {
      case _CheckoutStep.review:
        return _ReviewBody(
          items: _reviewItems,
          total: _total,
          error: _stepError,
        );
      case _CheckoutStep.missing:
        return _MissingFieldsBody(
          fields: _missingFields,
          ctrls: _missingCtrls,
          error: _stepError,
        );
      case _CheckoutStep.confirm:
        if (_conflictMessage != null) {
          return _ConflictBody(
            message: _conflictMessage!,
            paid: _conflictPaid,
          );
        }
        return _ConfirmBody(
          items: _reviewItems,
          total: _total,
          noteCtrl: _noteCtrl,
          error: _stepError,
        );
      case _CheckoutStep.pay:
        return _PayBody(
          instructions: _cashInstructions,
          loading: _methodsLoading,
          onReload: _loadPaymentInfo,
          orderId: _orderId,
          amount: _orderAmount,
          error: _stepError,
        );
    }
  }

  Widget _buildBottomBar(ColorScheme cs) {
    if (_conflictMessage != null) {
      return SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
          color: cs.surface,
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _conflictPaid ? _goToMyCourses : _goToOrders,
              icon: Icon(
                _conflictPaid ? Icons.school_rounded : Icons.receipt_long_rounded,
                size: 18,
              ),
              label: Text(_conflictPaid ? 'كورساتي' : 'طلباتي'),
            ),
          ),
        ),
      );
    }

    final canProceed = _canProceed();
    final isFirst = _step == _steps.first;
    final backLabel = _step == _CheckoutStep.pay && _orderId != null ? 'طلباتي' : 'العودة';

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        color: cs.surface,
        child: Row(
          children: [
            if (!isFirst) ...[
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : _goBack,
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                  label: Text(backLabel),
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: 2,
              child: FilledButton.icon(
                onPressed: canProceed && !_busy ? _goNext : null,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(
                        _step == _CheckoutStep.pay
                            ? Icons.check_circle_outline_rounded
                            : Icons.arrow_forward_rounded,
                        size: 18,
                      ),
                label: Text(
                  _buttonLabel(),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _buttonLabel() {
    switch (_step) {
      case _CheckoutStep.review:
        return 'متابعة';
      case _CheckoutStep.missing:
        return 'حفظ ومتابعة';
      case _CheckoutStep.confirm:
        return 'متابعة للدفع';
      case _CheckoutStep.pay:
        if (_orderId == null && !_isExistingOrder) return 'تأكيد الحجز';
        return 'تأكيد الدفع في الخزنة';
    }
  }

  bool _canProceed() {
    switch (_step) {
      case _CheckoutStep.review:
        return _reviewItems.isNotEmpty;
      case _CheckoutStep.missing:
        return _missingFields.every((field) {
          final key = toStr(field['key']);
          final value = _missingCtrls[key]?.text.trim() ?? '';
          return value.isNotEmpty;
        });
      case _CheckoutStep.confirm:
        return _reviewItems.isNotEmpty;
      case _CheckoutStep.pay:
        return !_methodsLoading;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

class _StepIndicator extends StatelessWidget {
  final List<_CheckoutStep> steps;
  final _CheckoutStep current;

  const _StepIndicator({required this.steps, required this.current});

  static const Map<_CheckoutStep, String> _labels = {
    _CheckoutStep.review: 'مراجعة الطلب',
    _CheckoutStep.missing: 'بياناتك',
    _CheckoutStep.confirm: 'المراجعة النهائية',
    _CheckoutStep.pay: 'الدفع',
  };

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final cur = steps.indexOf(current);

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Row(
        children: List.generate(steps.length, (index) {
          final active = index <= cur;
          final done = index < cur;
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
                    border: Border.all(color: active ? cs.primary : cs.outlineVariant),
                  ),
                  child: Center(
                    child: done
                        ? Icon(Icons.check_rounded, size: 15, color: cs.onPrimary)
                        : Text(
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
                  _labels[steps[index]]!,
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
        if (items.isEmpty)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: cs.errorContainer,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, size: 18, color: cs.onErrorContainer),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'لا توجد كورسات في هذا الطلب. أضف كورساً إلى السلة أو اختر "اشترِ الآن" من صفحة الكورس.',
                    style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ...items.map(
          (item) => Card(
            margin: const EdgeInsets.only(bottom: 10),
            child: ListTile(
              leading: const Icon(Icons.play_lesson_outlined),
              title: Text(
                toStrOrNull(item['title_ar']) ?? 'دورة تدريبية',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              trailing: Text(
                '${toInt(item['price'])} ج.م',
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
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: cs.onPrimaryContainer,
              ),
            ),
          ),
        ),
        _errorBox(cs, error),
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
    switch (toStrOrNull(key)) {
      case 'name':
        return 'الاسم';
      case 'phone':
        return 'رقم الهاتف';
      case 'national_id':
        return 'الرقم القومي (14 رقمًا)';
      case 'university_name':
        return 'اسم الجامعة';
      case 'university_code':
        return 'الكود الجامعي';
      default:
        return toStrOrNull(key) ?? '';
    }
  }

  static String? _hintFor(Object? key) {
    switch (toStrOrNull(key)) {
      case 'phone':
        return '01XXXXXXXXX';
      case 'national_id':
        return '14 رقمًا';
      case 'name':
        return 'اكتب اسمك بالكامل';
      default:
        return null;
    }
  }

  static bool _isNumeric(Object? key) {
    final k = toStrOrNull(key);
    return k == 'phone' || k == 'national_id' || k == 'university_code';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('بياناتك', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(
          'نحتاج هذه البيانات فقط لإتمام التسجيل. بياناتك المعروفة لدينا لا نطلبها مرة أخرى.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        ...fields.map((field) {
          final key = field['key'];
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: TextFormField(
              controller: ctrls[toStr(key)],
              keyboardType: _isNumeric(key) ? TextInputType.number : TextInputType.text,
              textDirection: _isNumeric(key) ? TextDirection.ltr : null,
              decoration: InputDecoration(
                labelText: _labelFor(key),
                hintText: _hintFor(key),
                border: const OutlineInputBorder(),
              ),
            ),
          );
        }),
        _errorBox(cs, error),
      ],
    );
  }
}

class _ConfirmBody extends StatelessWidget {
  final List<Map<String, dynamic>> items;
  final double total;
  final TextEditingController noteCtrl;
  final String? error;

  const _ConfirmBody({
    required this.items,
    required this.total,
    required this.noteCtrl,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('المراجعة النهائية', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(
          'راجع طلبك وأضف ملاحظاتك. لن يُسجَّل الحجز ولا تُفرَّغ السلة إلا بعد إتمام خطوة الدفع.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        const SizedBox(height: 16),
        Card(
          color: cs.surfaceContainerLow,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: Column(
              children: [
                ...items.map(
                  (item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(toStrOrNull(item['title_ar']) ?? 'دورة تدريبية'),
                        ),
                        Text(
                          '${toInt(item['price'])} ج.م',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ),
                const Divider(height: 18),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('الإجمالي', style: tt.labelMedium),
                    Text(
                      '${total.toInt()} ج.م',
                      style: tt.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: cs.primary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        TextFormField(
          controller: noteCtrl,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'ملاحظات (اختياري)',
            hintText: 'أي ملاحظات تريد إضافتها لحجزك...',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'لن يُخصم أو يُحجز شيء قبل تأكيد خطوة الدفع.',
          style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
        ),
        _errorBox(cs, error),
      ],
    );
  }
}

/// Shown instead of the confirm step when the server refuses the booking (409).
class _ConflictBody extends StatelessWidget {
  final String message;
  final bool paid;

  const _ConflictBody({required this.message, required this.paid});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: (paid ? cs.primaryContainer : cs.errorContainer).withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
              child: Icon(
                paid ? Icons.verified_rounded : Icons.hourglass_top_rounded,
                size: 46,
                color: paid ? cs.onPrimaryContainer : cs.onErrorContainer,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              paid ? 'أنت مسجل في هذا الكورس بالفعل' : 'لديك حجز مفتوح لهذا الكورس',
              textAlign: TextAlign.center,
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 10),
            Text(
              paid
                  ? 'تجد الكورس ومجموعاته في "كورساتي".'
                  : 'أكمل دفع الحجز من "طلباتي" أو ألغِه، ثم أعد المحاولة.',
              textAlign: TextAlign.center,
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _PayBody extends StatelessWidget {
  final String? instructions;
  final bool loading;
  final VoidCallback onReload;
  final int? orderId;
  final double amount;
  final String? error;

  const _PayBody({
    required this.instructions,
    required this.loading,
    required this.onReload,
    required this.orderId,
    required this.amount,
    this.error,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }

    final note = instructions ??
        'توجّه إلى خزنة المعهد واذكر رقم الحجز. استلم إيصال الدفع، ثم ارفع صورته من صفحة "طلباتي" لتتم مراجعته والموافقة عليه.';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('الدفع', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),

        // Booking number + amount due
        _InfoRow(
          label: 'رقم الحجز',
          value: orderId == null ? 'يصدر بعد التأكيد' : '#$orderId',
          ltr: orderId != null,
        ),
        const SizedBox(height: 8),
        _InfoRow(
          label: 'المبلغ المطلوب',
          value: '${amount.toInt()} ج.م',
          highlight: true,
          ltr: true,
        ),

        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: cs.surfaceContainerLow,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: cs.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.account_balance_rounded, size: 18, color: cs.primary),
                  const SizedBox(width: 6),
                  Text(
                    'الدفع في خزنة المعهد',
                    style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                note,
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.5),
              ),
              const SizedBox(height: 10),
              Text(
                '1. أكّد الحجز ليصدر رقم الحجز.\n2. ادفع في الخزنة واذكر الرقم.\n3. ارفع صورة الإيصال من "طلباتي".',
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.6),
              ),
            ],
          ),
        ),

        if (orderId != null) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onReload,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('تحديث'),
          ),
        ],

        _errorBox(cs, error),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;
  final bool ltr;

  const _InfoRow({
    required this.label,
    required this.value,
    this.highlight = false,
    this.ltr = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          Text(
            value,
            textDirection: ltr ? TextDirection.ltr : null,
            style: highlight
                ? tt.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: cs.primary)
                : const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

Widget _errorBox(ColorScheme cs, String? error) {
  if (error == null || error.isEmpty) return const SizedBox.shrink();
  return Container(
    margin: const EdgeInsets.only(top: 12),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: cs.errorContainer,
      borderRadius: BorderRadius.circular(10),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(Icons.error_outline_rounded, size: 18, color: cs.onErrorContainer),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            error,
            style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
          ),
        ),
      ],
    ),
  );
}

class _SuccessView extends StatelessWidget {
  final int? orderId;
  final VoidCallback onOrders;

  const _SuccessView({
    required this.orderId,
    required this.onOrders,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
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
            Text(
              'تم تأكيد حجزك',
              style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            if (orderId != null)
              Text(
                'رقم حجزك #$orderId',
                style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
            const SizedBox(height: 6),
            Text(
              'احتفظ برقم الحجز وادفع في خزنة المعهد، ثم ارفع صورة الإيصال من "طلباتي" ليتم اعتماده.',
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 22),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onOrders,
                icon: const Icon(Icons.receipt_long_rounded, size: 18),
                label: const Text('طلباتي'),
              ),
            ),
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
            Text(
              'تعذر إتمام الشراء',
              style: tt.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: cs.error,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }
}
