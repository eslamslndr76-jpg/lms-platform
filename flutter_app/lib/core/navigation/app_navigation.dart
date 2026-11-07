import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../attendance/attendance_provider.dart';
import '../notifications/notifications_provider.dart';
import '../../features/attendance/qr_scanner_screen.dart';
import '../../features/cart/cart_screen.dart';

class AppNavigation {
  AppNavigation._();

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final ValueNotifier<int> homeTabNotifier = ValueNotifier<int>(0);

  /// Switch the main bottom navigation tab on HomeScreen (0: Home, 1: Courses, 2: MyCourses, 3: Notifications, 4: Profile)
  static void switchTab(int index) {
    homeTabNotifier.value = index;
    // Pop any open sub-screens (e.g. cart, scanner) back to home root
    navigatorKey.currentState?.popUntil((route) => route.isFirst);
  }

  /// Centralized link router that handles URLs, custom schemes, and internal paths.
  static void handleLink(String rawLink, {int? notificationId}) {
    if (rawLink.trim().isEmpty) return;

    final context = navigatorKey.currentContext;
    if (context == null) return;

    // If a notificationId was provided, mark it as read immediately
    if (notificationId != null && notificationId > 0) {
      context.read<NotificationsProvider>().markAsRead(notificationId);
    }
    // Refresh notifications list & unread count
    context.read<NotificationsProvider>().fetchNotifications(silent: true);

    final cleanLink = rawLink.trim();
    final uri = Uri.tryParse(cleanLink);

    // 1. Attendance links: /attendance/<lectureId>?code=<code>
    if (cleanLink.contains('/attendance/')) {
      final segments = uri?.pathSegments ?? cleanLink.split('/');
      final attendanceIdx = segments.indexOf('attendance');
      final lectureIdStr = (attendanceIdx != -1 && attendanceIdx + 1 < segments.length)
          ? segments[attendanceIdx + 1]
          : null;
      final lectureId = int.tryParse(lectureIdStr ?? '');
      final code = uri?.queryParameters['code'];

      if (lectureId != null && code != null && code.isNotEmpty) {
        final attendance = context.read<AttendanceProvider>();
        attendance.markAttendance(lectureId: lectureId, code: code).then((_) {
          final navState = navigatorKey.currentState;
          if (navState != null && navState.mounted) {
            ScaffoldMessenger.of(navState.context).showSnackBar(
              const SnackBar(
                content: Text('✅ تم تسجيل حضورك في المحاضرة بنجاح'),
                backgroundColor: Colors.green,
                duration: Duration(seconds: 4),
              ),
            );
          }
        }).catchError((_) {
          navigatorKey.currentState?.push(
            MaterialPageRoute(builder: (_) => const QrScannerScreen()),
          );
        });
      } else {
        // Open QR scanner directly so student can scan lecturer's QR
        navigatorKey.currentState?.push(
          MaterialPageRoute(builder: (_) => const QrScannerScreen()),
        );
      }
      return;
    }

    // 2. My Courses: /my-courses
    if (cleanLink.contains('my-courses')) {
      switchTab(2);
      return;
    }

    // 3. Courses Catalog: /courses
    if (cleanLink.contains('courses') && !cleanLink.contains('my-courses')) {
      switchTab(1);
      return;
    }

    // 4. Notifications center: /notifications
    if (cleanLink.contains('notifications')) {
      switchTab(3);
      return;
    }

    // 5. Orders / Cart: /orders or /cart
    if (cleanLink.contains('orders') || cleanLink.contains('cart')) {
      navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const CartScreen()),
      );
      return;
    }

    // 6. Profile / Certificates: /profile or /certificates
    if (cleanLink.contains('profile') || cleanLink.contains('certificates')) {
      switchTab(4);
      return;
    }

    // 7. Default fallback: Home Dashboard
    switchTab(0);
  }
}
