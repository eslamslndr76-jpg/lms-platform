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
  List<Map<String, dynamic>> _suggestions = [];

  List<CartItemModel> get items => _items;
  double get total => _total;
  int get count => _items.length;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get suggestions => _suggestions;

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
      if (res.statusCode == 200 && res.data != null && res.data is Map) {
        final data = Map<String, dynamic>.from(res.data as Map);
        final rawList = data['items'] as List? ?? [];
        _items = rawList
            .whereType<Map>()
            .map((i) => CartItemModel.fromJson(Map<String, dynamic>.from(i)))
            .toList();
        final rawTotal = data['total'];
        _total = rawTotal is num ? rawTotal.toDouble() : double.tryParse(rawTotal?.toString() ?? '') ?? 0.0;
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

  // ── Clear Cart ────────────────────────────────────────────────────────────
  Future<bool> clearCart() async {
    try {
      final res = await _api.delete(ApiConstants.cart);
      if (res.statusCode == 200) {
        _items = [];
        _total = 0.0;
        _suggestions = [];
        notifyListeners();
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── Suggestions ("مقترحات لك") ────────────────────────────────────────────
  Future<void> fetchSuggestions() async {
    try {
      final res = await _api.get('${ApiConstants.cart}/suggestions');
      if (res.statusCode == 200 && res.data is List) {
        _suggestions = (res.data as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        notifyListeners();
      }
    } catch (_) {
      // Silent: suggestions are secondary content, never an error screen.
    }
  }
}
