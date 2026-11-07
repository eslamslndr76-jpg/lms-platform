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

  // Current app release version & build number matching pubspec.yaml (1.0.1+2)
  static const int currentBuildNumber = 2;
  static const String currentVersionName = '1.0.1';

  static AppUpdateInfo? _cachedUpdate;
  static bool _checked = false;

  // Notification plugin (reuse from local_notification_service channel)
  static final _plugin = FlutterLocalNotificationsPlugin();
  static const _downloadChannelId = 'training_download_channel';
  static const _downloadNotifId = 9999;

  static CancelToken? _activeCancelToken;

  static Future<AppUpdateInfo?> check() async {
    if (_checked) return _cachedUpdate;
    try {
      final res = await ApiClient().get('/api/settings/app-version');
      if (res.statusCode == 200 && res.data != null) {
        final info = AppUpdateInfo.fromJson(res.data as Map<String, dynamic>);
        if (info.buildNumber > currentBuildNumber) {
          _cachedUpdate = info;
        } else {
          _cachedUpdate = null;
        }
      }
    } catch (_) {
      // Silently ignore if offline
    } finally {
      _checked = true;
    }
    return _cachedUpdate;
  }

  static Future<void> _initNotificationChannel() async {
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

  /// Cancels an active in-flight APK download.
  static void cancelDownload() {
    _activeCancelToken?.cancel('User cancelled download');
    _activeCancelToken = null;
    _plugin.cancel(_downloadNotifId);
  }

  /// Starts downloading with both an in-app visual dialog and background notification.
  static void startDownloadWithDialog({
    required BuildContext context,
    String? directApkUrl,
    String? version,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _DownloadProgressDialog(
        apkUrl: directApkUrl ?? 'https://lms-user.vercel.app/downloads/training-unit.apk',
        version: version ?? '1.0.1',
      ),
    );
  }

  /// Downloads the APK in the background with progress notification.
  static Future<void> downloadAndInstallBackground({
    required BuildContext context,
    String? directApkUrl,
    String? version,
  }) async {
    startDownloadWithDialog(
      context: context,
      directApkUrl: directApkUrl,
      version: version,
    );
  }

  static void showUpdatePrompt(
    BuildContext context,
    AppUpdateInfo info, {
    VoidCallback? onDismiss,
  }) {
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
          onPopInvokedWithResult: (didPop, _) {
            if (didPop) onDismiss?.call();
          },
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
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: cs.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'الإصدار الحالي: $currentVersionName  ←  الإصدار الجديد: ${info.latestVersion}',
                    style: tt.bodySmall?.copyWith(
                      color: cs.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    onDismiss?.call();
                    startDownloadWithDialog(
                      context: context,
                      directApkUrl: info.apkDirectUrl,
                      version: info.latestVersion,
                    );
                  },
                  icon: const Icon(Icons.download_rounded),
                  label: const Text('تحميل وتثبيت التحديث'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(50),
                  ),
                ),
                if (!info.forceUpdate) ...[
                  const SizedBox(height: 10),
                  TextButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      onDismiss?.call();
                    },
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

/// In-app visual download progress dialog with background & cancel buttons.
class _DownloadProgressDialog extends StatefulWidget {
  final String apkUrl;
  final String version;

  const _DownloadProgressDialog({
    required this.apkUrl,
    required this.version,
  });

  @override
  State<_DownloadProgressDialog> createState() => _DownloadProgressDialogState();
}

class _DownloadProgressDialogState extends State<_DownloadProgressDialog> {
  double _progress = 0.0;
  int _received = 0;
  int _total = 0;
  bool _isDownloading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startDownload();
  }

  Future<void> _startDownload() async {
    await AppUpdateService._initNotificationChannel();
    await AppUpdateService._showProgress(0);

    final cancelToken = CancelToken();
    AppUpdateService._activeCancelToken = cancelToken;

    try {
      final dir = await getTemporaryDirectory();
      final savePath = '${dir.path}/training-unit-update.apk';

      final existing = File(savePath);
      if (await existing.exists()) {
        try {
          await existing.delete();
        } catch (_) {}
      }

      final dio = Dio();
      await dio.download(
        widget.apkUrl,
        savePath,
        cancelToken: cancelToken,
        onReceiveProgress: (received, total) {
          if (!mounted) return;
          if (total > 0) {
            final pct = ((received / total) * 100).toInt();
            AppUpdateService._showProgress(pct);
            setState(() {
              _received = received;
              _total = total;
              _progress = received / total;
            });
          }
        },
      );

      // Download complete
      await AppUpdateService._plugin.cancel(AppUpdateService._downloadNotifId);

      // Notification to install
      await AppUpdateService._plugin.show(
        AppUpdateService._downloadNotifId,
        '✅ اكتمل تحميل التحديث',
        'اضغط هنا لتثبيت الإصدار الجديد',
        const NotificationDetails(
          android: AndroidNotificationDetails(
            AppUpdateService._downloadChannelId,
            'تحديثات التطبيق',
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/launcher_icon',
            autoCancel: true,
          ),
        ),
      );

      if (mounted) {
        Navigator.of(context).pop(); // Close dialog
      }

      // Launch installer
      await OpenFilex.open(savePath, type: 'application/vnd.android.package-archive');
    } catch (e) {
      await AppUpdateService._plugin.cancel(AppUpdateService._downloadNotifId);
      if (e is DioException && CancelToken.isCancel(e)) {
        // User cancelled, do nothing
        return;
      }

      if (mounted) {
        setState(() {
          _isDownloading = false;
          _errorMessage = 'تعذر تحميل التحديث مباشرة. يمكنك فتحه من المتصفح.';
        });
      }
    } finally {
      AppUpdateService._activeCancelToken = null;
    }
  }

  void _cancelDownload() {
    AppUpdateService.cancelDownload();
    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم إلغاء تحميل التحديث'),
          duration: Duration(seconds: 2),
        ),
      );
    }
  }

  void _continueInBackground() {
    if (mounted) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⬇️ يستمر التحميل في الخلفية. ستتلقى إشعاراً فور اكتماله.'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    final pctText = '${(_progress * 100).toInt()}%';
    final mbReceived = (_received / (1024 * 1024)).toStringAsFixed(1);
    final mbTotal = _total > 0 ? (_total / (1024 * 1024)).toStringAsFixed(1) : '--';

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      title: Row(
        children: [
          Icon(Icons.downloading_rounded, color: cs.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _errorMessage != null ? 'تنبيه' : 'جارٍ تحميل التحديث',
              style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_errorMessage != null) ...[
            Text(_errorMessage!, style: tt.bodyMedium),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () async {
                final uri = Uri.parse(widget.apkUrl);
                if (await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
                if (context.mounted) Navigator.of(context).pop();
              },
              icon: const Icon(Icons.open_in_browser_rounded),
              label: const Text('فتح في المتصفح'),
            ),
          ] else ...[
            Text(
              'الإصدار: ${widget.version}',
              style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: _progress > 0 ? _progress : null,
                minHeight: 10,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '$mbReceived / $mbTotal MB',
                  style: tt.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: cs.onSurfaceVariant,
                  ),
                ),
                Text(
                  pctText,
                  style: tt.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: cs.primary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
      actions: [
        if (_isDownloading && _errorMessage == null) ...[
          TextButton.icon(
            onPressed: _cancelDownload,
            icon: const Icon(Icons.close_rounded, size: 18),
            label: const Text('إلغاء التحميل'),
            style: TextButton.styleFrom(foregroundColor: cs.error),
          ),
          FilledButton.tonalIcon(
            onPressed: _continueInBackground,
            icon: const Icon(Icons.arrow_downward_rounded, size: 18),
            label: const Text('متابعة في الخلفية'),
          ),
        ] else ...[
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('إغلاق'),
          ),
        ],
      ],
    );
  }
}
