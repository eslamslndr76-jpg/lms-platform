import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:app_links/app_links.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/branding_provider.dart';
import 'core/auth/auth_provider.dart';
import 'core/attendance/attendance_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/home/home_screen.dart';
import 'features/attendance/qr_scanner_screen.dart';

class TrainingApp extends StatelessWidget {
  const TrainingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final branding = context.watch<BrandingProvider>().branding;
    final auth = context.watch<AuthProvider>();

    return MaterialApp(
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

/// Wraps HomeScreen and listens for deep links (QR attendance URLs).
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
      if (uri != null) _handleLink(uri);
    });

    // Handle links while app is running
    _appLinks.uriLinkStream.listen(_handleLink);
  }

  void _handleLink(Uri uri) {
    // Expected patterns:
    //   https://lms-user*.vercel.app/attendance/<lectureId>?code=<code>
    //   trainingunit://attendance/<lectureId>?code=<code>
    final segments = uri.pathSegments;
    final attendanceIdx = segments.indexOf('attendance');
    if (attendanceIdx == -1) return;

    final lectureIdStr = attendanceIdx + 1 < segments.length
        ? segments[attendanceIdx + 1]
        : null;
    final code = uri.queryParameters['code'];
    final lectureId = int.tryParse(lectureIdStr ?? '');

    if (lectureId == null || code == null) return;

    // Auto-mark attendance then navigate to result
    final attendanceProvider = context.read<AttendanceProvider>();
    attendanceProvider.markAttendance(lectureId: lectureId, code: code).then((_) {
      if (!mounted) return;
      // Show success snackbar
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ تم تسجيل حضورك بنجاح'),
          backgroundColor: Colors.green,
        ),
      );
    }).catchError((_) {
      if (!mounted) return;
      // Navigate to scanner so user can try manually
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const QrScannerScreen()),
      );
    });
  }

  @override
  Widget build(BuildContext context) => const HomeScreen();
}
