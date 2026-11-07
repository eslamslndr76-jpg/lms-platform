import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';

class AttendanceResult {
  final bool success;
  final String message;
  final bool alreadyMarked;

  const AttendanceResult({
    required this.success,
    required this.message,
    this.alreadyMarked = false,
  });
}

class AttendanceProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  bool _isSubmitting = false;
  bool _isScanningBle = false;
  String? _error;
  AttendanceResult? _lastResult;

  bool get isSubmitting => _isSubmitting;
  bool get isScanningBle => _isScanningBle;
  String? get error => _error;
  AttendanceResult? get lastResult => _lastResult;

  // ── Mark Attendance via API ────────────────────────────────────────────────
  Future<AttendanceResult> markAttendance({
    required int lectureId,
    required String code,
    String method = 'qr',
  }) async {
    _isSubmitting = true;
    _error = null;
    notifyListeners();

    try {
      final res = await _api.post(
        ApiConstants.attendanceMark,
        data: {
          'lectureId': lectureId,
          'code': code.trim().toUpperCase(),
          'method': method,
        },
      );

      final data = res.data as Map<String, dynamic>;
      final success = data['success'] as bool? ?? (res.statusCode == 200);
      final message = data['message'] as String? ?? (success ? 'تم تسجيل حضورك بنجاح!' : 'فشل تسجيل الحضور');
      final alreadyMarked = data['alreadyMarked'] as bool? ?? false;

      // Provide gentle haptic feedback on success
      if (success) {
        HapticFeedback.mediumImpact();
      }

      final result = AttendanceResult(
        success: success,
        message: message,
        alreadyMarked: alreadyMarked,
      );

      _lastResult = result;
      return result;
    } catch (e) {
      String errMsg = 'فشل تسجيل الحضور، يرجى المحاولة مرة أخرى';
      try {
        final resp = (e as dynamic).response?.data;
        if (resp is Map && resp['error'] != null) {
          errMsg = resp['error'].toString();
        }
      } catch (_) {}

      HapticFeedback.heavyImpact();
      _error = errMsg;
      final result = AttendanceResult(success: false, message: errMsg);
      _lastResult = result;
      return result;
    } finally {
      _isSubmitting = false;
      notifyListeners();
    }
  }

  // ── Parse QR Payload ───────────────────────────────────────────────────────
  // Supports:
  // 1. JSON: {"v":1, "l":123, "c":"A1B2C3", "t":1700000000}
  // 2. URL: https://.../attendance/123?code=A1B2C3
  // 3. Raw combined format: "123:A1B2C3"
  Map<String, dynamic>? parseQrData(String rawData) {
    try {
      final clean = rawData.trim();

      // Check if it's JSON
      if (clean.startsWith('{') && clean.endsWith('}')) {
        final decoded = jsonDecode(clean);
        if (decoded is Map<String, dynamic>) {
          final l = decoded['l'] ?? decoded['lectureId'];
          final c = decoded['c'] ?? decoded['code'];
          if (l != null && c != null) {
            return {
              'lectureId': (l as num).toInt(),
              'code': c.toString().toUpperCase(),
            };
          }
        }
      }

      // Check if it's a URL
      if (clean.contains('/attendance/')) {
        final uri = Uri.tryParse(clean);
        if (uri != null) {
          final segments = uri.pathSegments;
          final idx = segments.indexOf('attendance');
          if (idx != -1 && idx + 1 < segments.length) {
            final lecId = int.tryParse(segments[idx + 1]);
            final code = uri.queryParameters['code'];
            if (lecId != null && code != null) {
              return {'lectureId': lecId, 'code': code.toUpperCase()};
            }
          }
        }
      }

      // Check "lectureId:code" format
      if (clean.contains(':')) {
        final parts = clean.split(':');
        final lecId = int.tryParse(parts[0].trim());
        final code = parts[1].trim();
        if (lecId != null && code.length >= 4) {
          return {'lectureId': lecId, 'code': code.toUpperCase()};
        }
      }
    } catch (_) {}

    return null;
  }

  // ── Bluetooth LE Scan ─────────────────────────────────────────────────────
  Future<void> startBleScan({
    required Function(int lectureId, String code) onBeaconFound,
  }) async {
    if (_isScanningBle) return;

    try {
      // Check bluetooth availability
      final isSupported = await FlutterBluePlus.isSupported;
      if (!isSupported) {
        _error = 'جهازك لا يدعم تقنية البلوتوث منخفض الطاقة (BLE)';
        notifyListeners();
        return;
      }

      // Check adapter state
      final adapterState = await FlutterBluePlus.adapterState.first;
      if (adapterState != BluetoothAdapterState.on) {
        _error = 'يرجى تشغيل البلوتوث لتسجيل الحضور التلقائي';
        notifyListeners();
        return;
      }

      _isScanningBle = true;
      _error = null;
      notifyListeners();

      // Start scan with 15 seconds timeout
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 15));

      FlutterBluePlus.scanResults.listen((results) {
        for (final r in results) {
          // Check manufacturer data or service data for attendance beacon
          final name = r.device.platformName;
          if (name.startsWith('TU_LEC_')) {
            // Format: TU_LEC_<lectureId>_<codePrefix>
            final parts = name.split('_');
            if (parts.length >= 4) {
              final lecId = int.tryParse(parts[2]);
              final code = parts[3];
              if (lecId != null && code.isNotEmpty) {
                FlutterBluePlus.stopScan();
                _isScanningBle = false;
                notifyListeners();
                onBeaconFound(lecId, code);
                break;
              }
            }
          }
        }
      });
    } catch (e) {
      _error = 'حدث خطأ أثناء فحص البلوتوث: $e';
    } finally {
      _isScanningBle = false;
      notifyListeners();
    }
  }

  void stopBleScan() {
    try {
      FlutterBluePlus.stopScan();
    } catch (_) {}
    _isScanningBle = false;
    notifyListeners();
  }
}
