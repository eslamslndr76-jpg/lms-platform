import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

class TrainingApp extends StatelessWidget {
  const TrainingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final branding = context.watch<BrandingProvider>().branding;
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
      title: branding.systemName,
      debugShowCheckedModeBanner: false,

      // ── Material 3 Themes seeded from admin branding colors ─────────────
      theme: AppTheme.light(branding.primaryColor, secondary: branding.secondaryColor),
      darkTheme: AppTheme.dark(branding.primaryColor, secondary: branding.secondaryColor),
      themeMode: ThemeMode.system,

      // ── RTL Arabic ────────────────────────────────────────────────────────
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        );
      },

      // ── Routing ───────────────────────────────────────────────────────────
      home: auth.isAuthenticated ? const HomeScreen() : const LoginScreen(),
    );
  }
}
