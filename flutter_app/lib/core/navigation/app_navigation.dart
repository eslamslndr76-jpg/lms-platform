import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../auth/auth_provider.dart';
import '../attendance/attendance_provider.dart';
import '../notifications/notifications_provider.dart';
import '../../features/attendance/qr_scanner_screen.dart';
import '../../features/cart/cart_screen.dart';
import '../../features/groups/group_details_screen.dart';
import '../../features/courses/course_details_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../features/surveys/survey_screen.dart';
import '../../features/surveys/surveys_list_screen.dart';
import '../../features/orders/orders_screen.dart';
import '../../features/certificates/certificates_screen.dart';
import '../../features/certificates/verify_certificate_screen.dart';
import '../../features/instructors/instructor_evaluation_screen.dart';
import '../../features/instructors/instructor_proposals_screen.dart';
import '../../features/instructors/instructor_shell_screen.dart';
import '../../core/widgets/app_bottom_sheet.dart';

/// Centralized route definition for deep links / notification taps.
/// Unknown routes fall back to Notifications center (not Home).
class AppRoute {
  final String pattern; // regex pattern for the path
  final String name; // for logging/debugging
  final Future<void> Function(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) handler;

  const AppRoute({
    required this.pattern,
    required this.name,
    required this.handler,
  });
}

/// Router that handles deep links, notification taps, and custom schemes.
class AppRouter {
  AppRouter._();

  static final _routes = <AppRoute>[
    // ── Attendance / QR Scan ──────────────────────────────────────────
    AppRoute(
      pattern: r'^/attendance/(?<lectureId>\d+)(?:\?.*)?$',
      name: 'attendance_lecture',
      handler: _handleAttendance,
    ),
    AppRoute(
      pattern: r'^/attendance(?:\?.*)?$',
      name: 'attendance_generic',
      handler: _handleAttendance,
    ),

    // ── Groups ───────────────────────────────────────────────────────
    AppRoute(
      pattern: r'^/groups/(?<groupId>\d+)(?:\?.*)?$',
      name: 'group_details',
      handler: _handleGroupDetails,
    ),

    // ── My Courses ───────────────────────────────────────────────────
    AppRoute(
      pattern: r'^/my-courses(?:/.*)?$',
      name: 'my_courses',
      handler: _handleMyCourses,
    ),

    // ── Courses Catalog / Course Details ─────────────────────────────
    AppRoute(
      pattern: r'^/courses/(?<courseId>\d+)(?:\?.*)?$',
      name: 'course_details',
      handler: _handleCourseDetails,
    ),
    AppRoute(
      pattern: r'^/courses(?:/.*)?$',
      name: 'courses_catalog',
      handler: _handleCoursesCatalog,
    ),

    // ── Notifications Center ─────────────────────────────────────────
    AppRoute(
      pattern: r'^/notifications(?:/.*)?$',
      name: 'notifications_center',
      handler: _handleNotificationsCenter,
    ),

    // ── Orders / Cart ────────────────────────────────────────────────
    AppRoute(
      pattern: r'^/orders(?:/.*)?$',
      name: 'orders',
      handler: _handleOrders,
    ),
    AppRoute(
      pattern: r'^/cart(?:/.*)?$',
      name: 'cart',
      handler: _handleCart,
    ),

    // ── Profile / Certificates ───────────────────────────────────────
    AppRoute(
      pattern: r'^/account(?:/.*)?$',
      name: 'account',
      handler: _handleAccount,
    ),
    AppRoute(
      pattern: r'^/profile(?:/.*)?$',
      name: 'profile',
      handler: _handleProfile,
    ),
    AppRoute(
      pattern: r'^/certificates(?:/.*)?$',
      name: 'certificates',
      handler: _handleCertificates,
    ),

    // ── Surveys (phase 10) ───────────────────────────────────────────
    AppRoute(
      pattern: r'^/survey/(?<groupId>\d+)(?:\?.*)?$',
      name: 'survey',
      handler: _handleSurvey,
    ),
    AppRoute(
      pattern: r'^/surveys(?:/.*)?$',
      name: 'surveys_list',
      handler: _handleSurvey,
    ),

    // ── Settings / App Update (phase 8/9) ────────────────────────────
    AppRoute(
      pattern: r'^/settings(?:/.*)?$',
      name: 'settings',
      handler: _handleSettings,
    ),

    // ── Instructor area (phase 12) ───────────────────────────────────
    // Notification links: /instructor, /instructor/evaluate/:groupId,
    // /instructor/proposals, /instructor/proposals/:id
    AppRoute(
      pattern: r'^/instructor/evaluate(?:/(?<groupId>\d+))?(?:\?.*)?$',
      name: 'instructor_evaluate',
      handler: _handleInstructorEvaluate,
    ),
    AppRoute(
      pattern: r'^/instructor/proposals(?:/(?<proposalId>\d+))?(?:\?.*)?$',
      name: 'instructor_proposals',
      handler: _handleInstructorProposals,
    ),
    AppRoute(
      pattern: r'^/instructor(?:/.*)?$',
      name: 'instructor',
      handler: _handleInstructor,
    ),

    // ── Verify Certificate (web) ─────────────────────────────────────
    AppRoute(
      pattern: r'^/verify(?:/.*)?$',
      name: 'verify',
      handler: _handleVerify,
    ),
  ];

