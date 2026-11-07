import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../storage/cache_service.dart';

/// User model matching /api/auth/login and /api/auth/me responses.
class AppUser {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? avatar;
  final String role;
  final int roleId;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.avatar,
    required this.role,
    required this.roleId,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as int,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      avatar: json['avatar'] as String?,
      role: json['role'] as String? ?? 'student',
      roleId: (json['role_id'] as num?)?.toInt() ?? 3,
    );
  }
}

/// Manages JWT token + current user, persisted in flutter_secure_storage.
class AuthProvider extends ChangeNotifier {
  static const _tokenKey = 'token';
  final _storage = const FlutterSecureStorage();

  AppUser? _user;
  String? _token;
  bool _loading = false;
  String? _error;

  AppUser? get user => _user;
  String? get token => _token;
  bool get isAuthenticated => _token != null && _user != null;
  bool get loading => _loading;
  String? get error => _error;

  // ── Boot: restore session ────────────────────────────────────────────────
  Future<void> restore() async {
    _token = await _storage.read(key: _tokenKey);
    if (_token != null) {
      await _fetchMe();
    }
    notifyListeners();
  }

  // ── Login ────────────────────────────────────────────────────────────────
  Future<bool> login(String emailOrPhone, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient().post(
        ApiConstants.login,
        data: {'email': emailOrPhone, 'password': password},
      );
      if (res.statusCode == 200) {
        final data = res.data as Map<String, dynamic>;
        _token = data['token'] as String;
        _user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
        await _storage.write(key: _tokenKey, value: _token);
        return true;
      }
    } catch (e) {
      _error = _extractError(e);
    } finally {
      _loading = false;
      notifyListeners();
    }
    return false;
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    await CacheService.clearUserCache();
    notifyListeners();
  }

  // ── Fetch current user from /api/auth/me ─────────────────────────────────
  Future<void> _fetchMe() async {
    try {
      final res = await ApiClient().get(ApiConstants.me);
      if (res.statusCode == 200) {
        _user = AppUser.fromJson(res.data as Map<String, dynamic>);
      } else {
        await logout(); // token expired or invalid
      }
    } catch (_) {
      await logout();
    }
  }

  // ── Error extraction from Dio ─────────────────────────────────────────────
  String _extractError(dynamic e) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map && data['error'] != null) return data['error'].toString();
    } catch (_) {}
    return 'حدث خطأ، يرجى المحاولة مرة أخرى';
  }
}
