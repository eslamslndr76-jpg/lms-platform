import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/notifications/notifications_provider.dart';
import '../../core/models/notification_model.dart';
import '../../core/navigation/app_navigation.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _filter = 'all'; // 'all' | 'unread'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationsProvider>().fetchNotifications(silent: true);
    });
  }

  String _formatRelativeTime(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return '';
    try {
      final iso = dateStr.contains('T') ? dateStr : '${dateStr.replaceAll(' ', 'T')}Z';
      final dt = DateTime.parse(iso).toLocal();
      final diff = DateTime.now().difference(dt);

      if (diff.inSeconds < 60) return 'الآن';
      if (diff.inMinutes < 60) {
        final m = diff.inMinutes;
        return m == 1 ? 'منذ دقيقة' : m == 2 ? 'منذ دقيقتين' : 'منذ $m دقائق';
      }
      if (diff.inHours < 24) {
        final h = diff.inHours;
        return h == 1 ? 'منذ ساعة' : h == 2 ? 'منذ ساعتين' : 'منذ $h ساعات';
      }
      final d = diff.inDays;
      if (d == 1) return 'منذ يوم';
      if (d == 2) return 'منذ يومين';
      if (d < 10) return 'منذ $d أيام';
      return '${dt.year}/${dt.month}/${dt.day}';
    } catch (_) {
      return dateStr.split('T').first;
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final provider = context.watch<NotificationsProvider>();

    final allItems = provider.notifications;
    final unreadItems = allItems.where((n) => !n.isRead).toList();
    final displayedItems = _filter == 'unread' ? unreadItems : allItems;

    return Scaffold(
      appBar: AppBar(
        title: const Text('مركز وسجل الإشعارات'),
        actions: [
          if (provider.unreadCount > 0)
            TextButton.icon(
              onPressed: () => provider.markAllAsRead(),
              icon: const Icon(Icons.done_all_rounded, size: 18),
              label: const Text('قراءة الكل'),
            ),
        ],
      ),
      body: Column(
        children: [
          // ── Filter Chips Bar ──────────────────────────────────────────
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: cs.surface,
              border: Border(
                bottom: BorderSide(
                  color: cs.outlineVariant.withValues(alpha: 0.3),
                  width: 1,
                ),
              ),
            ),
            child: Row(
              children: [
                ChoiceChip(
                  label: Text('الكل (${allItems.length})'),
                  selected: _filter == 'all',
                  onSelected: (val) {
                    if (val) setState(() => _filter = 'all');
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: Text('غير مقروءة (${provider.unreadCount})'),
                  selected: _filter == 'unread',
                  onSelected: (val) {
                    if (val) setState(() => _filter = 'unread');
                  },
                ),
              ],
            ),
          ),

          // ── Notifications List ────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => provider.fetchNotifications(silent: true),
              child: provider.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : provider.error != null
                      ? _ErrorView(
                          message: provider.error!,
                          onRetry: () => provider.fetchNotifications(silent: false),
                        )
                      : displayedItems.isEmpty
                          ? _EmptyView(filter: _filter)
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: displayedItems.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (context, index) {
                                final item = displayedItems[index];
                                return _NotificationCard(
                                  notification: item,
                                  timeText: _formatRelativeTime(item.createdAt),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  final NotificationModel notification;
  final String timeText;

  const _NotificationCard({
    required this.notification,
    required this.timeText,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    IconData icon;
    Color iconColor;

    switch (notification.type) {
      case 'success':
        icon = Icons.check_circle_rounded;
        iconColor = Colors.green.shade700;
        break;
      case 'warning':
        icon = Icons.warning_rounded;
        iconColor = cs.error;
        break;
      case 'info':
      default:
        icon = Icons.notifications_active_rounded;
        iconColor = cs.primary;
        break;
    }

    final hasLink = notification.link != null && notification.link!.isNotEmpty;

    return Card(
      elevation: notification.isRead ? 0 : 2,
      color: notification.isRead
          ? cs.surfaceContainerLow
          : cs.primaryContainer.withValues(alpha: 0.35),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: notification.isRead
              ? cs.outlineVariant.withValues(alpha: 0.3)
              : cs.primary.withValues(alpha: 0.4),
          width: notification.isRead ? 1 : 1.5,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          // 1. Mark as read immediately
          if (!notification.isRead) {
            context.read<NotificationsProvider>().markAsRead(notification.id);
          }
          // 2. Navigate directly to the target feature/screen
          if (hasLink) {
            AppNavigation.handleLink(
              notification.link!,
              notificationId: notification.id,
            );
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon Badge
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),

              // Text Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            style: tt.titleSmall?.copyWith(
                              fontWeight: notification.isRead ? FontWeight.w600 : FontWeight.w900,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (!notification.isRead)
                          Container(
                            width: 9,
                            height: 9,
                            decoration: BoxDecoration(
                              color: cs.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    if (notification.message != null && notification.message!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        notification.message!,
                        style: tt.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                          height: 1.45,
                          fontSize: 13,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        if (timeText.isNotEmpty)
                          Row(
                            children: [
                              Icon(
                                Icons.access_time_rounded,
                                size: 13,
                                color: cs.onSurfaceVariant.withValues(alpha: 0.7),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                timeText,
                                style: TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w600,
                                  color: cs.onSurfaceVariant.withValues(alpha: 0.8),
                                ),
                              ),
                            ],
                          ),
                        if (hasLink)
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'عرض التفاصيل',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: cs.primary,
                                ),
                              ),
                              const SizedBox(width: 2),
                              Icon(
                                Icons.arrow_forward_ios_rounded,
                                size: 12,
                                color: cs.primary,
                              ),
                            ],
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Error view with retry button — shown when fetch fails but cached data may exist.
class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: cs.errorContainer.withValues(alpha: 0.3),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.error_outline_rounded,
                size: 64,
                color: cs.error,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'تعذر تحميل الإشعارات',
              style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: cs.error),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
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

/// Empty state view — shown when there are genuinely no notifications.
class _EmptyView extends StatelessWidget {
  final String filter;

  const _EmptyView({required this.filter});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final isUnread = filter == 'unread';

    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
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
              child: Icon(
                Icons.notifications_none_rounded,
                size: 64,
                color: cs.primary,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isUnread ? 'لا توجد إشعارات غير مقروءة' : 'سجل الإشعارات فارغ حالياً',
              style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              isUnread
                  ? 'لقد اطلعت على جميع الإشعارات والتنبيهات بنجاح.'
                  : 'ستظهر هنا كافة الإشعارات الواردة، مثل فتح باب الحضور، المجموعات الجديدة، والمحاضرات.',
              textAlign: TextAlign.center,
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
