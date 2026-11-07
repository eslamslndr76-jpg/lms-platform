import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';

class AppUpdateInfo {
  final String latestVersion;
  final int buildNumber;
  final bool forceUpdate;
  final String title;
  final String message;
  final String downloadUrl;

  const AppUpdateInfo({
    required this.latestVersion,
    required this.buildNumber,
    required this.forceUpdate,
    required this.title,
    required this.message,
    required this.downloadUrl,
  });

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      latestVersion: json['latestVersion'] as String? ?? '1.0.1',
      buildNumber: (json['buildNumber'] as num?)?.toInt() ?? 2,
      forceUpdate: json['forceUpdate'] as bool? ?? false,
      title: json['title'] as String? ?? 'تحديث جديد متوفر',
      message: json['message'] as String? ??
          'يتوفر إصدار أحدث من التطبيق يتضمن تحسينات بالسرعة والخطوط والشعار الجديد. اضغط للتحديث الآن.',
      downloadUrl: json['downloadUrl'] as String? ?? 'https://lms-user.vercel.app/download',
    );
  }
}

class AppUpdateService {
  AppUpdateService._();

  // Current build number of the installed client
  static const int currentBuildNumber = 2;
  static const String currentVersionName = '1.0.1';

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
      // Offline or endpoint unavailable: fallback silently
    } finally {
      _checked = true;
    }
    return _cachedUpdate;
  }

  static Future<void> openDownloadPage([String? url]) async {
    final target = Uri.parse(url ?? 'https://lms-user.vercel.app/download');
    try {
      if (await canLaunchUrl(target)) {
        await launchUrl(target, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
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
                    openDownloadPage(info.downloadUrl);
                    if (!info.forceUpdate) {
                      Navigator.of(ctx).pop();
                    }
                  },
                  icon: const Icon(Icons.download_rounded),
                  label: const Text('اضغط للتحديث الآن'),
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