  /// Resolves and executes the matching route.
  /// Unknown routes → Notifications center (with logging).
  static Future<void> handleLink(
    String rawLink, {
    int? notificationId,
    int? groupId,
    int? lectureId,
  }) async {
    final context = AppNavigation.navigatorKey.currentContext;
    if (context == null) return;

    // Mark notification as read if provided
    if (notificationId != null && notificationId > 0) {
      context.read<NotificationsProvider>().markAsRead(notificationId);
    }
    // Refresh in-app notifications
    context.read<NotificationsProvider>().fetchNotifications(silent: true);

    final cleanLink = rawLink.trim();
    final uri = Uri.tryParse(cleanLink);

    // Extract path (for web URLs, we only care about the path)
    final path = uri?.path ?? cleanLink;

    // Find matching route
    for (final route in _routes) {
      final match = RegExp(route.pattern).firstMatch(path);
      if (match != null) {
        final params = <String, String>{
          '_rawLink': cleanLink,
        };
        // Extract IDs from path
        final lectureMatch = RegExp(r'/attendance/(\d+)').firstMatch(path);
        if (lectureMatch != null) params['lectureId'] = lectureMatch.group(1)!;
        final groupMatch = RegExp(r'/groups/(\d+)').firstMatch(path);
        if (groupMatch != null) params['groupId'] = groupMatch.group(1)!;
        final courseMatch = RegExp(r'/courses/(\d+)').firstMatch(path);
        if (courseMatch != null) params['courseId'] = courseMatch.group(1)!;
        final surveyMatch = RegExp(r'/survey/(\d+)').firstMatch(path);
        if (surveyMatch != null) params['groupId'] = surveyMatch.group(1)!;
        final evalMatch = RegExp(r'/instructor/evaluate/(\d+)').firstMatch(path);
        if (evalMatch != null) params['groupId'] = evalMatch.group(1)!;
        final proposalMatch = RegExp(r'/instructor/proposals/(\d+)').firstMatch(path);
        if (proposalMatch != null) params['proposalId'] = proposalMatch.group(1)!;
        await route.handler(
          context,
          notificationId: notificationId,
          groupId: groupId,
          lectureId: lectureId,
          params: params,
        );
        return;
      }
    }

    // ── Fallback: unknown route → Notifications center ──────────────
    debugPrint('[AppRouter] Unknown route: $cleanLink → Notifications center');
    await _handleNotificationsCenter(context);
  }

  // ── Handlers ───────────────────────────────────────────────────────

