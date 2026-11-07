import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/cart_item_model.dart';

class CartProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CartItemModel> _items = [];
  double _total = 0.0;
  bool _isLoading = false;
  String? _error;

  List<CartItemModel> get items => _items;
  double get total => _total;
  int get count => _items.length;
  bool get isLoading => _isLoading;
  String? get error => _error;

  bool isInCart(int courseId) {
    return _items.any((item) => item.courseId == courseId);
  }

  // ── Fetch Cart ────────────────────────────────────────────────────────────
  Future<void> fetchCart({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final res = await _api.get(ApiConstants.cart);
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        final data = res.data as Map<String, dynamic>;
        final rawList = data['items'] as List? ?? [];
        _items = rawList.map((i) => CartItemModel.fromJson(i as Map<String, dynamic>)).toList();
        _total = (data['total'] as num?)?.toDouble() ?? 0.0;
        _error = null;
      }
    } catch (_) {
      _error = 'فشل تحميل محتويات السلة';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Add Item to Cart ──────────────────────────────────────────────────────
  Future<bool> addToCart(int courseId) async {
    try {
      final res = await _api.post(
        ApiConstants.cart,
        data: {'course_id': courseId},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchCart(silent: true);
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Remove Item from Cart ─────────────────────────────────────────────────
  Future<bool> removeFromCart(int cartItemId) async {
    try {
      final res = await _api.delete('${ApiConstants.cart}/$cartItemId');
      if (res.statusCode == 200) {
        _items.removeWhere((item) => item.id == cartItemId);
        _total = _items.fold(0.0, (sum, i) => sum + i.price);
        notifyListeners();
        return true;
      }
    } catch (_) {}
    return false;
  }
}
