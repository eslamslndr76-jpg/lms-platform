import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:provider/provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';
import '../../core/services/app_update_service.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/security/app_lock_service.dart';
import '../../core/utils/json_utils.dart';

/// App settings screen. Items are added across phases:
/// - Update check (phase 8)
/// - Telegram link + notification preferences (phase 10)
/// - App lock & calendar (phase 14)
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

enum _UpdateCheckState { idle, checking, upToDate, available, error }

class _SettingsScreenState extends State<SettingsScreen> {
  final _api = ApiClient();

  String _versionName = '';
  int _buildNumber = 0;

  _UpdateCheckState _checkState = _UpdateCheckState.idle;
  AppUpdateInfo? _updateInfo;
  String? _checkError;

  // Notification preferences
  bool _prefsLoading = true;
  String? _prefsError;
  bool _emailNotifications = true;
  bool _telegramNotifications = true;
  bool _telegramEnabled = false;
  bool _telegramConnected = false;
  String? _telegramBot;

  // App lock (phase 14)
  bool _lockEnabled = false;
  bool _biometricsAvailable = false;
  bool _lockLoading = true;

  @override
  void initState() {
    super.initState();
    _loadVersion();
    _loadNotificationPrefs();
    _loadAppLock();
  }

  Future<void> _loadAppLock() async {
    final available = await AppLockService.isDeviceSupported();
    final enabled = await AppLockService.isEnabled();
    if (!mounted) return;
    setState(() {
      _biometricsAvailable = available;
      _lockEnabled = enabled && available;
      _lockLoading = false;
    });
  }

  Future<void> _toggleAppLock(bool value) async {
    final messenger = ScaffoldMessenger.of(context);
    if (value) {
      final result = await AppLockService.authenticate(
        reason: 'أكّد بصمتك لتفعيل قفل التطبيق',
      );
      if (!mounted) return;
      if (result != BiometricResult.success) {
        messenger.showSnackBar(
          const SnackBar(content: Text('لم يتم التحقق، لم يُفعَّل القفل')),
        );
        return;
      }
      await AppLockService.setEnabled(true);
      if (!mounted) return;
      setState(() => _lockEnabled = true);
      messenger.showSnackBar(
        const SnackBar(content: Text('تم تفعيل قفل التطبيق')),
      );
    } else {
      final result = await AppLockService.authenticate(
        reason: 'أكّد بصمتك لإيقاف قفل التطبيق',
      );
      if (!mounted) return;
      if (result != BiometricResult.success) {
        messenger.showSnackBar(
          const SnackBar(content: Text('لم يتم التحقق، القفل ما زال مفعّلاً')),
        );
        return;
      }
      await AppLockService.setEnabled(false);
      if (!mounted) return;
      setState(() => _lockEnabled = false);
      messenger.showSnackBar(
        const SnackBar(content: Text('تم إيقاف قفل التطبيق')),
      );
    }
  }

  Future<void> _loadVersion() async {
    final name = await AppUpdateService.currentVersionName;
    final build = await AppUpdateService.currentBuildNumber;
    if (!mounted) return;
    setState(() {
      _versionName = name;
      _buildNumber = build;
    });

    final cached = await AppUpdateService.check();
    if (!mounted) return;
    if (cached != null) {
      setState(() {
        _updateInfo = cached;
        _checkState = _UpdateCheckState.available;
      });
    }
  }

  Future<void> _loadNotificationPrefs() async {
    setState(() {
      _prefsLoading = true;
      _prefsError = null;
    });
    try {
      final res = await _api.get(ApiConstants.telegramStatus);
      if (!mounted) return;
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        final email = toJsonMap(data['email']) ?? const {};
        final telegram = toJsonMap(data['telegram']) ?? const {};
        setState(() {
          _emailNotifications = toBool(email['notifications'], fallback: true);
          _telegramNotifications = toBool(telegram['notifications'], fallback: true);
          _telegramEnabled = toBool(telegram['enabled']);
          _telegramConnected = toBool(telegram['connected']);
          _telegramBot = toStrOrNull(telegram['botUsername']);
          _prefsLoading = false;
        });
      } else {
        setState(() {
          _prefsLoading = false;
          _prefsError = 'تعذر تحميل تفضيلات الإشعارات';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _prefsLoading = false;
        _prefsError = 'تعذر الاتصال بالخادم';
      });
    }
  }

