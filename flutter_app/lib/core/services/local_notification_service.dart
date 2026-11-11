import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'notification_channels.dart';

class LocalNotificationService {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    const android = AndroidInitializationSettings('ic_notification');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const settings = InitializationSettings(android: android, iOS: ios);
    await _plugin.initialize(settings,
        onDidReceiveNotificationResponse: _onTap);

    // Create all notification channels
    final androidImpl = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      await NotificationChannels.createAll(androidImpl);
    }
  }

  static void _onTap(NotificationResponse response) {
    // payload is the notification link – handled by AppLinks elsewhere
  }

  /// Shows a notification using the appropriate channel.
  /// [type] and [link] are used to infer the channel (matching backend's type field).
  static Future<void> show({
    required int id,
    required String title,
    required String body,
    String? payload,
    String? type,
    String? link,
  }) async {
    final channelId = NotificationChannels.channelIdFor(type: type, link: link);
    final android = NotificationChannels.detailsFor(channelId);
    const ios = DarwinNotificationDetails();
    final details = NotificationDetails(android: android, iOS: ios);
    await _plugin.show(id, title, body, details, payload: payload);
  }

  static Future<void> requestPermission() async {
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
  }

  /// Schedules a reminder at an exact local instant (lecture reminder, phase 14).
  /// The instant is converted to UTC before scheduling, so DST changes can't
  /// shift it.
  static Future<bool> scheduleAt({
    required int id,
    required DateTime when,
    required String title,
    required String body,
    String? payload,
    String? type,
    String? link,
  }) async {
    if (!when.isAfter(DateTime.now())) return false;
    tzdata.initializeTimeZones();
    final channelId = NotificationChannels.channelIdFor(type: type, link: link);
    final details = NotificationDetails(
      android: NotificationChannels.detailsFor(channelId),
      iOS: const DarwinNotificationDetails(),
    );
    await _plugin.zonedSchedule(
      id,
      title,
      body,
      tz.TZDateTime.from(when.toUtc(), tz.UTC),
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      payload: payload,
    );
    return true;
  }

  /// Cancels a previously scheduled reminder.
  static Future<void> cancel(int id) => _plugin.cancel(id);
}
