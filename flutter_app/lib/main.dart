import 'package:app_links/app_links.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/instructors/instructor_provider.dart';
import 'core/services/fcm_service.dart';
import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/courses/courses_provider.dart';
import 'core/orders/orders_provider.dart';
import 'core/cart/cart_provider.dart';
import 'core/attendance/attendance_provider.dart';
import 'core/notifications/notifications_provider.dart';
import 'core/surveys/surveys_provider.dart';
import 'core/certificates/certificates_provider.dart';
import 'core/network/network_service.dart';
import 'core/api/api_client.dart';
import 'core/api/api_constants.dart';
import 'core/navigation/app_navigation.dart';
import 'app.dart';

void main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  // Save API base URL for reference
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('api_base_url', ApiConstants.defaultBaseUrl);

  // Initialize Firebase & FCM push notifications
  // NOTE: Requires google-services.json in android/app/
  // Get it from: Firebase Console → Project Settings → Android app → Download
  try {
    await Firebase.initializeApp();
    await FcmService.init();
  } catch (_) {
    // FCM unavailable (missing google-services.json) — app still works normally
  }

  final brandingProvider = BrandingProvider();
  final authProvider = AuthProvider();

  // Fast restore from local storage with 2s safety timeout
  try {
    await authProvider.restore().timeout(const Duration(seconds: 2));
  } catch (_) {}

  // Expired session: clear the token and go back to the login screen.
  ApiClient.onUnauthorized = () {
    final context = AppNavigation.navigatorKey.currentContext;
    AppNavigation.navigatorKey.currentState?.popUntil((route) => route.isFirst);
    authProvider.logout();
    if (context == null) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('انتهت جلستك، يرجى تسجيل الدخول من جديد')),
    );
  };

  // Load live branding colors in the background without blocking the UI
  brandingProvider.load();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: brandingProvider),
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider(create: (_) => CoursesProvider()),
        ChangeNotifierProvider(create: (_) => OrdersProvider()),
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => AttendanceProvider()),
        ChangeNotifierProvider(create: (_) => NotificationsProvider()),
        ChangeNotifierProvider(create: (_) => SurveysProvider()),
        ChangeNotifierProvider(create: (_) => CertificatesProvider()),
        ChangeNotifierProvider(create: (_) => InstructorProvider()),
        ChangeNotifierProvider.value(value: NetworkService()),
      ],
      child: const TrainingApp(),
    ),
  );

  // Dismiss native splash screen smoothly
  FlutterNativeSplash.remove();

  // ── App Links / Deep Links handling ──────────────────────────────────
  _initAppLinks();
}

/// Handles cold-start and background App Links (https://lms-user.vercel.app/attendance/...).
/// Delegates to [AppRouter.handleLink] which shows the QR confirmation bottom sheet
/// when a `code` query param is present, or opens the scanner otherwise.
void _initAppLinks() {
  final appLinks = AppLinks();

  // Cold start (terminated app launched via link)
  appLinks.getInitialLink().then((uri) {
    if (uri != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _handleDeepLink(uri.toString());
      });
    }
  });

  // App in background / foreground (link tapped while running)
  appLinks.uriLinkStream.listen((uri) {
    _handleDeepLink(uri.toString());
  });
}

void _handleDeepLink(String rawLink) {
  final context = AppNavigation.navigatorKey.currentContext;
  if (context == null) return;
  AppRouter.handleLink(rawLink);
}
