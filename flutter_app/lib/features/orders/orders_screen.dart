import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/models/order_model.dart';
import '../../core/orders/orders_provider.dart';
import 'checkout_screen.dart';

/// "طلباتي" — the student's bookings with their items and states.
/// Read-mostly here; payment/cancellation land in phase 11 and reuse this screen.
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
                onPressed: () async {
                  final paid = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder: (_) => CheckoutScreen(
                        courseIds: [],
                        existingOrderId: order.id,
                      ),
                    ),
                  );
                  if (paid == true && context.mounted) {
                    context.read<OrdersProvider>().fetchMyOrders();
                  }
                },
                icon: const Icon(Icons.payment_rounded, size: 18),
                label: const Text('الدفع الآن'),
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
