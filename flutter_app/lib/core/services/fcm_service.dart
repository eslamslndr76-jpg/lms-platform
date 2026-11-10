import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../navigation/app_navigation.dart';
import '../notifications/notifications_provider.dart';
import 'notification_channels.dart';

/// Top-level handler for background/terminated FCM messages (required by Firebase).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // If the message has a notification payload, Android OS displays it automatically in the system tray.
  // Displaying it again causes a duplicate notification! Only show if it's data-only.
  if (message.notification == null) {
    await Firebase.initializeApp();
    await FcmService._showFromRemoteMessage(message);
  }
}

class FcmService {
  FcmService._();

  static final _plugin = FlutterLocalNotificationsPlugin();

  /// Call once in main() after Firebase.initializeApp()
  static Future<void> init() async {
    // Setup local notifications channel
    const android = AndroidInitializationSettings('@mipmap/launcher_icon');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
      onDidReceiveNotificationResponse: _onTap,
    );

    // Create all notification channels
    final androidImpl = _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    if (androidImpl != null) {
      await NotificationChannels.createAll(androidImpl);
    }

    // Request permission (Android 13+)
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Register background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Foreground messages → show local notification & refresh in-app list
    FirebaseMessaging.onMessage.listen((msg) {
      _showFromRemoteMessage(msg);
      _refreshInAppNotifications();
    });

    // Background notification tap (while app was in background)
    FirebaseMessaging.onMessageOpenedApp.listen((msg) {
      _handleRemoteMessageNavigation(msg);
    });

    // Terminated notification tap (cold start)
    messaging.getInitialMessage().then((msg) {
      if (msg != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _handleRemoteMessageNavigation(msg);
        });
      }
    });

    // Save/refresh FCM token to backend
    await syncToken();
    messaging.onTokenRefresh.listen((_) => syncToken());
  }

  static void _refreshInAppNotifications() {
    try {
      final ctx = AppNavigation.navigatorKey.currentContext;
      if (ctx != null) {
        ctx.read<NotificationsProvider>().fetchNotifications(silent: true);
      }
    } catch (_) {}
  }

  static void _onTap(NotificationResponse response) {
    final payload = response.payload;
    if (payload != null && payload.isNotEmpty) {
      final parts = payload.split('|');
      final link = parts.first;
      final notifId = parts.length > 1 ? int.tryParse(parts[1]) : null;
      final groupId = parts.length > 2 ? int.tryParse(parts[2]) : null;
      final lectureId = parts.length > 3 ? int.tryParse(parts[3]) : null;
      AppNavigation.handleLink(
        link,
        notificationId: notifId,
        groupId: groupId,
        lectureId: lectureId,
      );
    }
  }

  static void _handleRemoteMessageNavigation(RemoteMessage message) {
    final link = message.data['link'] as String? ?? '/notifications';
    final notifIdStr = message.data['notificationId'] as String?;
    final notifId = int.tryParse(notifIdStr ?? '');
    final grpIdStr = message.data['groupId'] as String?;
    final groupId = int.tryParse(grpIdStr ?? '');
    final lecIdStr = message.data['lectureId'] as String?;
    final lectureId = int.tryParse(lecIdStr ?? '');

    AppNavigation.handleLink(
      link,
      notificationId: notifId,
      groupId: groupId,
      lectureId: lectureId,
    );
  }

  static Future<void> _showFromRemoteMessage(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'] as String? ?? 'إشعار جديد';
    final body = notification?.body ?? message.data['body'] as String? ?? '';
    final link = message.data['link'] as String? ?? '';
    final type = message.data['type'] as String? ?? '';
    final notifId = message.data['notificationId'] as String? ?? '';
    final groupId = message.data['groupId'] as String? ?? '';
    final lectureId = message.data['lectureId'] as String? ?? '';
    final payload = '$link|$notifId|$groupId|$lectureId';

    final channelId = NotificationChannels.channelIdFor(type: type, link: link);
    final android = NotificationChannels.detailsFor(channelId);

    await _plugin.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: android,
        iOS: const DarwinNotificationDetails(),
      ),
      payload: payload,
    );
  }

  /// Syncs current device FCM token to backend for authenticated user.
  static Future<void> syncToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await ApiClient().post('/api/notifications/fcm-token', data: {'token': token});
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('fcm_token', token);
      }
    } catch (_) {
      // Ignored if user not yet logged in (401)
    }
  }
}
