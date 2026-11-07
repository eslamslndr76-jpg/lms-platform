import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class CacheService {
  static const String keyCourses = 'cache_courses';
  static const String keyCategories = 'cache_categories';
  static const String keyMyOrders = 'cache_my_orders';
  static const String keyBranding = 'cache_branding';

  // ── Save JSON string ───────────────────────────────────────────────────────
  static Future<void> save(String key, dynamic data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = jsonEncode(data);
      await prefs.setString(key, str);
    } catch (_) {}
  }

  // ── Load JSON ─────────────────────────────────────────────────────────────
  static Future<dynamic> load(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final str = prefs.getString(key);
      if (str != null && str.isNotEmpty) {
        return jsonDecode(str);
      }
    } catch (_) {}
    return null;
  }

  // ── Clear all cached data (on logout) ──────────────────────────────────────
  static Future<void> clearUserCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(keyCourses);
      await prefs.remove(keyCategories);
      await prefs.remove(keyMyOrders);
    } catch (_) {}
  }
}
