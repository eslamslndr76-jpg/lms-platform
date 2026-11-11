import '../services/fcm_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../storage/cache_service.dart';
import '../utils/json_utils.dart';

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
    // id/role_id may come as int or string from the API
    final id = toInt(json['id']);

    // role_id may be missing; derive from role string as fallback
    final role = toStrOrNull(json['role']) ?? 'student';
    final roleId = toIntOrNull(json['role_id']) ??
        (role == 'admin' ? 1 : role == 'employee' ? 2 : 3);

    return AppUser(
      id: id,
      name: toStr(json['name']),
      email: toStr(json['email']),
      phone: toStrOrNull(json['phone']),
      avatar: toStrOrNull(json['avatar']),
      role: role,
      roleId: roleId,
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

  // Boot: restore session
  Future<void> restore() async {
    _token = await _storage.read(key: _tokenKey);
    if (_token != null) {
      await _fetchMe();
      FcmService.syncToken();
    }
    notifyListeners();
  }

  // Login
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
        final data = toJsonMap(res.data) ?? const <String, dynamic>{};
        final token = toStrOrNull(data['token']);
        final userJson = toJsonMap(data['user']);
        if (token == null || userJson == null) {
          _error = 'استجابة غير صالحة من الخادم';
          return false;
        }
        _token = token;
        _user = AppUser.fromJson(userJson);
        await _storage.write(key: _tokenKey, value: _token);
        FcmService.syncToken();
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

  // Register
  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String phone,
    required String nationalId,
    String? birthDate,
    String? gender,
    String? governorate,
    required bool isEnrolled,
    String? universityName,
    String? universityCode,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final res = await ApiClient().post(
        ApiConstants.register,
        data: {
          'name': name.trim(),
          'email': email.trim().toLowerCase(),
          'password': password,
          'phone': phone.trim(),
          'nationalId': nationalId.trim(),
          'birthDate': birthDate,
          'gender': gender,
          'governorate': governorate,
          'isEnrolled': isEnrolled,
          'universityName': isEnrolled ? universityName?.trim() : null,
          'universityCode': isEnrolled ? universityCode?.trim() : null,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = toJsonMap(res.data) ?? const <String, dynamic>{};
        final token = toStrOrNull(data['token']);
        final userJson = toJsonMap(data['user']);
        if (token == null || userJson == null) {
          _error = 'استجابة غير صالحة من الخادم';
          return false;
        }
        _token = token;
        _user = AppUser.fromJson(userJson);
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

  // Logout
  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    await CacheService.clearUserCache();
    notifyListeners();
  }

  // Refresh the current user after a profile update
  Future<void> refreshUser() async {
    await _fetchMe();
    notifyListeners();
  }

  // Fetch current user from /api/auth/me
  Future<void> _fetchMe() async {
    try {
      final res = await ApiClient().get(ApiConstants.me);
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        _user = AppUser.fromJson(data);
      } else {
        await logout(); // token expired or invalid
      }
    } catch (_) {
      await logout();
    }
  }

  // Error extraction from Dio / network
  String _extractError(dynamic e) {
    try {
      if (e is DioException) {
        if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.sendTimeout) {
          return 'انتهت مهلة الاتصال بالخادم، يرجى التحقق من اتصال الإنترنت';
        }
        if (e.type == DioExceptionType.connectionError) {
          return 'تعذر الاتصال بالخادم، يرجى التأكد من اتصالك بالإنترنت';
        }
        final data = e.response?.data;
        if (data is Map && data['error'] != null) {
          return data['error'].toString();
        }
        if (data is Map && data['message'] != null) {
          return data['message'].toString();
        }
        if (e.response?.statusCode == 401) {
          return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
        }
        if (e.response?.statusCode == 404) {
          return 'الحساب غير مسجل بالمنظومة';
        }
      }
      final data = (e as dynamic).response?.data;
      if (data is Map && data['error'] != null) return data['error'].toString();
    } catch (_) {}
    return 'حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة مرة أخرى';
  }
}
