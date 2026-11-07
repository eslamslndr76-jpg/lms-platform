import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';

/// Top-level handler for background/terminated FCM messages (required by Firebase).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  await FcmService._showFromRemoteMessage(message);
}

class FcmService {
  FcmService._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static const _channelId = 'training_fcm_channel';
  static const _channelName = 'وحدة التدريب – إشعارات فورية';

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

    final channel = const AndroidNotificationChannel(
      _channelId,
      _channelName,
      importance: Importance.max,
      enableLights: true,
      enableVibration: true,
    );
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Request permission (Android 13+)
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Register background handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Foreground messages → show local notification
    FirebaseMessaging.onMessage.listen((msg) => _showFromRemoteMessage(msg));

    // Save/refresh FCM token to backend
    await syncToken();
    messaging.onTokenRefresh.listen((token) => syncToken());
  }

  static void _onTap(NotificationResponse response) {
    // Deep link handling via AppLinks in app.dart
  }

  static Future<void> _showFromRemoteMessage(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'] as String? ?? 'إشعار جديد';
    final body = notification?.body ?? message.data['body'] as String? ?? '';
    final payload = message.data['link'] as String?;

    await _plugin.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: const AndroidNotificationDetails(
          _channelId,
          _channelName,
          importance: Importance.max,
          priority: Priority.high,
          icon: '@mipmap/launcher_icon',
        ),
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
