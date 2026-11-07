import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../notifications/notifications_provider.dart';
import '../../features/attendance/qr_scanner_screen.dart';
import '../../features/cart/cart_screen.dart';
import '../../features/groups/group_details_screen.dart';

class AppNavigation {
  AppNavigation._();

  static final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();
  static final ValueNotifier<int> homeTabNotifier = ValueNotifier<int>(0);

  /// Switch the main bottom navigation tab on HomeScreen (0: Home, 1: Courses, 2: MyCourses, 3: Notifications, 4: Profile)
  static void switchTab(int index) {
    homeTabNotifier.value = index;
    // Pop any open sub-screens (e.g. cart, scanner, group details) back to home root
    navigatorKey.currentState?.popUntil((route) => route.isFirst);
  }

  /// Centralized link router that handles URLs, custom schemes, and internal paths.
  static void handleLink(
    String rawLink, {
    int? notificationId,
    int? groupId,
    int? lectureId,
  }) {
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

    // 1. Group details: /groups/<groupId> or explicit groupId
    int? targetGroupId = groupId;
    if (cleanLink.contains('/groups/')) {
      final segments = uri?.pathSegments ?? cleanLink.split('/');
      final grpIdx = segments.indexOf('groups');
      if (grpIdx != -1 && grpIdx + 1 < segments.length) {
        targetGroupId = int.tryParse(segments[grpIdx + 1]);
      }
    }
    if (targetGroupId != null && targetGroupId > 0) {
      navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => GroupDetailsScreen(
            groupId: targetGroupId!,
            highlightLectureId: lectureId,
          ),
        ),
      );
      return;
    }

    // 2. Attendance links: /attendance/<lectureId>
    // NEVER auto-mark attendance from notifications! Student must be in class and scan the lecturer's QR code.
    if (cleanLink.contains('/attendance')) {
      final segments = uri?.pathSegments ?? cleanLink.split('/');
      final attendanceIdx = segments.indexOf('attendance');
      final lectureIdStr = (attendanceIdx != -1 && attendanceIdx + 1 < segments.length)
          ? segments[attendanceIdx + 1]
          : null;
      final parsedLectureId = int.tryParse(lectureIdStr ?? '') ?? lectureId;

      navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => QrScannerScreen(targetLectureId: parsedLectureId),
        ),
      );
      return;
    }

    // 3. My Courses: /my-courses
    if (cleanLink.contains('my-courses')) {
      switchTab(2);
      return;
    }

    // 4. Courses Catalog: /courses
    if (cleanLink.contains('courses') && !cleanLink.contains('my-courses')) {
      switchTab(1);
      return;
    }

    // 5. Notifications center: /notifications
    if (cleanLink.contains('notifications')) {
      switchTab(3);
      return;
    }

    // 6. Orders / Cart: /orders or /cart
    if (cleanLink.contains('orders') || cleanLink.contains('cart')) {
      navigatorKey.currentState?.push(
        MaterialPageRoute(builder: (_) => const CartScreen()),
      );
      return;
    }

    // 7. Profile / Certificates: /profile or /certificates
    if (cleanLink.contains('profile') || cleanLink.contains('certificates')) {
      switchTab(4);
      return;
    }

    // 8. Default fallback: Home Dashboard
    switchTab(0);
  }
}
