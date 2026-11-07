import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/services/app_update_service.dart';
import '../../core/theme/branding_provider.dart';
import '../../core/courses/courses_provider.dart';
import '../../core/orders/orders_provider.dart';
import '../../core/cart/cart_provider.dart';
import '../../shared/widgets/course_card.dart';
import '../auth/login_screen.dart';
import '../cart/cart_screen.dart';
import '../attendance/qr_scanner_screen.dart';
import '../../core/notifications/notifications_provider.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../../shared/widgets/offline_banner_widget.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  AppUpdateInfo? _updateInfo;
  bool _updateBannerDismissed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CoursesProvider>().fetchAll(silent: true);
      context.read<OrdersProvider>().fetchMyOrders(silent: true);
      context.read<CartProvider>().fetchCart(silent: true);
      context.read<NotificationsProvider>().fetchNotifications(silent: true);
      _checkAppUpdate();
    });
  }

  Future<void> _checkAppUpdate() async {
    final info = await AppUpdateService.check();
    if (info != null && mounted) {
      setState(() => _updateInfo = info);
      AppUpdateService.showUpdatePrompt(context, info);
    }
  }

  void _navigateToTab(int index) {
    setState(() => _selectedIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final branding = context.watch<BrandingProvider>().branding;
    final cart = context.watch<CartProvider>();
    final notifications = context.watch<NotificationsProvider>();

    final pages = [
      _DashboardTab(onNavigateToCourses: () => _navigateToTab(1)),
      const _CoursesTab(),
      const _MyCoursesTab(),
      const NotificationsScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(branding.systemName),
        actions: [
          // Cart with badge
          IconButton(
            icon: Badge(
              isLabelVisible: cart.count > 0,
              label: Text('${cart.count}'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
            tooltip: 'السلة',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            },
          ),
          // Logout
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'تسجيل الخروج',
            onPressed: () async {
              final navigator = Navigator.of(context);
              await context.read<AuthProvider>().logout();
              if (!mounted) return;
              navigator.pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
          ),
        ],
      ),

      body: Column(
        children: [
          const OfflineBannerWidget(),
          if (_updateInfo != null && !_updateBannerDismissed)
            Container(
              width: double.infinity,
              color: Theme.of(context).colorScheme.primaryContainer,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Icon(
                    Icons.system_update_rounded,
                    size: 20,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'يوجد إصدار جديد من التطبيق! اضغط للتحديث',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                      ),
                    ),
                  ),
                  FilledButton.tonal(
                    onPressed: () =>
                        AppUpdateService.openDownloadPage(_updateInfo!.downloadUrl),
                    style: FilledButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                    ),
                    child: const Text('تحديث الآن', style: TextStyle(fontSize: 12)),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 18),
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    onPressed: () =>
                        setState(() => _updateBannerDismissed = true),
                    tooltip: 'إغلاق',
                  ),
                ],
              ),
            ),
          Expanded(
            child: IndexedStack(
              index: _selectedIndex,
              children: pages,
            ),
          ),
        ],
      ),

      // ── Material 3 NavigationBar ──────────────────────────────────────────
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (i) => setState(() => _selectedIndex = i),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'الرئيسية',
          ),
          const NavigationDestination(
            icon: Icon(Icons.menu_book_outlined),
            selectedIcon: Icon(Icons.menu_book_rounded),
            label: 'الكورسات',
          ),
          const NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school_rounded),
            label: 'كورساتي',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: notifications.unreadCount > 0,
              label: Text('${notifications.unreadCount}'),
              child: const Icon(Icons.notifications_outlined),
            ),
            selectedIcon: Badge(
              isLabelVisible: notifications.unreadCount > 0,
              label: Text('${notifications.unreadCount}'),
              child: const Icon(Icons.notifications_rounded),
            ),
            label: 'الإشعارات',
          ),
          const NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'حسابي',
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dashboard Tab
// ─────────────────────────────────────────────────────────────────────────────

class _DashboardTab extends StatelessWidget {
  final VoidCallback onNavigateToCourses;

  const _DashboardTab({required this.onNavigateToCourses});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final auth = context.watch<AuthProvider>();
    final coursesProvider = context.watch<CoursesProvider>();
    final ordersProvider = context.watch<OrdersProvider>();

    final featuredCourses = coursesProvider.allCourses.where((c) => c.featured).take(3).toList();

