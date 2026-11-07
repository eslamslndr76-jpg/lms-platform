import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_constants.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

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
        onError: (error, handler) {
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
