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

    try {
      final responses = await Future.wait([
        _api.get(ApiConstants.notifications),
        _api.get(ApiConstants.unreadNotificationsCount),
      ]);

      if (responses[0].statusCode == 200 && responses[0].data is List) {
        final list = responses[0].data as List;
        _notifications = list
            .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
            .toList();
      }

      if (responses[1].statusCode == 200 && responses[1].data is Map<String, dynamic>) {
        final data = responses[1].data as Map<String, dynamic>;
        _unreadCount = (data['count'] as num?)?.toInt() ?? 0;
      }

      _error = null;
    } catch (_) {
      _error = 'تعذر تحميل الإشعارات';
    } finally {
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