  static Future<void> _handleAttendance(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    final parsedLectureId =
        int.tryParse(params?['lectureId'] ?? '') ?? lectureId;

    // If the deep link contains a `code` query param and user is logged in,
    // show a confirmation bottom sheet instead of just opening the scanner.
    final uri = Uri.tryParse(params?['_rawLink'] ?? '');
    final code = uri?.queryParameters['code']?.toUpperCase();
    final auth = context.read<AuthProvider>();

    if (code != null && code.isNotEmpty && auth.isAuthenticated && parsedLectureId != null) {
      if (!context.mounted) return;
      await _showAttendanceConfirmSheet(context, parsedLectureId, code);
      return;
    }

    // No code or not logged in → open QR scanner
    if (context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => QrScannerScreen(targetLectureId: parsedLectureId),
        ),
      );
    }
  }

  /// Shows a confirmation bottom sheet for attendance when a QR link with code is opened.
  static Future<void> _showAttendanceConfirmSheet(
    BuildContext context,
    int lectureId,
    String code,
  ) async {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final attendance = context.read<AttendanceProvider>();

    // Try to get lecture info from the deep link params if available
    // For now, we show what we have and call markAttendance on confirm.

    return AppBottomSheet.show(
      context: context,
      title: 'تأكيد الحضور',
      subtitle: 'هل تريد تأكيد حضورك لهذه المحاضرة؟',
      body: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cs.primaryContainer,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  Icon(Icons.qr_code_rounded, size: 48, color: cs.onPrimaryContainer),
                  const SizedBox(height: 12),
                  Text(
                    'كود الحضور: $code',
                    style: tt.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: cs.onPrimaryContainer,
                      letterSpacing: 2,
                    ),
                  ),
                  if (lectureId > 0) ...[
                    const SizedBox(height: 8),
                    Text(
                      'المحاضرة رقم: $lectureId',
                      style: tt.bodyMedium?.copyWith(color: cs.onPrimaryContainer),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'بمجرد الضغط على "تأكيد الحضور" سيتم تسجيل حضورك مباشرة. '
              'تأكد من أنك داخل قاعة المحاضرة.',
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      actions: [
        FilledButton.icon(
          onPressed: attendance.isSubmitting
              ? null
              : () async {
                  if (!context.mounted) return;
                  Navigator.of(context).pop(); // Close bottom sheet
                  final result = await attendance.markAttendance(
                    lectureId: lectureId,
                    code: code,
                    method: 'qr',
                  );
                  if (!context.mounted) return;
                  if (result.success) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(result.message),
                        backgroundColor: cs.primary,
                      ),
                    );
                    AppNavigation.navigatorKey.currentState?.pop(true);
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(result.message),
                        backgroundColor: cs.error,
                      ),
                    );
                  }
                },
          icon: attendance.isSubmitting
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.check_circle_rounded),
          label: Text(attendance.isSubmitting ? 'جاري التأكيد...' : 'تأكيد الحضور'),
        ),
      ],
    );
  }

  static Future<void> _handleGroupDetails(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    final gid = int.tryParse(params?['groupId'] ?? '') ?? groupId;
    if (gid != null && gid > 0 && context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => GroupDetailsScreen(
            groupId: gid,
            highlightLectureId: lectureId,
          ),
        ),
      );
    }
  }

  static Future<void> _handleMyCourses(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) AppNavigation.switchTab(2);
  }

  static Future<void> _handleCourseDetails(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    final cid = int.tryParse(params?['courseId'] ?? '');
    if (cid != null && context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => CourseDetailsScreen(courseId: cid),
        ),
      );
    } else if (context.mounted) {
      AppNavigation.switchTab(1);
    }
  }

  static Future<void> _handleCoursesCatalog(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) AppNavigation.switchTab(1);
  }

  static Future<void> _handleNotificationsCenter(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) AppNavigation.switchTab(3);
  }

  static Future<void> _handleOrders(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const OrdersScreen()),
      );
    }
  }

  static Future<void> _handleCart(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const CartScreen()),
      );
    }
  }

  static Future<void> _handleProfile(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) AppNavigation.switchTab(4);
  }

  /// `/account` (الويب: الملف الشخصي) و`/account?tab=certificates` (الشهادات).
  static Future<void> _handleAccount(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (!context.mounted) return;
    final raw = params?['_rawLink'] ?? '';
    if (raw.contains('tab=certificates')) {
      await _handleCertificates(context, notificationId: notificationId);
      return;
    }
    await _handleProfile(context, notificationId: notificationId);
  }

  static Future<void> _handleCertificates(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (!context.mounted) return;
    AppNavigation.navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => const CertificatesScreen()),
    );
  }

  static Future<void> _handleSurvey(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    final gid = int.tryParse(params?['groupId'] ?? '') ?? groupId;
    if (!context.mounted) return;
    if (gid != null && gid > 0) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => SurveyScreen(groupId: gid)),
      );
    } else {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const SurveysListScreen()),
      );
    }
  }

  static Future<void> _handleSettings(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const SettingsScreen()),
      );
    }
  }

  /// هل المستخدم الحالي محاضر؟
  static bool _isInstructor(BuildContext context) {
    final auth = context.read<AuthProvider>();
    return auth.user?.role == 'instructor';
  }

  /// /instructor — واجهة المحاضر (تبويب مجموعاتي).
  static Future<void> _handleInstructor(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (!context.mounted) return;
    if (!_isInstructor(context)) {
      await _handleNotificationsCenter(context, notificationId: notificationId);
      return;
    }
    AppNavigation.navigatorKey.currentState?.popUntil((route) => route.isFirst);
    InstructorTabs.notifier.value = InstructorTabs.groups;
  }

  /// /instructor/evaluate[/:groupId] — تقييم طلاب مجموعة منتهية (إشعار instructor_eval_opened).
  static Future<void> _handleInstructorEvaluate(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (!context.mounted) return;
    if (!_isInstructor(context)) {
      await _handleNotificationsCenter(context, notificationId: notificationId);
      return;
    }
    final gid = int.tryParse(params?['groupId'] ?? '') ?? groupId;
    if (gid == null || gid <= 0) {
      AppNavigation.navigatorKey.currentState?.popUntil((route) => route.isFirst);
      InstructorTabs.notifier.value = InstructorTabs.evaluations;
      return;
    }
    AppNavigation.navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => InstructorEvaluationScreen(groupId: gid)),
    );
  }

  /// /instructor/proposals[/:id] — المقترحات أو تفاصيل مقترح (إشعار proposal_reviewed).
  static Future<void> _handleInstructorProposals(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (!context.mounted) return;
    if (!_isInstructor(context)) {
      await _handleNotificationsCenter(context, notificationId: notificationId);
      return;
    }
    final pid = int.tryParse(params?['proposalId'] ?? '');
    if (pid == null || pid <= 0) {
      AppNavigation.navigatorKey.currentState?.popUntil((route) => route.isFirst);
      InstructorTabs.notifier.value = InstructorTabs.proposals;
      return;
    }
    AppNavigation.navigatorKey.currentState?.push(
      MaterialPageRoute(builder: (_) => InstructorProposalDetailScreen(proposalId: pid)),
    );
  }

  static Future<void> _handleVerify(
    BuildContext context, {
    int? notificationId,
    int? groupId,
    int? lectureId,
    Map<String, String>? params,
  }) async {
    if (context.mounted) {
      AppNavigation.navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const VerifyCertificateScreen()),
      );
    }
  }
}

/// Thin wrapper to keep existing call sites working.
class AppNavigation {
  AppNavigation._();

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final ValueNotifier<int> homeTabNotifier = ValueNotifier<int>(0);

  /// Switch the main bottom navigation tab on HomeScreen
  static void switchTab(int index) {
    homeTabNotifier.value = index;
    navigatorKey.currentState?.popUntil((route) => route.isFirst);
  }

  /// Centralized link router — delegates to AppRouter.
  static void handleLink(
    String rawLink, {
    int? notificationId,
    int? groupId,
    int? lectureId,
  }) {
    AppRouter.handleLink(
      rawLink,
      notificationId: notificationId,
      groupId: groupId,
      lectureId: lectureId,
    );
  }
}