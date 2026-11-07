import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:provider/provider.dart';

import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/courses/courses_provider.dart';
import 'core/orders/orders_provider.dart';
import 'core/cart/cart_provider.dart';
import 'core/attendance/attendance_provider.dart';
import 'core/notifications/notifications_provider.dart';
import 'core/certificates/certificates_provider.dart';
import 'core/network/network_service.dart';
import 'app.dart';

void main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  final brandingProvider = BrandingProvider();
  final authProvider = AuthProvider();

  // Fast restore from local storage with 2s safety timeout
  try {
    await authProvider.restore().timeout(const Duration(seconds: 2));
  } catch (_) {}

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
        ChangeNotifierProvider(create: (_) => CertificatesProvider()),
        ChangeNotifierProvider.value(value: NetworkService()),
      ],
      child: const TrainingApp(),
    ),
  );

  // Dismiss native splash screen smoothly
  FlutterNativeSplash.remove();
}
