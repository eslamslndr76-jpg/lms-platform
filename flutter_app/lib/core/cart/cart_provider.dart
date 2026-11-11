import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/cart_item_model.dart';
import '../utils/json_utils.dart';

class CartProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CartItemModel> _items = [];
  double _total = 0.0;
  bool _isLoading = false;
  String? _error;
  List<Map<String, dynamic>> _suggestions = [];
  String? _actionError;
  int? _actionErrorCode;

  List<CartItemModel> get items => _items;
  double get total => _total;
  int get count => _items.length;
  bool get isLoading => _isLoading;
  String? get error => _error;
  List<Map<String, dynamic>> get suggestions => _suggestions;

  /// Arabic message of the last add-to-cart failure (e.g. the 409 server text).
  String? get actionError => _actionError;

  /// HTTP status of the last add-to-cart failure (409 = paid / open booking).
  int? get actionErrorCode => _actionErrorCode;

  static String? _serverMessage(dynamic data) =>
      toStrOrNull(toJsonMap(data)?['error']);

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
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        _items = toJsonList(data['items'])
            .map(CartItemModel.fromJson)
            .toList();
        _total = toDouble(data['total']);
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
  /// Returns false with [actionError] set when the server rejects the course
  /// (409: already paid or inside an open booking).
  Future<bool> addToCart(int courseId) async {
    _actionError = null;
    _actionErrorCode = null;
    try {
      final res = await _api.post(
        ApiConstants.cart,
        data: {'course_id': courseId},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchCart(silent: true);
        return true;
      }
      _actionError = _serverMessage(res.data) ?? 'فشل إضافة الكورس إلى السلة';
      _actionErrorCode = res.statusCode;
    } on DioException catch (e) {
      _actionErrorCode = e.response?.statusCode;
      _actionError = _serverMessage(e.response?.data) ??
          'تعذر إضافة الكورس إلى السلة، تحقق من اتصالك';
    } catch (_) {
      _actionError = 'فشل إضافة الكورس إلى السلة';
    }
    notifyListeners();
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
      if (res.statusCode == 200) {
        _suggestions = toJsonList(res.data);
        notifyListeners();
      }
    } catch (_) {
      // Silent: suggestions are secondary content, never an error screen.
    }
  }
}
