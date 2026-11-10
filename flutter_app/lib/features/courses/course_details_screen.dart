import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/courses/courses_provider.dart';
import '../../core/cart/cart_provider.dart';
import '../../core/models/course_model.dart';
import '../../shared/widgets/app_network_image.dart';
import '../cart/cart_screen.dart';

class CourseDetailsScreen extends StatefulWidget {
  final int courseId;

  const CourseDetailsScreen({super.key, required this.courseId});

  @override
  State<CourseDetailsScreen> createState() => _CourseDetailsScreenState();
}

class _CourseDetailsScreenState extends State<CourseDetailsScreen> {
  CourseModel? _course;
  bool _isLoading = true;
  bool _isAddingToCart = false;

  @override
  void initState() {
    super.initState();
    _loadCourse();
  }

  Future<void> _loadCourse() async {
    // 1. Try to initialize from cached/in-memory courses immediately so screen loads instantly
    try {
      final existing = context
          .read<CoursesProvider>()
          .allCourses
          .where((c) => c.id == widget.courseId)
          .firstOrNull;
      if (existing != null && mounted) {
        setState(() {
          _course = existing;
          _isLoading = false;
        });
      }
    } catch (_) {}

    if (_course == null) {
      setState(() => _isLoading = true);
    }

    try {
      final fetched = await context.read<CoursesProvider>().fetchCourseDetails(widget.courseId);
      if (mounted) {
        setState(() {
          if (fetched != null) _course = fetched;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted && _course == null) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleAddToCart() async {
    if (_course == null || _isAddingToCart) return;
    setState(() => _isAddingToCart = true);

    final cart = context.read<CartProvider>();
    final success = await cart.addToCart(_course!.id);

    if (!mounted) return;
    setState(() => _isAddingToCart = false);

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('تمت إضافة الكورس إلى السلة بنجاح!'),
          action: SnackBarAction(
            label: 'عرض السلة',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            },
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(cart.error ?? 'فشل إضافة الكورس إلى السلة'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('تفاصيل الدورة'),
        actions: [
          IconButton(
            icon: const Icon(Icons.shopping_cart_outlined),
            tooltip: 'السلة',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _course == null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline_rounded, size: 48, color: cs.error),
                      const SizedBox(height: 12),
                      const Text('تعذر تحميل بيانات الكورس'),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _loadCourse,
                        child: const Text('إعادة المحاولة'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.only(bottom: 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // ── Header Image ──────────────────────────────
                            AspectRatio(
                              aspectRatio: 16 / 9,
                              child: AppNetworkImage(
                                imageUrl: _course!.image,
                              ),
                            ),

                            Padding(
                              padding: const EdgeInsets.all(20),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Category Badge
                                  if (_course!.categoryNameAr != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: cs.primaryContainer,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        _course!.categoryNameAr!,
                                        style: TextStyle(
                                          color: cs.onPrimaryContainer,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 12),

                                  // Title
                                  Text(
                                    _course!.titleAr,
                                    style: tt.headlineSmall?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  const SizedBox(height: 16),

                                  // Metadata cards row
                                  Row(
                                    children: [
                                      Expanded(
                                        child: _MetaItem(
                                          icon: Icons.person_outline_rounded,
                                          title: 'المدرب',
                                          value: _course!.instructor ?? 'غير محدد',
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: _MetaItem(
                                          icon: Icons.schedule_rounded,
                                          title: 'مدة التدريب',
                                          value: '${_course!.hours ?? 0} ساعة',
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 20),

                                  // Group Seats status (if available)
                                  if (_course!.groupMax != null && _course!.groupMax! > 0) ...[
                                    Card(
                                      color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
                                      child: Padding(
                                        padding: const EdgeInsets.all(16),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Text(
                                                  'حالة المقاعد في المجموعة الحالية',
                                                  style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                                                ),
                                                Text(
                                                  _course!.isFull
                                                      ? 'مكتمل'
                                                      : '${((_course!.fillRate * 100).toInt()).clamp(0, 100)}%',
                                                  style: TextStyle(
                                                    fontWeight: FontWeight.w700,
                                                    color: _course!.isFull ? cs.error : cs.primary,
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 8),
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(4),
                                              child: LinearProgressIndicator(
                                                value: _course!.fillRate.clamp(0.0, 1.0),
                                                minHeight: 8,
                                                backgroundColor: cs.surfaceContainerHighest,
                                                valueColor: AlwaysStoppedAnimation<Color>(
                                                  _course!.isFull ? cs.error : cs.primary,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'تم حجز ${_course!.groupCurrent ?? 0} مقعد من أصل ${_course!.groupMax}',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: cs.onSurfaceVariant,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 20),
                                  ],

                                  // Description Section
                                  Text(
                                    'عن الدورة التدريبية',
                                    style: tt.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    (_course!.descriptionAr != null &&
                                            _course!.descriptionAr!.trim().isNotEmpty)
                                        ? _course!.descriptionAr!
                                        : 'دورة تدريبية متكاملة تهدف إلى تزويد المتدربين بالمهارات العملية والنظرية اللازمة لسوق العمل الحديث.',
                                    style: tt.bodyMedium?.copyWith(
                                      height: 1.6,
                                      color: cs.onSurfaceVariant,
                                    ),
                                  ),

                                  // Scientific material (enrolled students / staff only —
                                  // the API only returns materials_url to those callers)
                                  if (_course!.materialsUrl != null) ...[
                                    const SizedBox(height: 20),
                                    OutlinedButton.icon(
                                      onPressed: () async {
                                        final uri = Uri.tryParse(_course!.materialsUrl!);
                                        if (uri == null) return;
                                        final ok = await launchUrl(uri,
                                            mode: LaunchMode.externalApplication);
                                        if (!ok && context.mounted) {
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            const SnackBar(
                                                content: Text('تعذر فتح رابط المادة العلمية')),
                                          );
                                        }
                                      },
                                      icon: const Icon(Icons.menu_book_rounded),
                                      label: const Text('المادة العلمية للدورة'),
                                      style: OutlinedButton.styleFrom(
                                        minimumSize: const Size.fromHeight(48),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // ── Sticky Bottom Bar ─────────────────────────────────
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      decoration: BoxDecoration(
                        color: cs.surface,
                        border: Border(
                          top: BorderSide(color: cs.outlineVariant, width: 1),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,
                            offset: const Offset(0, -4),
                          ),
                        ],
                      ),
                      child: SafeArea(
                        child: Row(
                          children: [
                            // Price
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'رسوم الاشتراك',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: cs.onSurfaceVariant,
                                  ),
                                ),
                                Text(
                                  _course!.price > 0 ? '${_course!.price.toInt()} ج.م' : 'مجاناً',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                    color: cs.primary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(width: 20),

                            // Add to cart button
                            Expanded(
                              child: Consumer<CartProvider>(
                                builder: (context, cart, _) {
                                  final inCart = cart.isInCart(_course!.id);
                                  return FilledButton.icon(
                                    onPressed: (_isAddingToCart || inCart)
                                        ? () {
                                            Navigator.of(context).push(
                                              MaterialPageRoute(builder: (_) => const CartScreen()),
                                            );
                                          }
                                        : _handleAddToCart,
                                    icon: _isAddingToCart
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : Icon(inCart ? Icons.check_circle_rounded : Icons.shopping_cart_outlined),
                                    label: Text(inCart ? 'في السلة — إتمام الطلب' : 'إضافة إلى السلة'),
                                  );
                                },
                              ),
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

class _MetaItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const _MetaItem({
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: cs.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
                ),
                Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
