import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/order_model.dart';
import '../storage/cache_service.dart';

class OrdersProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<OrderModel> _myOrders = [];
  bool _isLoading = false;
  String? _error;

  OrdersProvider() {
    _loadFromCache();
  }

  Future<void> _loadFromCache() async {
    try {
      final cached = await CacheService.load(CacheService.keyMyOrders);
      if (cached is List && cached.isNotEmpty) {
        _myOrders = cached
            .whereType<Map>()
            .map((o) => OrderModel.fromJson(Map<String, dynamic>.from(o)))
            .toList();
        notifyListeners();
      }
    } catch (_) {}
  }

  List<OrderModel> get myOrders => _myOrders;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Active / Enrolled paid courses count
  int get activeCoursesCount => _myOrders.where((o) => o.isPaid).length;

  Future<void> fetchMyOrders({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final res = await _api.get(ApiConstants.myOrders);
      if (res.statusCode == 200 && res.data is List) {
        final list = res.data as List;
        _myOrders = list
            .whereType<Map>()
            .map((item) => OrderModel.fromJson(Map<String, dynamic>.from(item)))
            .toList();
        CacheService.save(CacheService.keyMyOrders, res.data);
        _error = null;
      }
    } catch (e) {
      if (_myOrders.isEmpty) {
        _error = 'فشل تحميل الاشتراكات السابقة';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Order detail
  Future<OrderModel?> fetchOrder(int orderId) async {
    try {
      final res = await _api.get('${ApiConstants.myOrders}/$orderId');
      if (res.statusCode == 200 && res.data != null && res.data is Map) {
        return OrderModel.fromJson(Map<String, dynamic>.from(res.data as Map));
      }
    } catch (_) {}
    return null;
  }

  // ── Create order (one or more courses) ─────────────────────────────────────
  /// Creates a booking with one or more courses. Returns the new order id on success.
  /// The total `amount` must come from the server/course prices, never computed client-side.
  Future<int?> createOrder({
    required List<int> courseIds,
    String? paymentMethod,
    String? noteStudent,
    String? senderPhone,
    String? receiptUrl,
  }) async {
    try {
      final res = await _api.post(
        ApiConstants.orders,
        data: {
          'items': courseIds.map((id) => {'course_id': id}).toList(),
          // Legacy single-course fields kept for backward compatibility
          if (courseIds.length == 1) 'course_id': courseIds.first,
          if (paymentMethod != null) 'payment_method': paymentMethod,
          if (noteStudent != null) 'note_student': noteStudent,
          if (senderPhone != null) 'sender_phone': senderPhone,
          if (receiptUrl != null) 'receipt_url': receiptUrl,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = res.data;
        if (data is Map && data['id'] != null) {
          final id = (data['id'] as num).toInt();
          await fetchMyOrders(silent: true);
          return id;
        }
        await fetchMyOrders(silent: true);
        return null;
      } else if (res.statusCode == 409 && res.data is Map) {
        // Surface the server conflict message (paid course / open order)
        final err = res.data as Map;
        throw Exception(err['error'] ?? 'لا يمكن إنشاء الحجز حالياً');
      }
    } catch (e) {
      rethrow;
    }
    return null;
  }

  // ── Pay order (choose payment method / send receipt) ───────────────────────
  /// `method`: 'cash' or 'digital'. Digital requires `receiptUrl` + `senderPhone`.
  Future<bool> payOrder({
    required int orderId,
    required String method,
    String? senderPhone,
    String? receiptUrl,
    String? noteStudent,
  }) async {
    try {
      final res = await _api.patch(
        '${ApiConstants.orders}/$orderId/pay',
        data: {
          'payment_method': method,
          if (senderPhone != null) 'sender_phone': senderPhone,
          if (receiptUrl != null) 'receipt': receiptUrl,
          if (noteStudent != null) 'note_student': noteStudent,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchMyOrders(silent: true);
        return true;
      }
      if (res.statusCode == 409 || res.statusCode == 413 && res.data is Map) {
        final err = res.data as Map;
        throw Exception(err['error'] ?? 'فشل الدفع، حاول مرة أخرى');
      }
    } catch (e) {
      rethrow;
    }
    return false;
  }

  // ── Cancel own unpaid booking ──────────────────────────────────────────────
  Future<bool> cancelOrder(int orderId) async {
    try {
      final res = await _api.patch('${ApiConstants.orders}/$orderId/cancel');
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchMyOrders(silent: true);
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Remove one course from own unpaid order ────────────────────────────────
  Future<bool> removeOrderItem(int orderId, int courseId) async {
    try {
      final res = await _api.delete(
          '${ApiConstants.orders}/$orderId/items/$courseId');
      if (res.statusCode == 200 || res.statusCode == 204) {
        await fetchMyOrders(silent: true);
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Checkout requirements (missing fields before payment step) ─────────────
  /// Returns `{ missing_fields:[{key,label}] }`. Null if the endpoint is unavailable or errors.
  Future<List<Map<String, dynamic>>?> checkoutRequirements() async {
    try {
      final res = await _api.get(ApiConstants.checkoutRequirements);
      if (res.statusCode == 200 && res.data is Map) {
        final data = Map<String, dynamic>.from(res.data as Map);
        final raw = data['missing_fields'];
        if (raw is List) {
          return raw
              .whereType<Map>()
              .map((i) => Map<String, dynamic>.from(i))
              .toList();
        }
      }
    } catch (_) {}
    return null;
  }

  // ── Payment methods ────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>?> paymentMethods() async {
    try {
      final res = await _api.get(ApiConstants.paymentMethods);
      if (res.statusCode == 200 && res.data is List) {
        return (res.data as List)
            .whereType<Map>()
            .map((i) => Map<String, dynamic>.from(i))
            .toList();
      }
    } catch (_) {}
    return null;
  }
}
