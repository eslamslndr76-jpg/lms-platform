import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:app_links/app_links.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/navigation/app_navigation.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';

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

      // Routing
      home: auth.isAuthenticated ? const _AppRoot() : const LoginScreen(),
    );
  }
}

/// Wraps HomeScreen and listens for deep links (QR attendance URLs, notification URLs).
class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> {
  final _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  void _initDeepLinks() {
    // Handle link that cold-started the app
    _appLinks.getInitialLink().then((uri) {
      if (uri != null) AppNavigation.handleLink(uri.toString());
    });

    // Handle links while app is running
    _appLinks.uriLinkStream.listen((uri) {
      AppNavigation.handleLink(uri.toString());
    });
  }

  @override
  Widget build(BuildContext context) => const HomeScreen();
}