    return RefreshIndicator(
      onRefresh: () async {
        await Future.wait([
          context.read<CoursesProvider>().fetchAll(silent: true),
          context.read<OrdersProvider>().fetchMyOrders(silent: true),
          context.read<CartProvider>().fetchCart(silent: true),
        ]);
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Welcome Card ──────────────────────────────────────────────
            Card(
              color: cs.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'مرحباً، ${auth.user?.name ?? 'طالب'} 👋',
                                style: tt.titleLarge?.copyWith(
                                  fontWeight: FontWeight.w900,
                                  color: cs.onPrimaryContainer,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'نتمنى لك تجربة تدريبية مميزة وناجحة!',
                                style: TextStyle(
                                  color: cs.onPrimaryContainer.withValues(alpha: 0.8),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Statistics Row ────────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: _StatCard(
                    label: 'كورساتي المسجلة',
                    value: '${ordersProvider.activeCoursesCount}',
                    icon: Icons.school_rounded,
                    color: cs.secondaryContainer,
                    onColor: cs.onSecondaryContainer,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatCard(
                    label: 'الكورسات المتاحة',
                    value: '${coursesProvider.allCourses.length}',
                    icon: Icons.menu_book_rounded,
                    color: cs.tertiaryContainer,
                    onColor: cs.onTertiaryContainer,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Quick Actions ─────────────────────────────────────────────
            Text(
              'إجراءات سريعة',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.qr_code_scanner_rounded,
                    label: 'تسجيل الحضور',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const QrScannerScreen()),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.explore_outlined,
                    label: 'تصفح الكورسات',
                    onTap: onNavigateToCourses,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _QuickActionButton(
                    icon: Icons.shopping_bag_outlined,
                    label: 'السلة',
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 28),

            // ── Featured Courses ──────────────────────────────────────────
            if (featuredCourses.isNotEmpty) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'دورات تدريبية مميزة ⭐',
                    style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  TextButton(
                    onPressed: onNavigateToCourses,
                    child: const Text('عرض الكل'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...featuredCourses.map((c) => CourseCard(course: c)),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color onColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.onColor,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: onColor, size: 24),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context)
                  .textTheme
                  .headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w900, color: onColor),
            ),
            Text(label,
                style: TextStyle(color: onColor.withValues(alpha: 0.8), fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Material(
      color: cs.surfaceContainerLow,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: cs.primary, size: 26),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Courses Tab
// ─────────────────────────────────────────────────────────────────────────────

class _CoursesTab extends StatelessWidget {
  const _CoursesTab();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<CoursesProvider>();

    return Column(
      children: [
        // ── Search & Filter Header ──────────────────────────────────────────
        Container(
          color: cs.surface,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            children: [
              // Search Field
              SearchBar(
                hintText: 'ابحث عن اسم الكورس أو المدرب...',
                leading: const Icon(Icons.search_rounded),
                onChanged: (val) => provider.setSearchQuery(val),
                elevation: const WidgetStatePropertyAll(0),
                backgroundColor: WidgetStatePropertyAll(cs.surfaceContainerHighest.withValues(alpha: 0.5)),
              ),
              const SizedBox(height: 12),

              // Categories Chips
              if (provider.categories.isNotEmpty)
                SizedBox(
                  height: 38,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 8),
                        child: FilterChip(
                          label: const Text('الكل'),
                          selected: provider.selectedCategoryId == null,
                          onSelected: (_) => provider.setCategory(null),
                        ),
                      ),
                      ...provider.categories.map((cat) {
                        return Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: FilterChip(
                            label: Text(cat.nameAr),
                            selected: provider.selectedCategoryId == cat.id,
                            onSelected: (_) => provider.setCategory(cat.id),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const Divider(height: 1),

        // ── Courses List ────────────────────────────────────────────────────
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => provider.fetchAll(silent: true),
            child: provider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : provider.courses.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(32),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.search_off_rounded, size: 64, color: cs.onSurfaceVariant.withValues(alpha: 0.4)),
                              const SizedBox(height: 16),
                              Text(
                                'لا توجد كورسات مطابقة',
                                style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'جرّب تغيير كلمات البحث أو اختيار تصنيف آخر',
                                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: provider.courses.length,
                        itemBuilder: (context, index) {
                          return CourseCard(course: provider.courses[index]);
                        },
                      ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. My Courses Tab
// ─────────────────────────────────────────────────────────────────────────────

class _MyCoursesTab extends StatelessWidget {
  const _MyCoursesTab();

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final orders = context.watch<OrdersProvider>();

    return RefreshIndicator(
      onRefresh: () => orders.fetchMyOrders(silent: true),
      child: orders.isLoading
          ? const Center(child: CircularProgressIndicator())
          : orders.myOrders.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.school_outlined, size: 72, color: cs.onSurfaceVariant.withValues(alpha: 0.4)),
                        const SizedBox(height: 16),
                        Text(
                          'لم تشترك في أي دورة بعد',
                          style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'استكشف الدورات التدريبية المتاحة وسجل الآن لتطوير مهاراتك!',
                          textAlign: TextAlign.center,
                          style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: orders.myOrders.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final order = orders.myOrders[index];

                    Color statusBg;
                    Color statusFg;
                    switch (order.status) {
                      case 'paid':
                        statusBg = cs.primaryContainer;
                        statusFg = cs.onPrimaryContainer;
                        break;
                      case 'review':
                        statusBg = cs.secondaryContainer;
                        statusFg = cs.onSecondaryContainer;
                        break;
                      case 'rejected':
                        statusBg = cs.errorContainer;
                        statusFg = cs.onErrorContainer;
                        break;
                      case 'pending':
                      default:
                        statusBg = cs.surfaceContainerHighest;
                        statusFg = cs.onSurfaceVariant;
                        break;
                    }

                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    order.titleAr ?? 'دورة تدريبية',
                                    style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: statusBg,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    order.statusTextAr,
                                    style: TextStyle(
                                      color: statusFg,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            if (order.instructor != null) ...[
                              Row(
                                children: [
                                  Icon(Icons.person_outline_rounded, size: 16, color: cs.onSurfaceVariant),
                                  const SizedBox(width: 4),
                                  Text(
                                    order.instructor!,
                                    style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                            ],
                            const Divider(height: 16),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'المبلغ: ${order.amount.toInt()} ج.م',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: cs.primary,
                                  ),
                                ),
                                Text(
                                  order.createdAt != null
                                      ? order.createdAt!.split('T').first
                                      : '',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: cs.onSurfaceVariant,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}


