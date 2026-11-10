import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/cart/cart_provider.dart';
import '../../shared/widgets/app_network_image.dart';
import '../orders/checkout_screen.dart';

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
      final cart = context.read<CartProvider>();
      cart.fetchCart(silent: true);
      cart.fetchSuggestions();
    });
  }

  Future<void> _confirmClearCart() async {
    final cart = context.read<CartProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تفريغ السلة'),
        content: const Text('سيتم حذف كل الدورات من السلة. هل تريد المتابعة؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('تفريغ'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final ok = await cart.clearCart();
    messenger.showSnackBar(
      SnackBar(content: Text(ok ? 'تم تفريغ السلة' : 'تعذر تفريغ السلة')),
    );
  }

  Future<void> _handleCheckout() async {
    final cart = context.read<CartProvider>();
    if (cart.items.isEmpty || _isCheckingOut) return;

    setState(() => _isCheckingOut = true);
    final courseIds = cart.items.map((i) => i.courseId).toList();

    if (!mounted) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(courseIds: courseIds),
      ),
    );
    setState(() => _isCheckingOut = false);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final cart = context.watch<CartProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('سلة المشتريات'),
        actions: [
          if (cart.items.isNotEmpty)
            IconButton(
              tooltip: 'تفريغ السلة',
              icon: const Icon(Icons.delete_sweep_outlined),
              onPressed: _confirmClearCart,
            ),
        ],
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
                        itemCount: cart.items.length + (cart.suggestions.isEmpty ? 0 : 1),
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          if (index >= cart.items.length) {
                            return _suggestionsSection(cart, cs, tt);
                          }
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

  /// "مقترحات لك" — كورسات من نفس المنصة غير الموجودة في السلة.
  Widget _suggestionsSection(CartProvider cart, ColorScheme cs, TextTheme tt) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 8),
        Row(
          children: [
            Icon(Icons.auto_awesome_rounded, size: 18, color: cs.primary),
            const SizedBox(width: 6),
            Text(
              'مقترحات لك',
              style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 196,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: cart.suggestions.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, i) {
              final s = cart.suggestions[i];
              final id = (s['id'] as num?)?.toInt() ?? 0;
              final title = s['title_ar']?.toString() ?? '';
              final image = s['image_url']?.toString() ?? '';
              final price = (s['price'] as num?)?.toDouble() ?? 0;
              return SizedBox(
                width: 168,
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppNetworkImage(
                        imageUrl: image,
                        width: 168,
                        height: 86,
                        borderRadius: BorderRadius.zero,
                      ),
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: tt.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              price > 0 ? '${price.toInt()} ج.م' : 'مجاناً',
                              style: tt.labelSmall?.copyWith(
                                color: cs.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                        child: SizedBox(
                          width: double.infinity,
                          child: FilledButton.tonal(
                            onPressed: id == 0
                                ? null
                                : () async {
                                    final ok = await cart.addToCart(id);
                                    if (!ok) return;
                                    cart.fetchSuggestions();
                                  },
                            style: FilledButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                            ),
                            child: const Text('أضف للسلة', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
