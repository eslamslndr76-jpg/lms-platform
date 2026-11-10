import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/notification_model.dart';

class NotificationsProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<NotificationModel> _notifications = [];
  int _unreadCount = 0;
  bool _isLoading = false;
  String? _error;

  List<NotificationModel> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // ── Fetch notifications & unread count ────────────────────────────────────
  Future<void> fetchNotifications({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    // Fetch list separately so one failure doesn't kill both
    try {
      final listRes = await _api.get(ApiConstants.notifications);
      if (listRes.statusCode == 200 && listRes.data is List) {
        final list = listRes.data as List;
        final parsed = <NotificationModel>[];
        for (final item in list) {
          if (item is! Map<String, dynamic>) continue;
          try {
            parsed.add(NotificationModel.fromJson(item));
          } catch (e) {
            debugPrint('[NOTIF] Skipped bad row: $e — $item');
          }
        }
        _notifications = parsed;
      } else if (!silent) {
        _error = 'فشل تحميل قائمة الإشعارات (${listRes.statusCode})';
      }
    } catch (e) {
      if (!silent) _error = 'تعذر الوصول للخادم';
      debugPrint('[NOTIF] list fetch error: $e');
    }

    // Fetch count separately
    try {
      final countRes = await _api.get(ApiConstants.unreadNotificationsCount);
      if (countRes.statusCode == 200 && countRes.data is Map<String, dynamic>) {
        _unreadCount = (countRes.data!['count'] as num?)?.toInt() ?? 0;
      }
    } catch (e) {
      debugPrint('[NOTIF] count fetch error: $e');
      // Count is non-critical; don't set _error
    }

    if (!silent) {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Mark single notification as read ──────────────────────────────────────
  Future<void> markAsRead(int id) async {
    try {
      final idx = _notifications.indexWhere((n) => n.id == id);
      if (idx != -1 && !_notifications[idx].isRead) {
        _notifications[idx] = _notifications[idx].copyWith(isRead: true);
        if (_unreadCount > 0) _unreadCount--;
        notifyListeners();
      }
      await _api.patch('${ApiConstants.notifications}/$id/read');
    } catch (_) {}
  }

  // ── Mark all notifications as read ────────────────────────────────────────
  Future<void> markAllAsRead() async {
    try {
      _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
      _unreadCount = 0;
      notifyListeners();
      await _api.patch('${ApiConstants.notifications}/read-all');
    } catch (_) {}
  }
}
