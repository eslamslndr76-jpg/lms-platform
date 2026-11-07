import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';

class AppUpdateInfo {
  final String latestVersion;
  final int buildNumber;
  final bool forceUpdate;
  final String title;
  final String message;
  final String downloadUrl;
  final String apkDirectUrl;

  const AppUpdateInfo({
    required this.latestVersion,
    required this.buildNumber,
    required this.forceUpdate,
    required this.title,
    required this.message,
    required this.downloadUrl,
    required this.apkDirectUrl,
  });

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      latestVersion: json['latestVersion'] as String? ?? '1.0.1',
      buildNumber: (json['buildNumber'] as num?)?.toInt() ?? 2,
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      title: json['title'] as String? ?? 'تحديث جديد متوفر 🚀',
      message: json['message'] as String? ??
          'يتوفر إصدار جديد من تطبيق وحدة التدريب. اضغط للتثبيت الآن.',
      downloadUrl: json['downloadUrl'] as String? ?? 'https://lms-user.vercel.app/download',
      apkDirectUrl: json['apkDirectUrl'] as String? ??
          'https://lms-user.vercel.app/downloads/training-unit.apk',
    );
  }
}

class AppUpdateService {
  AppUpdateService._();

  static const int currentBuildNumber = 1;
  static const String currentVersionName = '1.0.0';

  static AppUpdateInfo? _cachedUpdate;
  static bool _checked = false;

  // Notification plugin (reuse from local_notification_service channel)
  static final _plugin = FlutterLocalNotificationsPlugin();
  static const _downloadChannelId = 'training_download_channel';
  static const _downloadNotifId = 9999;

  static Future<AppUpdateInfo?> check() async {
    if (_checked) return _cachedUpdate;
    try {
      final res = await ApiClient().get('/api/settings/app-version');
      if (res.statusCode == 200 && res.data != null) {
        final info = AppUpdateInfo.fromJson(res.data as Map<String, dynamic>);
        if (info.buildNumber > currentBuildNumber) {
          _cachedUpdate = info;
        }
      }
    } catch (_) {
      // Silently ignore if offline
    } finally {
      _checked = true;
    }
    return _cachedUpdate;
  }

  /// Downloads the APK in the background with a progress notification.
  /// The user is NOT blocked — they can continue using the app.
  /// When download finishes, a "Tap to install" notification appears.
  static Future<void> downloadAndInstallBackground({
    required BuildContext context,
    String? directApkUrl,
  }) async {
    final apkUrl =
        directApkUrl ?? 'https://lms-user.vercel.app/downloads/training-unit.apk';

    // Ensure download notification channel exists
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(
          const AndroidNotificationChannel(
            _downloadChannelId,
            'تحديثات التطبيق',
            importance: Importance.low,
            showBadge: false,
          ),
        );

    // Show initial "downloading" notification
    await _showProgress(0);

    // Close bottom sheet if open
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();

    // Show snackbar confirming background download
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⬇️ جارٍ تحميل التحديث في الخلفية...'),
          duration: Duration(seconds: 3),
        ),
      );
    }

    try {
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/training-unit-update.apk';

      final existing = File(savePath);
      if (await existing.exists()) await existing.delete();

      final dio = Dio();
      await dio.download(
        apkUrl,
        savePath,
        onReceiveProgress: (received, total) async {
          if (total > 0) {
            final pct = ((received / total) * 100).toInt();
            await _showProgress(pct);
          }
        },
      );

      // Cancel progress notification
      await _plugin.cancel(_downloadNotifId);

      // Show "ready to install" notification
      await _plugin.show(
        _downloadNotifId,
        '✅ التحديث جاهز للتثبيت',
        'اضغط هنا لتثبيت الإصدار الجديد',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _downloadChannelId,
            'تحديثات التطبيق',
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/launcher_icon',
            autoCancel: true,
          ),
        ),
      );

      // Automatically launch installer
      await OpenFilex.open(savePath, type: 'application/vnd.android.package-archive');
    } catch (e) {
      await _plugin.cancel(_downloadNotifId);
      if (e is! DioException || e.type != DioExceptionType.cancel) {
        // Show failure notification
        await _plugin.show(
          _downloadNotifId,
          '❌ فشل التحميل',
          'تعذر تحميل التحديث. اضغط لفتح صفحة التحميل.',
          const NotificationDetails(
            android: AndroidNotificationDetails(
              _downloadChannelId,
              'تحديثات التطبيق',
              importance: Importance.defaultImportance,
              icon: '@mipmap/launcher_icon',
            ),
          ),
        );
        final uri = Uri.parse(apkUrl);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      }
    }
  }

  static Future<void> _showProgress(int percent) async {
    await _plugin.show(
      _downloadNotifId,
      'جارٍ تحميل التحديث... $percent%',
      'وحدة التدريب والتطوير',
      NotificationDetails(
        android: AndroidNotificationDetails(
          _downloadChannelId,
          'تحديثات التطبيق',
          importance: Importance.low,
          priority: Priority.low,
          onlyAlertOnce: true,
          showProgress: true,
          maxProgress: 100,
          progress: percent,
          icon: '@mipmap/launcher_icon',
        ),
      ),
    );
  }

  static void showUpdatePrompt(BuildContext context, AppUpdateInfo info) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    showModalBottomSheet(
      context: context,
      isDismissible: !info.forceUpdate,
      enableDrag: !info.forceUpdate,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return PopScope(
          canPop: !info.forceUpdate,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.system_update_rounded,
                    size: 40,
                    color: cs.onPrimaryContainer,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  info.title,
                  style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  info.message,
                  style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  '✅ سيتم التحميل في الخلفية — يمكنك متابعة استخدام التطبيق',
                  style: tt.bodySmall?.copyWith(
                    color: cs.primary,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () {
                    downloadAndInstallBackground(
                      context: ctx,
                      directApkUrl: info.apkDirectUrl,
                    );
                  },
                  icon: const Icon(Icons.download_rounded),
                  label: const Text('تحميل وتثبيت في الخلفية'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                  ),
                ),
                if (!info.forceUpdate) ...[
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('تذكيري لاحقاً'),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
