import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/order_model.dart';
import '../storage/cache_service.dart';
import '../utils/json_utils.dart';

/// A freshly created booking. `amount` comes from the server response.
class CreatedOrder {
  final int id;
  final double amount;
  final String status;

  const CreatedOrder({required this.id, required this.amount, required this.status});
}

/// The server refused a booking because a course is already paid or inside an
/// open booking (HTTP 409). The message is the backend's Arabic text.
class OrderConflictException implements Exception {
  final String message;
  final int? courseId;
  final String? status;

  const OrderConflictException(this.message, {this.courseId, this.status});

  bool get isPaid => status == 'paid';

  @override
  String toString() => message;
}

/// What the current student can do with one course.
class CourseAccess {
  final bool paid;
  final bool hasCertificate;
  final String? serialId;
  final OrderModel? openOrder;

  const CourseAccess({
    required this.paid,
    this.hasCertificate = false,
    this.serialId,
    this.openOrder,
  });

  bool get hasOpenBooking => openOrder != null;
}

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
        _myOrders = toJsonList(cached).map(OrderModel.fromJson).toList();
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
        _myOrders = toJsonList(res.data).map(OrderModel.fromJson).toList();
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
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        return OrderModel.fromJson(data);
      }
    } catch (_) {}
    return null;
  }

  // ── Create order (one or more courses) ─────────────────────────────────────
  /// Creates a booking with one or more courses. Returns the new order on
  /// success. `amount` must come from the server, never computed client-side.
  /// Throws [OrderConflictException] when a course is already paid or inside an
  /// open booking (the server answers 409).
  Future<CreatedOrder?> createOrder({
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
      final data = toJsonMap(res.data);
      final id = data == null ? null : toIntOrNull(data['id']);
      await fetchMyOrders(silent: true);
      if (id == null) return null;
      return CreatedOrder(
        id: id,
        amount: data == null ? 0 : toDouble(data['amount']),
        status: data == null ? 'pending' : toStr(data['status'], 'pending'),
      );
    } on DioException catch (e) {
      final data = toJsonMap(e.response?.data);
      final status = e.response?.statusCode;
      final message = toStrOrNull(data?['error']);
      if (status == 409) {
        throw OrderConflictException(
          message ?? 'هذا الكورس مدفوع بالفعل أو داخل طلب مفتوح',
          courseId: data == null ? null : toIntOrNull(data['course_id']),
          status: data == null ? null : toStrOrNull(data['status']),
        );
      }
      throw Exception(message ?? 'تعذر الاتصال بالخادم، حاول مرة أخرى');
    }
  }

  /// Course state for the student: paid (enrolled), an open booking, or none.
  /// Returns null when the state could not be read from the server.
  Future<CourseAccess?> fetchCourseAccess(int courseId) async {
    try {
      final checkRes = await _api.get('${ApiConstants.myOrders}/check/$courseId');
      final check = toJsonMap(checkRes.data);
      if (check == null) return null;
      final paid = toBool(check['hasPaidOrder']);
      OrderModel? openOrder;
      if (!paid) {
        final res = await _api.get(ApiConstants.myOrders);
        if (res.statusCode == 200) {
          for (final order in toJsonList(res.data).map(OrderModel.fromJson)) {
            if (!order.isOpen) continue;
            final hasCourse = order.items.any((i) => i.courseId == courseId) ||
                order.courseId == courseId;
            if (hasCourse) {
              openOrder = order;
              break;
            }
          }
        }
      }
      return CourseAccess(
        paid: paid,
        hasCertificate: toBool(check['hasCertificate']),
        serialId: toStrOrNull(check['serialId']),
        openOrder: openOrder,
      );
    } catch (e) {
      debugPrint('[ORDERS] course access error: $e');
      return null;
    }
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
    } on DioException catch (e) {
      final err = toJsonMap(e.response?.data);
      throw Exception(toStrOrNull(err?['error']) ?? 'فشل الدفع، حاول مرة أخرى');
    }
    return false;
  }

  // ── Treasury receipt upload ────────────────────────────────────────────────
  /// Uploads the cash receipt photo taken at the treasury. The order moves to
  /// `review` until an admin approves it from the dashboard.
  Future<bool> uploadReceipt({
    required int orderId,
    required String receiptUrl,
  }) async {
    try {
      final res = await _api.patch(
        '${ApiConstants.orders}/$orderId/receipt',
        data: {'receipt_url': receiptUrl},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchMyOrders(silent: true);
        return true;
      }
    } on DioException catch (e) {
      final err = toJsonMap(e.response?.data);
      throw Exception(
        toStrOrNull(err?['error']) ?? 'فشل رفع الإيصال، حاول مرة أخرى',
      );
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
      if (res.statusCode == 200) {
        final data = toJsonMap(res.data);
        if (data != null && data['missing_fields'] is List) {
          return toJsonList(data['missing_fields']);
        }
      }
    } catch (_) {}
    return null;
  }

  // ── Payment methods ────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>?> paymentMethods() async {
    try {
      final res = await _api.get(ApiConstants.paymentMethods);
      if (res.statusCode == 200) {
        return toJsonList(res.data);
      }
    } catch (_) {}
    return null;
  }
}
