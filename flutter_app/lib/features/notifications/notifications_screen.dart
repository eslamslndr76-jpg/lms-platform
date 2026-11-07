import '../../core/navigation/app_navigation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/notifications/notifications_provider.dart';
import '../../core/models/notification_model.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final provider = context.watch<NotificationsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('مركز الإشعارات'),
        actions: [
          if (provider.unreadCount > 0)
            TextButton(
              onPressed: () => provider.markAllAsRead(),
              child: const Text('تحديد الكل كمقروء'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => provider.fetchNotifications(silent: true),
        child: provider.isLoading
            ? const Center(child: CircularProgressIndicator())
            : provider.notifications.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.notifications_none_rounded,
                            size: 72,
                            color: cs.onSurfaceVariant.withValues(alpha: 0.4),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'لا توجد إشعارات حالياً',
                            style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'ستصلك هنا كافة التنبيهات بخصوص مواعيد المحاضرات وفتح باب الحضور وتأكيد الاشتراكات.',
                            textAlign: TextAlign.center,
                            style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: provider.notifications.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final item = provider.notifications[index];
                      return _NotificationTile(notification: item);
                    },
                  ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationModel notification;

  const _NotificationTile({required this.notification});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    IconData icon;
    Color iconColor;

    switch (notification.type) {
      case 'success':
        icon = Icons.check_circle_rounded;
        iconColor = cs.primary;
        break;
      case 'warning':
        icon = Icons.warning_rounded;
        iconColor = cs.error;
        break;
      case 'info':
      default:
        icon = Icons.info_rounded;
        iconColor = cs.tertiary;
        break;
    }

    return Card(
      color: notification.isRead
          ? cs.surfaceContainerLow
          : cs.primaryContainer.withValues(alpha: 0.35),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          if (!notification.isRead) {
            context.read<NotificationsProvider>().markAsRead(notification.id);
          }
          if (notification.link != null && notification.link!.isNotEmpty) {
            AppNavigation.handleLink(notification.link!, notificationId: notification.id);
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

              // Content
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
                            ),
                          ),
                        ),
                        if (!notification.isRead)
                          Container(
                            width: 8,
                            height: 8,
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
                          height: 1.4,
                        ),
                      ),
                    ],
                    if (notification.createdAt != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        notification.createdAt!.split('T').first,
                        style: TextStyle(
                          fontSize: 11,
                          color: cs.onSurfaceVariant.withValues(alpha: 0.7),
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
    );
  }
}
