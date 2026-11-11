import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/notification_model.dart';
import '../utils/json_utils.dart';

class NotificationsProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  /// One page of the notification center. The API defaults to 20 rows; asking
  /// for a larger page keeps the counter and the visible list in agreement.
  static const int _pageSize = 100;

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
      final listRes = await _api.get(
        ApiConstants.notifications,
        params: {'limit': _pageSize},
      );
      if (listRes.statusCode == 200 && listRes.data is List) {
        final list = listRes.data as List;
        final parsed = <NotificationModel>[];
        for (final item in list) {
          final map = toJsonMap(item);
          if (map == null) continue;
          try {
            parsed.add(NotificationModel.fromJson(map));
          } catch (_) {
            // One unreadable row must not hide the others. The parse helpers
            // tolerate stringly-typed numbers, so this should never trigger;
            // if every row fails the error state below is shown instead.
          }
        }

        if (list.isNotEmpty && parsed.isEmpty) {
          // The server sent rows but none could be read: show an error, not an
          // empty-state screen.
          _error = 'تعذر قراءة الإشعارات الواردة، أعد المحاولة';
        } else {
          _notifications = parsed;
          // Fallback for the counter while the dedicated endpoint is pending:
          // same source (the list itself), so both never disagree.
          _unreadCount = parsed.where((n) => !n.isRead).length;
          _error = null;
        }
      } else {
        _error = 'فشل تحميل قائمة الإشعارات (${listRes.statusCode})';
      }
    } catch (e) {
      _error = 'تعذر تحميل الإشعارات، تحقق من اتصالك وحاول مرة أخرى';
      debugPrint('[NOTIF] list fetch error: $e');
    }

    // Fetch count separately. The endpoint takes precedence because it covers
    // rows beyond the requested page; the list-derived value stays as fallback.
    try {
      final countRes = await _api.get(ApiConstants.unreadNotificationsCount);
      if (countRes.statusCode == 200) {
        final map = toJsonMap(countRes.data);
        final count = map == null ? null : toIntOrNull(map['count']);
        if (count != null) _unreadCount = count;
      }
    } catch (e) {
      debugPrint('[NOTIF] count fetch error: $e');
      // Count is non-critical; don't set _error
    }
    _isLoading = false;
    notifyListeners();
  }

  // ── Mark single notification as read ──────────────────────────────────────
  Future<void> markAsRead(int id) async {
    final idx = _notifications.indexWhere((n) => n.id == id);
    final wasUnread = idx != -1 && !_notifications[idx].isRead;
    if (wasUnread) {
      _notifications[idx] = _notifications[idx].copyWith(isRead: true);
      if (_unreadCount > 0) _unreadCount--;
      notifyListeners();
    }
    try {
      await _api.patch('${ApiConstants.notifications}/$id/read');
    } catch (e) {
      debugPrint('[NOTIF] markAsRead($id) failed: $e');
      // Revert the optimistic update so the counter never lies.
      if (wasUnread && idx != -1 && idx < _notifications.length) {
        _notifications[idx] = _notifications[idx].copyWith(isRead: false);
        _unreadCount++;
        notifyListeners();
      }
    }
  }

  // ── Mark all notifications as read ────────────────────────────────────────
  Future<void> markAllAsRead() async {
    final previous = _notifications;
    final previousCount = _unreadCount;
    _notifications = _notifications.map((n) => n.copyWith(isRead: true)).toList();
    _unreadCount = 0;
    notifyListeners();
    try {
      await _api.patch('${ApiConstants.notifications}/read-all');
    } catch (e) {
      debugPrint('[NOTIF] markAllAsRead failed: $e');
      _notifications = previous;
      _unreadCount = previousCount;
      notifyListeners();
    }
  }
}
