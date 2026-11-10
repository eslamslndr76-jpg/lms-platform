import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:shared_preferences/shared_preferences.dart';

/// قفل التطبيق بالبصمة/الوجه (المرحلة 14).
///
/// - تخزين محلي فقط (SharedPreferences) لا يمسّ الـ JWT ولا الـ backend.
/// - لا يمنع استقبال الإشعارات: القفل غطاء واجهة فقط.
class AppLockService {
  AppLockService._();

  /// المدة التي يُسمح فيها للتطبيق بالبقاء في الخلفية دون قفل (قابل للتعديل).
  static const Duration lockAfterBackground = Duration(minutes: 1);

  /// عدد محاولات كلمة المرور قبل العودة إلى تسجيل الدخول العادي.
  static const int maxPasswordAttempts = 3;

  static const String _enabledKey = 'app_lock_enabled';
  static const String _lastPausedKey = 'app_lock_last_paused_at';

  static final LocalAuthentication _auth = LocalAuthentication();

  /// هل الجهاز يدعم بصمة/وجه مسجّلة؟
  static Future<bool> isDeviceSupported() async {
    try {
      final supported = await _auth.isDeviceSupported();
      if (!supported) return false;
      final biometrics = await _auth.getAvailableBiometrics();
      return biometrics.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  static Future<void> setEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, value);
    if (!value) await prefs.remove(_lastPausedKey);
  }

  /// تسجيل لحظة انتقال التطبيق للخلفية (لحساب مدة القفل).
  static Future<void> markPaused() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_lastPausedKey, DateTime.now().millisecondsSinceEpoch);
  }

  /// مسح لحظة الخلفية (بعد فتح ناجح) حتى لا يُقفل التطبيق فوراً من جديد.
  static Future<void> clearPaused() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_lastPausedKey);
  }

  /// هل يجب قفل التطبيق الآن؟ (بعد العودة من الخلفية بمدة ≥ [lockAfterBackground])
  static Future<bool> shouldLockOnResume() async {
    if (!await isEnabled()) return false;
    final prefs = await SharedPreferences.getInstance();
    final last = prefs.getInt(_lastPausedKey);
    if (last == null) return false;
    final elapsed = DateTime.now().difference(
      DateTime.fromMillisecondsSinceEpoch(last),
    );
    return elapsed >= lockAfterBackground;
  }

  /// نتيجة محاولة الفتح بالبصمة/الوجه.
  static Future<BiometricResult> authenticate({String? reason}) async {
    try {
      final ok = await _auth.authenticate(
        localizedReason:
            reason ?? 'افتح التطبيق بالبصمة أو الوجه للمتابعة',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: false,
        ),
      );
      return ok ? BiometricResult.success : BiometricResult.failed;
    } on PlatformException catch (e) {
      if (e.code == auth_error.notAvailable ||
          e.code == auth_error.notEnrolled ||
          e.code == auth_error.passcodeNotSet) {
        return BiometricResult.unavailable;
      }
      if (e.code == auth_error.lockedOut ||
          e.code == auth_error.permanentlyLockedOut) {
        return BiometricResult.lockedOut;
      }
      debugPrint('[AppLock] biometric error: ${e.code}');
      return BiometricResult.failed;
    } catch (e) {
      debugPrint('[AppLock] unexpected error: $e');
      return BiometricResult.failed;
    }
  }
}

enum BiometricResult { success, failed, unavailable, lockedOut }
