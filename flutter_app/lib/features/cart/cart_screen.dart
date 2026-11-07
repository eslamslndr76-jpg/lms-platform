import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/cart/cart_provider.dart';
import '../../core/orders/orders_provider.dart';
import '../../shared/widgets/app_network_image.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _isCheckingOut = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CartProvider>().fetchCart(silent: true);
    });
  }

  Future<void> _handleCheckout() async {
    final cart = context.read<CartProvider>();
    if (cart.items.isEmpty || _isCheckingOut) return;

    setState(() => _isCheckingOut = true);
    final ordersProvider = context.read<OrdersProvider>();

    bool allSuccess = true;
    for (final item in cart.items) {
      final success = await ordersProvider.createOrder(
        courseId: item.courseId,
        amount: item.price,
      );
      if (success) {
        await cart.removeFromCart(item.id);
      } else {
        allSuccess = false;
      }
    }

    if (!mounted) return;
    setState(() => _isCheckingOut = false);

    if (allSuccess) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.check_circle_rounded, size: 48, color: Theme.of(ctx).colorScheme.primary),
          title: const Text('تم إرسال الطلب بنجاح!'),
          content: const Text(
            'تم تسجيل طلبك وحجزه في المنصة. يمكنك متابعة حالة الاشتراك من صفحة "كورساتي".',
          ),
          actions: [
            FilledButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop();
              },
              child: const Text('حسناً'),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('حدث خطأ أثناء تأكيد بعض عناصر الطلب'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final cart = context.watch<CartProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('سلة المشتريات'),
      ),
      body: cart.isLoading
          ? const Center(child: CircularProgressIndicator())
          : cart.items.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.remove_shopping_cart_outlined,
                          size: 72,
                          color: cs.onSurfaceVariant.withValues(alpha: 0.4),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'سلة المشتريات فارغة',
                          style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'لم تقم بإضافة أي دورات تدريبية بعد. تصفح الكورسات المتاحة وابدأ التعلم الآن!',
                          textAlign: TextAlign.center,
                          style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                        ),
                        const SizedBox(height: 24),
                        FilledButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('تصفح الكورسات'),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: cart.items.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final item = cart.items[index];
                          return Card(
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  // Course Image
                                  AppNetworkImage(
                                    imageUrl: item.image,
                                    width: 70,
                                    height: 70,
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  const SizedBox(width: 14),

                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.titleAr,
                                          style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          item.instructor ?? 'مدرب المنصة',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: cs.onSurfaceVariant,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          item.price > 0 ? '${item.price.toInt()} ج.م' : 'مجاناً',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w900,
                                            color: cs.primary,
                                            fontSize: 15,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),

                                  // Delete button
                                  IconButton(
                                    icon: Icon(Icons.delete_outline_rounded, color: cs.error),
                                    tooltip: 'حذف من السلة',
                                    onPressed: () => cart.removeFromCart(item.id),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),

                    // ── Bottom Summary & Checkout ─────────────────────────
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: cs.surface,
                        border: Border(
                          top: BorderSide(color: cs.outlineVariant, width: 1),
                        ),
                      ),
                      child: SafeArea(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'إجمالي الرسوم (${cart.count} دورات):',
                                  style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                                ),
                                Text(
                                  cart.total > 0 ? '${cart.total.toInt()} ج.م' : 'مجاناً',
                                  style: tt.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                    color: cs.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: _isCheckingOut ? null : _handleCheckout,
                              child: _isCheckingOut
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text('تأكيد الطلب والاشتراك الآن'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}