  Future<void> _savePref({bool? email, bool? telegram}) async {
    // Optimistic update
    setState(() {
      if (email != null) _emailNotifications = email;
      if (telegram != null) _telegramNotifications = telegram;
    });
    try {
      await _api.patch('/api/notifications/preferences', data: {
        if (email != null) 'email_notifications': email,
        if (telegram != null) 'telegram_notifications': telegram,
      });
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر حفظ التفضيل، حاول مرة أخرى')),
      );
      _loadNotificationPrefs();
    }
  }

  Future<void> _linkTelegram() async {
    try {
      final res = await _api.get(ApiConstants.telegramLink);
      if (!mounted) return;
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        final link = toStrOrNull(data['link']);
        if (link != null) {
          final uri = Uri.parse(link);
          if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
            throw Exception('cannot launch');
          }
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('بعد الضغط على "Start" في تليجرام، عُد وأعد تحديث الصفحة.'),
              duration: Duration(seconds: 5),
            ),
          );
        }
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('بوت تليجرام غير مُهيَّأ حالياً')),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فتح تليجرام')),
      );
    }
  }

  Future<void> _unlinkTelegram() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('فك ربط تليجرام'),
        content: const Text('لن تصلك إشعارات تليجرام بعد فك الربط. هل تريد المتابعة؟'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: const Text('فك الربط')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await _api.post(ApiConstants.telegramUnlink);
      if (!mounted) return;
      setState(() => _telegramConnected = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم فك ربط تليجرام')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تعذر فك الربط، حاول مرة أخرى')),
      );
    }
  }

  Future<void> _checkForUpdate() async {
    setState(() {
      _checkState = _UpdateCheckState.checking;
      _checkError = null;
    });

    try {
      final info = await AppUpdateService.checkNow();
      if (!mounted) return;
      setState(() {
        _updateInfo = info;
        _checkState = info != null ? _UpdateCheckState.available : _UpdateCheckState.upToDate;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _checkState = _UpdateCheckState.error;
        _checkError = 'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت وحاول مرة أخرى.';
      });
    }
  }

  void _startDownload() {
    if (_updateInfo == null) return;
    AppUpdateService.startDownloadWithDialog(
      context: context,
      directApkUrl: _updateInfo!.apkDirectUrl,
      version: _updateInfo!.latestVersion,
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('الإعدادات')),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          _sectionLabel('عام'),
          _updateCard(),
          const SizedBox(height: 8),
          _sectionLabel('الإشعارات'),
          _notificationCard(auth),
          const SizedBox(height: 8),
          _sectionLabel('الأمان'),
          _appLockCard(),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
      child: Text(
        text,
        style: tt.titleSmall?.copyWith(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  // ── App lock (phase 14) ──────────────────────────────────────────────────
  Widget _appLockCard() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (_lockLoading) {
      return const Card(
        elevation: 0,
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    final subtitle = _biometricsAvailable
        ? 'يُطلب عند فتح التطبيق أو العودة إليه بعد ${AppLockService.lockAfterBackground.inMinutes} دقيقة.'
        : 'جهازك لا يدعم البصمة أو الوجه المسجّل، لذلك هذا الخيار غير متاح.';

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SwitchListTile(
        secondary: Icon(Icons.fingerprint_rounded, color: cs.primary),
        title: const Text(
          'قفل التطبيق بالبصمة/الوجه',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(subtitle, style: tt.bodySmall),
        value: _lockEnabled,
        onChanged: _biometricsAvailable ? _toggleAppLock : null,
      ),
    );
  }

  // ── Notification preferences + Telegram ──────────────────────────────────
  Widget _notificationCard(AuthProvider auth) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    if (_prefsLoading) {
      return const Card(
        elevation: 0,
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_prefsError != null) {
      return Card(
        elevation: 0,
        color: cs.surfaceContainerLow,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_prefsError!, style: tt.bodySmall?.copyWith(color: cs.error)),
              const SizedBox(height: 10),
              FilledButton.tonalIcon(
                onPressed: _loadNotificationPrefs,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          SwitchListTile(
            secondary: Icon(Icons.email_outlined, color: cs.primary),
            title: const Text('إشعارات البريد الإلكتروني', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(auth.user?.email ?? '', style: tt.bodySmall),
            value: _emailNotifications,
            onChanged: (v) => _savePref(email: v),
          ),
          const Divider(height: 1),
          SwitchListTile(
            secondary: Icon(Icons.notifications_active_outlined, color: cs.primary),
            title: const Text('إشعارات تليجرام', style: TextStyle(fontWeight: FontWeight.w700)),
            subtitle: Text(
              !_telegramEnabled
                  ? 'غير مُفعَّل من قِبل الإدارة'
                  : _telegramConnected
                      ? 'الحساب مرتبط'
                      : 'الحساب غير مرتبط',
              style: tt.bodySmall,
            ),
            value: _telegramNotifications && _telegramEnabled,
            onChanged: _telegramEnabled ? (v) => _savePref(telegram: v) : null,
          ),
          if (_telegramEnabled) ...[
            const Divider(height: 1),
            ListTile(
              leading: Icon(
                _telegramConnected ? Icons.link_off_rounded : Icons.link_rounded,
                color: cs.primary,
              ),
              title: Text(
                _telegramConnected ? 'فك ربط تليجرام' : 'ربط حساب تليجرام',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Text(
                _telegramConnected
                    ? 'لن تصلك رسائل تليجرام بعد فك الربط'
                    : (_telegramBot != null ? 'افتح البوت @$_telegramBot واضغط Start' : ''),
                style: tt.bodySmall,
              ),
              trailing: const Icon(Icons.chevron_left_rounded),
              onTap: _telegramConnected ? _unlinkTelegram : _linkTelegram,
            ),
          ],
        ],
      ),
    );
  }

  // ── Update check item ─────────────────────────────────────────────────────
  Widget _updateCard() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Card(
      elevation: 0,
      color: cs.surfaceContainerLow,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: cs.primaryContainer,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.system_update_alt_rounded,
                    color: cs.onPrimaryContainer,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'التحقق من التحديثات',
                        style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _versionName.isEmpty
                            ? 'جارٍ قراءة الإصدار...'
                            : 'الإصدار الحالي: $_versionName (بناء $_buildNumber)',
                        style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _updateCardBody(),
          ],
        ),
      ),
    );
  }

  Widget _updateCardBody() {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    switch (_checkState) {
      case _UpdateCheckState.idle:
      case _UpdateCheckState.upToDate:
        return FilledButton.tonalIcon(
          onPressed: _checkForUpdate,
          icon: const Icon(Icons.refresh_rounded, size: 18),
          label: Text(_checkState == _UpdateCheckState.idle ? 'تحقق الآن' : 'تحقق مرة أخرى'),
        );

      case _UpdateCheckState.checking:
        return FilledButton.tonalIcon(
          onPressed: null,
          icon: const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
          label: const Text('جارٍ الفحص...'),
        );

      case _UpdateCheckState.available:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cs.primaryContainer.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.new_releases_rounded, color: cs.primary, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'يوجد إصدار جديد: ${_updateInfo!.latestVersion}',
                      style: tt.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: _startDownload,
              icon: const Icon(Icons.download_rounded, size: 18),
              label: const Text('تنزيل وتثبيت'),
            ),
          ],
        );

      case _UpdateCheckState.error:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _checkError ?? 'حدث خطأ غير متوقع.',
              style: tt.bodySmall?.copyWith(color: cs.error),
            ),
            const SizedBox(height: 10),
            FilledButton.tonalIcon(
              onPressed: _checkForUpdate,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('إعادة المحاولة'),
            ),
          ],
        );
    }
  }
}
