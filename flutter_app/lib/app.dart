import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/navigation/app_navigation.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/instructors/instructor_shell_screen.dart';
import 'features/lock/app_lock_gate.dart';

class TrainingApp extends StatelessWidget {
  const TrainingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final branding = context.watch<BrandingProvider>().branding;
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
      navigatorKey: AppNavigation.navigatorKey,
      title: branding.systemName,
      debugShowCheckedModeBanner: false,

      // Material 3 Themes seeded from admin branding colors
      theme: AppTheme.light(branding.primaryColor, secondary: branding.secondaryColor),
      darkTheme: AppTheme.dark(branding.primaryColor, secondary: branding.secondaryColor),
      themeMode: ThemeMode.system,

      // Proper Arabic RTL localization with delegates
      locale: const Locale('ar'),
      supportedLocales: const [
        Locale('ar'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      // App lock overlay above the whole navigator (covers pushed routes too).
      builder: (context, child) => AppLockGate(
        child: child ?? const SizedBox.shrink(),
      ),

      // Routing
      home: auth.isAuthenticated
          ? (auth.user?.role == 'instructor'
              ? const InstructorShellScreen()
              : const HomeScreen())
          : const LoginScreen(),
    );
  }
}
