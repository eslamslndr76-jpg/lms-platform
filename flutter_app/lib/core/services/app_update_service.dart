import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
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
          'يتوفر إصدار جديد من تطبيق وحدة التدريب يتضمن ميزة إنشاء حساب جديد، خطوط عصرية، والشعار الرسمي. اضغط للتثبيت الآن.',
      downloadUrl: json['downloadUrl'] as String? ?? 'https://lms-user.vercel.app/download',
      apkDirectUrl: json['apkDirectUrl'] as String? ??
          'https://lms-user.vercel.app/downloads/training-unit.apk',
    );
  }
}

class AppUpdateService {
  AppUpdateService._();

  // Current client build number
  static const int currentBuildNumber = 1;
  static const String currentVersionName = '1.0.0';

  static AppUpdateInfo? _cachedUpdate;
  static bool _checked = false;

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

  /// Downloads the APK directly from within the app and triggers the
  /// Android package installer without external browser navigation.
  static Future<void> downloadAndInstall(
    BuildContext context, {
    String? directApkUrl,
  }) async {
    final apkUrl = directApkUrl ??
        'https://lms-user.vercel.app/downloads/training-unit.apk';

    // Show Progress Dialog
    double progress = 0.0;
    String statusText = 'جارٍ بدء التحميل...';
    String sizeText = '';
    bool isDownloading = true;
    CancelToken cancelToken = CancelToken();

    final dialogContext = context;

    showDialog(
      context: dialogContext,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            final cs = Theme.of(context).colorScheme;
            final tt = Theme.of(context).textTheme;

            return PopScope(
              canPop: false,
              child: AlertDialog(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                title: Row(
                  children: [
                    Icon(
                      Icons.system_update_rounded,
                      color: cs.primary,
                      size: 26,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'تحديث التطبيق تلقائياً',
                      style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      statusText,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: progress > 0 ? progress : null,
                      borderRadius: BorderRadius.circular(8),
                      minHeight: 8,
                    ),
                    if (sizeText.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        sizeText,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: cs.onSurfaceVariant,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Text(
                      'سيتم بدء تثبيت التحديث تلقائياً فور انتهاء التحميل.',
                      style: TextStyle(
                        fontSize: 11,
                        color: cs.onSurfaceVariant.withValues(alpha: 0.8),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: () {
                      cancelToken.cancel();
                      Navigator.of(ctx).pop();
                    },
                    child: const Text('إلغاء'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    try {
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/training-unit.apk';

      // Delete existing temporary apk if exists
      final existingFile = File(savePath);
      if (await existingFile.exists()) {
        await existingFile.delete();
      }

      final dio = Dio();
      await dio.download(
        apkUrl,
        savePath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          if (total > 0 && isDownloading) {
            progress = received / total;
            final recMb = (received / (1024 * 1024)).toStringAsFixed(1);
            final totMb = (total / (1024 * 1024)).toStringAsFixed(1);
            final percent = (progress * 100).toInt();
            sizeText = '$recMb ميجابايت / $totMb ميجابايت ($percent%)';
            statusText = 'جارٍ تحميل التحديث... $percent%';
            // Trigger dialog rebuild
            if (context.mounted) {
              (context as Element).markNeedsBuild();
            }
          }
        },
      );

      // Dismiss progress dialog
      if (dialogContext.mounted) {
        Navigator.of(dialogContext, rootNavigator: true).pop();
      }

      // Automatically launch package installer
      final result = await OpenFilex.open(
        savePath,
        type: 'application/vnd.android.package-archive',
      );

      if (result.type != ResultType.done && dialogContext.mounted) {
        // Fallback to browser download if package installer was blocked
        _fallbackBrowser(dialogContext, apkUrl);
      }
    } catch (e) {
      if (dialogContext.mounted) {
        try {
          Navigator.of(dialogContext, rootNavigator: true).pop();
        } catch (_) {}

        if (e is! DioException || e.type != DioExceptionType.cancel) {
          ScaffoldMessenger.of(dialogContext).showSnackBar(
            const SnackBar(
              content: Text('تعذر التثبيت التلقائي، جارٍ فتح صفحة التحميل...'),
            ),
          );
          _fallbackBrowser(dialogContext, apkUrl);
        }
      }
    }
  }

  static Future<void> _fallbackBrowser(BuildContext context, String apkUrl) async {
    final uri = Uri.parse(apkUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    downloadAndInstall(context, directApkUrl: info.apkDirectUrl);
                  },
                  icon: const Icon(Icons.install_mobile_rounded),
                  label: const Text('تثبيت التحديث الآن من داخل التطبيق'),
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
