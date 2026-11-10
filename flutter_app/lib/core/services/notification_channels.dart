import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Centralized Android notification channels for the app.
///
/// Four channels as per phase 9:
/// - attendance: highest priority, shown immediately (QR attendance, lecture start)
/// - announcements: general announcements
/// - lectures: lecture reminders, schedule changes
/// - updates: local app update notifications (not in notification center)
class NotificationChannels {
  NotificationChannels._();

  // Channel IDs
  static const String attendance = 'training_attendance';
  static const String announcements = 'training_announcements';
  static const String lectures = 'training_lectures';
  static const String updates = 'training_updates';

  // Channel configurations
  static const Map<String, _ChannelConfig> _configs = {
    attendance: _ChannelConfig(
      name: 'الحضور والمحاضرات',
      description: 'إشعارات الحضور وبدء المحاضرات',
      importance: Importance.max,
      priority: Priority.high,
      enableLights: true,
      enableVibration: true,
      playSound: true,
    ),
    announcements: _ChannelConfig(
      name: 'الإعلانات العامة',
      description: 'إعلانات وإشعارات إدارية',
      importance: Importance.high,
      priority: Priority.high,
      enableLights: true,
      enableVibration: true,
      playSound: true,
    ),
    lectures: _ChannelConfig(
      name: 'تذكيرات المحاضرات',
      description: 'مواعيد المحاضرات والتغييرات',
      importance: Importance.high,
      priority: Priority.defaultPriority,
      enableLights: true,
      enableVibration: true,
      playSound: true,
    ),
    updates: _ChannelConfig(
      name: 'تحديثات التطبيق',
      description: 'إشعارات توفر إصدار جديد (محلية فقط)',
      importance: Importance.low,
      priority: Priority.low,
      enableLights: false,
      enableVibration: false,
      playSound: false,
    ),
  };

  /// Creates all four channels.
  static Future<void> createAll(
      AndroidFlutterLocalNotificationsPlugin plugin) async {
    for (final entry in _configs.entries) {
      final cfg = entry.value;
      await plugin.createNotificationChannel(
        AndroidNotificationChannel(
          entry.key,
          cfg.name,
          description: cfg.description,
          importance: cfg.importance,
          enableLights: cfg.enableLights,
          enableVibration: cfg.enableVibration,
          playSound: cfg.playSound,
        ),
      );
    }
  }

  /// Returns the channel ID for a given notification type/link.
  /// The backend should ideally send a 'channel' field; we infer from link.
  static String channelIdFor({
    String? type,
    String? link,
  }) {
    final t = (type ?? '').toLowerCase();
    final l = (link ?? '').toLowerCase();

    if (t.contains('attendance') ||
        l.contains('/attendance') ||
        l.contains('lecture') ||
        l.contains('lecture_start')) {
      return attendance;
    }
    if (t.contains('announcement') ||
        l.contains('announcement') ||
        l.contains('announcements')) {
      return announcements;
    }
    if (t.contains('lecture') ||
        l.contains('my-courses') ||
        l.contains('group') ||
        l.contains('schedule')) {
      return lectures;
    }
    if (t.contains('update') || l.contains('settings') || l.contains('app-version')) {
      return updates;
    }
    // Default to announcements
    return announcements;
  }

  /// Builds AndroidNotificationDetails for the given channel.
  static AndroidNotificationDetails detailsFor(String channelId) {
    final cfg = _configs[channelId] ?? _configs[announcements]!;
    return AndroidNotificationDetails(
      channelId,
      cfg.name,
      channelDescription: cfg.description,
      importance: cfg.importance,
      priority: cfg.priority,
      enableLights: cfg.enableLights,
      enableVibration: cfg.enableVibration,
      playSound: cfg.playSound,
      icon: '@mipmap/launcher_icon',
    );
  }
}

class _ChannelConfig {
  final String name;
  final String description;
  final Importance importance;
  final Priority priority;
  final bool enableLights;
  final bool enableVibration;
  final bool playSound;

  const _ChannelConfig({
    required this.name,
    required this.description,
    required this.importance,
    required this.priority,
    required this.enableLights,
    required this.enableVibration,
    required this.playSound,
  });
}