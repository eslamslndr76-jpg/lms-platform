import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:workmanager/workmanager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

import 'core/services/local_notification_service.dart';
import 'core/services/app_update_service.dart';
import 'core/utils/json_utils.dart';

/// Top-level callback required by Workmanager (must be a top-level function).
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    switch (taskName) {
      case 'fetchNotifications':
        await _checkAndNotify();
        break;
      case 'checkAppUpdate':
        await _checkAndNotifyUpdate();
        break;
      default:
        return Future.value(false);
    }
    return true;
  });
}

Future<void> _checkAndNotify() async {
  try {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'auth_token');
    if (token == null) return;

    final prefs = await SharedPreferences.getInstance();
    final lastSeenId = prefs.getInt('last_notif_id') ?? 0;

    final baseUrl = prefs.getString('api_base_url') ??
        'https://lms-backend-flame-seven.vercel.app';

    final res = await http
        .get(
          Uri.parse('$baseUrl/api/notifications?limit=5'),
          headers: {'Authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) return;

    final decoded = jsonDecode(res.body);
    final list = decoded is List ? decoded : const [];
    if (list.isEmpty) return;

    await LocalNotificationService.init();

    final newOnes = list
        .whereType<Map>()
        .map((n) => n.cast<String, dynamic>())
        .where((n) => toInt(n['id']) > lastSeenId)
        .toList();
    if (newOnes.isEmpty) return;

    for (final n in newOnes.take(3)) {
      await LocalNotificationService.show(
        id: toInt(n['id']),
        title: toStrOrNull(n['title']) ?? 'إشعار جديد',
        body: toStr(n['message']),
        payload: toStrOrNull(n['link']),
        type: toStrOrNull(n['type']),
      );
    }

    final maxId = newOnes.map((n) => toInt(n['id'])).reduce((a, b) => a > b ? a : b);
    await prefs.setInt('last_notif_id', maxId);
  } catch (_) {
    // Silent failure — background task
  }
}

/// Background check for a newer app version (once every N hours / respecting the
/// 15-minute min interval). Not repeated for the same version.
Future<void> _checkAndNotifyUpdate() async {
  try {
    const storage = FlutterSecureStorage();
    final token = await storage.read(key: 'auth_token');
    if (token == null) return;

    final prefs = await SharedPreferences.getInstance();
    final lastChecked = prefs.getInt('app_update_last_check') ?? 0;
    final storedVersion = prefs.getString('app_update_latest_version') ?? '';
    final buildNumber = await AppUpdateService.currentBuildNumber;

    final now = DateTime.now().millisecondsSinceEpoch;
    // Respect 15-minute minimum between checks
    if (now - lastChecked < 15 * 60 * 1000) return;

    final baseUrl = prefs.getString('api_base_url') ??
        'https://lms-backend-flame-seven.vercel.app';
    final res = await http
        .get(
          Uri.parse('$baseUrl/api/settings/app-version'),
          headers: {'Authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));
    if (res.statusCode != 200) return;

    final data = toJsonMap(jsonDecode(res.body));
    final latestBuild = data == null ? 0 : toInt(data['buildNumber']);

    if (latestBuild > buildNumber) {
      // Avoid spamming for the same version
      final latestVersion = data == null ? '' : toStr(data['latestVersion']);
      if (latestVersion == storedVersion) return;

      await LocalNotificationService.init();
      await LocalNotificationService.show(
        id: 9999,
        title: 'تحديث جديد متوفر 🚀',
        body: 'الإصدار $latestVersion متاح الآن للتحميل والتثبيت',
        type: 'update',
      );
      await prefs.setString('app_update_latest_version', latestVersion);
    }

    await prefs.setInt('app_update_last_check', now);
  } catch (_) {
    // Silent failure — background task
  }
}
