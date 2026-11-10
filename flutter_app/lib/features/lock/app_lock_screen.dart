import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/security/app_lock_service.dart';
import '../../core/theme/branding_provider.dart';
import '../../shared/widgets/logo_widget.dart';

/// غطاء القفل عند فتح التطبيق أو العودة من الخلفية (المرحلة 14).
/// بديل البصمة: كلمة مرور الحساب، وبعد [AppLockService.maxPasswordAttempts]
/// محاولات فاشلة يعود التطبيق لتسجيل الدخول العادي.
class AppLockScreen extends StatefulWidget {
  final VoidCallback onUnlocked;

  const AppLockScreen({super.key, required this.onUnlocked});

  @override
  State<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends State<AppLockScreen> {
  final _passCtrl = TextEditingController();
  bool _showPassword = false;
  bool _busy = false;
  bool _autoTried = false;
  int _failedAttempts = 0;
  String? _message;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometrics());
  }

  @override
  void dispose() {
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _tryBiometrics() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _autoTried = true;
      _message = null;
    });

    final result = await AppLockService.authenticate();
    if (!mounted) return;

    if (result == BiometricResult.success) {
      widget.onUnlocked();
      return;
    }

    setState(() {
      _busy = false;
      _showPassword = true;
      _message = switch (result) {
        BiometricResult.unavailable => 'البصمة غير متاحة على هذا الجهاز، أدخل كلمة المرور.',
        BiometricResult.lockedOut => 'البصمة مقفلة مؤقتاً، أدخل كلمة المرور.',
        _ => 'لم يتم التحقق، حاول مرة أخرى أو أدخل كلمة المرور.',
      };
    });
  }

  Future<void> _submitPassword() async {
    final password = _passCtrl.text;
    if (password.isEmpty) {
      setState(() => _message = 'أدخل كلمة المرور');
      return;
    }

    final auth = context.read<AuthProvider>();
    final email = auth.user?.email ?? '';
    if (email.isEmpty) {
      await auth.logout();
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });

    final ok = await auth.login(email, password);
    if (!mounted) return;

    if (ok) {
      widget.onUnlocked();
      return;
    }

    _failedAttempts++;
    if (_failedAttempts >= AppLockService.maxPasswordAttempts) {
      await auth.logout();
      return;
    }

    setState(() {
      _busy = false;
      _passCtrl.clear();
      _message =
          'كلمة المرور غير صحيحة. تبقّى ${AppLockService.maxPasswordAttempts - _failedAttempts} محاولة.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final branding = context.watch<BrandingProvider>().branding;

    return Material(
      color: cs.surface,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),
              LogoWidget(
                logoBase64: branding.logoHeader,
                fallbackText: branding.systemName,
                size: 88,
              ),
              const SizedBox(height: 24),
              Text(
                'التطبيق مقفل',
                style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                'افتح التطبيق للوصول إلى كورساتك وحضورك وشهاداتك.',
                textAlign: TextAlign.center,
                style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant),
              ),
              const SizedBox(height: 32),

              if (!_showPassword)
                FilledButton.icon(
                  onPressed: _busy ? null : _tryBiometrics,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.fingerprint_rounded),
                  label: const Text('فتح بالبصمة'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                )
              else ...[
                TextField(
                  controller: _passCtrl,
                  obscureText: true,
                  textDirection: TextDirection.ltr,
                  autofocus: !_autoTried ? false : true,
                  enabled: !_busy,
                  onSubmitted: (_) => _submitPassword(),
                  decoration: const InputDecoration(
                    labelText: 'كلمة مرور الحساب',
                    prefixIcon: Icon(Icons.lock_outline),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _busy ? null : _submitPassword,
                  icon: _busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.lock_open_rounded),
                  label: const Text('فتح بكلمة المرور'),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                ),
                const SizedBox(height: 10),
                TextButton.icon(
                  onPressed: _busy ? null : _tryBiometrics,
                  icon: const Icon(Icons.fingerprint_rounded),
                  label: const Text('المحاولة بالبصمة'),
                ),
              ],

              if (_message != null) ...[
                const SizedBox(height: 16),
                Text(
                  _message!,
                  textAlign: TextAlign.center,
                  style: tt.bodySmall?.copyWith(color: cs.error),
                ),
              ],
              const Spacer(),
              Text(
                'وحدة التدريب و التطوير · نحو تعليم أفضل',
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
