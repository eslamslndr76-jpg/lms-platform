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

  // Create order directly
  Future<bool> createOrder({
    required int courseId,
    required double amount,
    String? paymentMethod,
    String? receiptUrl,
  }) async {
    try {
      final res = await _api.post(
        ApiConstants.orders,
        data: {
          'course_id': courseId,
          'amount': amount,
          'payment_method': paymentMethod ?? 'cash',
          if (receiptUrl != null) 'receipt_url': receiptUrl,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchMyOrders(silent: true);
        return true;
      }
    } catch (_) {}
    return false;
  }
}
