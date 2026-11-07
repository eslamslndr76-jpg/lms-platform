import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:workmanager/workmanager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

import 'core/services/local_notification_service.dart';

/// Top-level callback required by Workmanager (must be a top-level function).
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((taskName, inputData) async {
    if (taskName == 'fetchNotifications') {
      await _checkAndNotify();
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

    // Read base URL saved by main app
    final baseUrl = prefs.getString('api_base_url') ??
        'https://lms-backend-flame-seven.vercel.app';

    final res = await http
        .get(
          Uri.parse('$baseUrl/api/notifications?limit=5'),
          headers: {'Authorization': 'Bearer $token'},
        )
        .timeout(const Duration(seconds: 10));

    if (res.statusCode != 200) return;

    final List<dynamic> list = jsonDecode(res.body) as List<dynamic>;
    if (list.isEmpty) return;

    // Find notifications newer than lastSeenId
    final newOnes = list
        .whereType<Map<String, dynamic>>()
        .where((n) => (n['id'] as int? ?? 0) > lastSeenId)
        .toList();

    if (newOnes.isEmpty) return;

    await LocalNotificationService.init();

    for (final n in newOnes.take(3)) {
      await LocalNotificationService.show(
        id: n['id'] as int,
        title: n['title'] as String? ?? 'إشعار جديد',
        body: n['message'] as String? ?? '',
        payload: n['link'] as String?,
      );
    }

    // Save latest id
    final maxId = newOnes
        .map((n) => n['id'] as int? ?? 0)
        .reduce((a, b) => a > b ? a : b);
    await prefs.setInt('last_notif_id', maxId);
  } catch (_) {
    // Silent failure — background task
  }
}
