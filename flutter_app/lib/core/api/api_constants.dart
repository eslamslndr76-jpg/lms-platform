import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiConstants {
  // Production URL deployed on Vercel
  static const String prodBaseUrl = 'https://lms-backend-flame-seven.vercel.app';

  // Public student site (used for certificate verification links, phase 14).
  static const String webBaseUrl = 'https://lms-user.vercel.app';

  // Base URL resolver:
  // - In release APK: points to the live production server
  // - In debug Android Emulator: points to 10.0.2.2:3001
  // - Otherwise: points to localhost:3001
  static String get defaultBaseUrl {
    if (kReleaseMode) {
      return prodBaseUrl;
    }
    if (kIsWeb) return 'http://localhost:3001';
    if (Platform.isAndroid) return 'http://10.0.2.2:3001';
    return 'http://localhost:3001';
  }

  // Endpoints
  static const String login = '/api/auth/login';
  static const String register = '/api/auth/register';
  static const String me = '/api/auth/me';
  static const String checkPhone = '/api/auth/check-phone';
  
  static const String branding = '/api/settings/branding';
  static const String courses = '/api/courses';
  static const String categories = '/api/categories';
  static const String orders = '/api/orders';
  static const String myOrders = '/api/orders/my';
  static const String cart = '/api/cart';
  static const String notifications = '/api/notifications';
  static const String unreadNotificationsCount = '/api/notifications/unread-count';
  static const String updateProfile = '/api/auth/profile';
  static const String changePassword = '/api/auth/change-password';
  static const String attendanceMark = '/api/attendance/mark';
  static const String attendancePoll = '/api/attendance/poll';
  static const String certificates = '/api/certificates';
  static const String myCertificates = '/api/certificates/my';
  static const String mySurveys = '/api/surveys/my';
  static const String myGroups = '/api/groups/my/all';
  static const String checkoutRequirements = '/api/orders/checkout-requirements';
  static const String paymentMethods = '/api/payment-methods';
  static const String telegramStatus = '/api/notifications/status';
  static const String telegramLink = '/api/notifications/telegram/link';
  static const String telegramUnlink = '/api/notifications/telegram/unlink';
  static const String forgotPassword = '/api/notifications/forgot-password';
  static const String verifyOtp = '/api/notifications/verify-otp';
  static const String resetPassword = '/api/notifications/reset-password';

  // Instructor APIs (phase 12)
  static const String instructorGroups = '/api/instructor/groups';
  static const String instructorGroupEvaluation = '/api/instructor/groups/:id/evaluation';
  static const String instructorGroupEvaluationDraft = '/api/instructor/groups/:id/evaluation/draft';
  static const String instructorGroupEvaluationSubmit = '/api/instructor/groups/:id/evaluation/submit';
  static const String instructorProposals = '/api/instructor/proposals';
  static const String instructorProposalDetail = '/api/instructor/proposals/:id';
  static const String instructorProposalSubmit = '/api/instructor/proposals/:id/submit';
  static const String instructorProposalWord = '/api/instructor/proposals/:id/word';
}
