import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../../core/models/order_model.dart';
import '../../core/orders/orders_provider.dart';

/// "طلباتي" — the student's bookings with their items and states.
/// The only payment route is the treasury: the student books, pays there, then
/// uploads the receipt photo from here for admin approval.
class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrdersProvider>().fetchMyOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<OrdersProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('طلباتي')),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchMyOrders(),
        child: provider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.error != null
                ? _ErrorView(
                    message: provider.error!,
                    onRetry: () => provider.fetchMyOrders(),
                  )
                : provider.myOrders.isEmpty
                    ? const _EmptyView()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.myOrders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, i) => _OrderCard(order: provider.myOrders[i], cs: cs, tt: tt),
                      ),
      ),
    );
  }
}

class _OrderCard extends StatefulWidget {
  final OrderModel order;
  final ColorScheme cs;
  final TextTheme tt;
  const _OrderCard({required this.order, required this.cs, required this.tt});

  @override
  State<_OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<_OrderCard> {
  bool _busy = false;

  OrderModel get order => widget.order;
  ColorScheme get cs => widget.cs;
  TextTheme get tt => widget.tt;

  (String, Color) get _statusStyle => switch (order.status) {
        'paid' => ('مؤكد ومسجل', Colors.green.shade700),
        'review' => ('قيد المراجعة', Colors.orange.shade800),
        'rejected' => ('مرفوض', cs.error),
        'cancelled' => ('ملغي', cs.outline),
        _ => ('في انتظار السداد', cs.primary),
      };

  Future<void> _cancelOrder() async {
    final provider = context.read<OrdersProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('إلغاء الطلب'),
        content: const Text('سيتم إلغاء الحجز بالكامل ولن تحصل على الكورسات. هل تريد المتابعة؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('رجوع'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('إلغاء الطلب'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    final ok = await provider.cancelOrder(order.id);
    if (!mounted) return;
    setState(() => _busy = false);
    messenger.showSnackBar(
      SnackBar(content: Text(ok ? 'تم إلغاء الطلب' : 'تعذر إلغاء الطلب')),
    );
  }

  Future<void> _removeItem(OrderItemModel item) async {
    final provider = context.read<OrdersProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('حذف كورس من الطلب'),
        content: Text('سيتم حذف "${item.displayTitle}" من هذا الطلب. هل تريد المتابعة؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('رجوع'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    final ok = await provider.removeOrderItem(order.id, item.courseId);
    if (!mounted) return;
    setState(() => _busy = false);
    messenger.showSnackBar(
      SnackBar(content: Text(ok ? 'تم حذف الكورس من الطلب' : 'تعذر حذف الكورس')),
    );
  }

  Future<void> _openReceipt() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _ReceiptSheet(orderId: order.id),
    );
    if (mounted) await context.read<OrdersProvider>().fetchMyOrders(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    final (label, color) = _statusStyle;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'طلب #${order.id}',
                    style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    label,
                    style: tt.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
            if (order.cancelReasonTextAr != null) ...[
              const SizedBox(height: 4),
              Text(
                order.cancelReasonTextAr!,
                style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 10),
            // Items (full list — no truncation, as per the web)
            if (order.items.isNotEmpty)
              ...order.items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Icon(Icons.play_lesson_outlined, size: 16, color: cs.primary),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item.displayTitle,
                          style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ),
                       Text(
                        '${item.price.toStringAsFixed(0)} ج.م',
                        style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
                      ),
                      if (order.isOpen)
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: 'حذف من الطلب',
                          icon: Icon(Icons.close_rounded, size: 16, color: cs.error),
                          onPressed: _busy ? null : () => _removeItem(item),
                        ),
                    ],
                  ),
                ),
              )
            else if (order.titleAr != null && order.titleAr!.isNotEmpty)
              Text(order.titleAr!, style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
            const Divider(height: 20),
            Row(
              children: [
                Text('الإجمالي', style: tt.labelMedium?.copyWith(color: cs.onSurfaceVariant)),
                const Spacer(),
                Text(
                  '${order.amount.toStringAsFixed(0)} ج.م',
                  style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w900, color: cs.primary),
                ),
              ],
            ),
            if (order.createdAt != null) ...[
              const SizedBox(height: 6),
              Text(
                'تاريخ الطلب: ${order.createdAt!.split('T').first.split(' ').first}',
                style: tt.labelSmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
            if (order.paymentMethod != null && order.paymentMethod!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.payment_outlined, size: 16, color: cs.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'طريقة الدفع: ${order.paymentMethod}',
                      style: tt.labelSmall?.copyWith(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ],
            if (order.receiptUrl != null && order.receiptUrl!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.receipt_long_outlined, size: 16, color: cs.primary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'الإيصال: مرفق',
                      style: tt.labelSmall?.copyWith(
                        color: Colors.green.shade700,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            if (order.isOpen) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: _busy ? null : _openReceipt,
                icon: const Icon(Icons.upload_file_rounded, size: 18),
                label: Text(
                  order.status == 'review'
                      ? 'تحديث صورة الإيصال'
                      : 'رفع إيصال الدفع',
                ),
              ),
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _busy ? null : _cancelOrder,
                icon: Icon(Icons.cancel_outlined, size: 18, color: cs.error),
                label: Text('إلغاء الطلب', style: TextStyle(color: cs.error)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: constraints.maxHeight),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: cs.primaryContainer.withValues(alpha: 0.3),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.receipt_long_outlined, size: 56, color: cs.primary),
                  ),
                  const SizedBox(height: 16),
                  Text('لا توجد طلبات', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(
                    'ستظهر هنا كل حجوزاتك وحالات السداد الخاصة بها.',
                    textAlign: TextAlign.center,
                    style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
          ),
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
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline_rounded, size: 56, color: cs.error),
            const SizedBox(height: 16),
            Text('تعذر تحميل الطلبات',
                style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: cs.error)),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
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

/// Treasury receipt: pick the photo of the paper receipt, then upload it.
/// The order moves to `review` until an admin approves it (then `paid`).
class _ReceiptSheet extends StatefulWidget {
  final int orderId;
  const _ReceiptSheet({required this.orderId});

  @override
  State<_ReceiptSheet> createState() => _ReceiptSheetState();
}

class _ReceiptSheetState extends State<_ReceiptSheet> {
  final _picker = ImagePicker();
  File? _file;
  String _base64 = '';
  bool _busy = false;
  String? _error;

  Future<void> _pick(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 800,
        imageQuality: 70,
      );
      if (picked == null || !mounted) return;
      final file = File(picked.path);
      final bytes = await file.readAsBytes();
      if (!mounted) return;
      setState(() {
        _file = file;
        _base64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'تعذر قراءة الصورة، جرّب صورة أخرى');
    }
  }

  Future<void> _upload() async {
    if (_base64.isEmpty) {
      setState(() => _error = 'أرفق صورة إيصال الدفع أولاً');
      return;
    }
    final provider = context.read<OrdersProvider>();
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final ok = await provider.uploadReceipt(
        orderId: widget.orderId,
        receiptUrl: _base64,
      );
      if (!mounted) return;
      if (!ok) {
        setState(() {
          _busy = false;
          _error = 'فشل رفع الإيصال، حاول مرة أخرى';
        });
        return;
      }
      navigator.pop();
      messenger.showSnackBar(
        const SnackBar(content: Text('تم رفع الإيصال، وسيتم اعتماده بعد المراجعة')),
      );
    } catch (e) {
      if (!mounted) return;
      final message = e is Exception
          ? e.toString().replaceFirst('Exception: ', '')
          : 'فشل رفع الإيصال، حاول مرة أخرى';
      setState(() {
        _busy = false;
        _error = message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'رفع إيصال الدفع',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(
              'ادفع في خزنة المعهد واحصل على الإيصال، ثم ارفع صورته هنا ليتم اعتماد الطلب من الإدارة.',
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.5),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                    icon: const Icon(Icons.image_outlined, size: 18),
                    label: const Text('من المعرض'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _pick(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt_outlined, size: 18),
                    label: const Text('الكاميرا'),
                  ),
                ),
              ],
            ),
            if (_file != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(
                  _file!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.contain,
                ),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(_error!, style: tt.bodySmall?.copyWith(color: cs.error)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _busy || _base64.isEmpty ? null : _upload,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.cloud_upload_rounded, size: 18),
                label: Text(_busy ? 'جاري الرفع...' : 'رفع الإيصال'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
