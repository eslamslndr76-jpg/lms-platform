import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_constants.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  /// Called once when the API rejects the session (401) so the app can return
  /// to the login screen. Wired from `main.dart`.
  static VoidCallback? onUnauthorized;
  static bool _unauthorizedNotified = false;

  /// Endpoints where a 401 means "wrong credentials", not "expired session".
  static bool _isCredentialEndpoint(String path) {
    const excluded = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/change-password',
      '/api/auth/check-phone',
      'forgot-password',
      'verify-otp',
      'reset-password',
    ];
    return excluded.any(path.contains);
  }

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiClient._internal() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.defaultBaseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: 'token');
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (error, handler) async {
          // Expired session: try a silent token refresh once, then retry the
          // original request. Falls back to the login screen on failure.
          if (error.response?.statusCode == 401 &&
              !_isCredentialEndpoint(error.requestOptions.path) &&
              error.requestOptions.extra['_refreshed'] != true) {
            final refreshed = await _tryRefreshToken();
            if (refreshed) {
              final options = error.requestOptions;
              options.extra['_refreshed'] = true;
              final token = await _storage.read(key: 'token');
              if (token != null) {
                options.headers['Authorization'] = 'Bearer $token';
              }
              try {
                final response = await _dio.fetch(options);
                return handler.resolve(response);
              } on DioException {
                // fall through to the logout flow below
              }
            }
            _maybeHandleUnauthorized(error);
          }
          return handler.next(error);
        },
      ),
    );

    // Retry interceptor: up to 2 retries on network errors with 1s delay
    _dio.interceptors.add(
      InterceptorsWrapper(
        onError: (error, handler) async {
          final isNetworkError =
              error.type == DioExceptionType.connectionTimeout ||
              error.type == DioExceptionType.receiveTimeout ||
              error.type == DioExceptionType.connectionError;
          if (!isNetworkError) return handler.next(error);

          int retries = 0;
          const maxRetries = 2;
          DioException? lastError = error;

          while (retries < maxRetries) {
            await Future<void>.delayed(const Duration(seconds: 1));
            try {
              final response = await _dio.fetch(error.requestOptions);
              return handler.resolve(response);
            } on DioException catch (e) {
              lastError = e;
              retries++;
            }
          }
          return handler.next(lastError!);
        },
      ),
    );
  }

  Dio get dio => _dio;

  /// Asks the API for a fresh token using the stored one (no password needed).
  /// Only POST /api/auth/refresh is used, so this never recurses.
  static Future<bool> _tryRefreshToken() async {
    const storage = FlutterSecureStorage();
    final current = await storage.read(key: 'token');
    if (current == null || current.isEmpty) return false;
    try {
      final client = Dio(
        BaseOptions(
          baseUrl: ApiConstants.defaultBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 15),
        ),
      );
      final res = await client.post(
        '/api/auth/refresh',
        data: {'token': current},
        options: Options(validateStatus: (_) => true),
      );
      final data = res.data;
      final newToken = data is Map ? data['token'] : null;
      if (res.statusCode == 200 && newToken is String && newToken.isNotEmpty) {
        await storage.write(key: 'token', value: newToken);
        return true;
      }
    } catch (_) {}
    return false;
  }

  /// Handles an expired/invalid session once (debounced) and lets the app
  /// return to the login screen. Credential endpoints are ignored.
  static void _maybeHandleUnauthorized(DioException error) {
    if (error.response?.statusCode != 401) return;
    final path = error.requestOptions.path;
    if (_isCredentialEndpoint(path)) return;
    if (_unauthorizedNotified) return;
    _unauthorizedNotified = true;
    onUnauthorized?.call();
    // Allow a later expiry (e.g. after re-login) to be handled again.
    Future<void>.delayed(const Duration(seconds: 5), () {
      _unauthorizedNotified = false;
    });
  }

  // Helper: GET
  Future<Response> get(String path, {Map<String, dynamic>? params}) async {
    return _dio.get(path, queryParameters: params);
  }

  // Helper: POST
  Future<Response> post(String path, {dynamic data}) async {
    return _dio.post(path, data: data);
  }

  // Helper: PUT / PATCH
  Future<Response> put(String path, {dynamic data}) async {
    return _dio.put(path, data: data);
  }

  Future<Response> patch(String path, {dynamic data}) async {
    return _dio.patch(path, data: data);
  }

  // Helper: DELETE
  Future<Response> delete(String path) async {
    return _dio.delete(path);
  }
}
