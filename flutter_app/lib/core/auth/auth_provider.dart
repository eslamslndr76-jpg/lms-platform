import 'package:dio/dio.dart';
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
    // id may come as int or string from the API
    final rawId = json['id'];
    final id = rawId is int ? rawId : int.tryParse(rawId.toString()) ?? 0;

    // role_id may be missing; derive from role string as fallback
    final rawRoleId = json['role_id'];
    int roleId;
    if (rawRoleId != null) {
      roleId = rawRoleId is int ? rawRoleId : int.tryParse(rawRoleId.toString()) ?? 3;
    } else {
      final role = json['role'] as String? ?? 'student';
      roleId = role == 'admin' ? 1 : role == 'employee' ? 2 : 3;
    }

    return AppUser(
      id: id,
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      avatar: json['avatar'] as String?,
      role: json['role'] as String? ?? 'student',
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

  // Logout
  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: _tokenKey);
    await CacheService.clearUserCache();
    notifyListeners();
  }

  // Fetch current user from /api/auth/me
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
