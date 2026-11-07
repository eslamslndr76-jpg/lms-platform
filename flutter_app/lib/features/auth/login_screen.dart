import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/services/app_update_service.dart';
import '../../core/theme/branding_provider.dart';
import '../../shared/widgets/logo_widget.dart';
import '../home/home_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _passFocusNode = FocusNode();
  bool _obscurePass = true;
  AppUpdateInfo? _updateInfo;
  bool _updateBannerDismissed = false;

  @override
  void initState() {
    super.initState();
    _checkForUpdate();
  }

  Future<void> _checkForUpdate() async {
    final info = await AppUpdateService.check();
    if (info != null && mounted) {
      setState(() => _updateInfo = info);
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _passFocusNode.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    final success = await auth.login(_emailCtrl.text.trim(), _passCtrl.text);
    if (success && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final branding = context.watch<BrandingProvider>().branding;
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      backgroundColor: cs.surface,
      body: SafeArea(
        child: Column(
          children: [
            // ── In-App Update Banner for Mobile Users ─────────────
            if (_updateInfo != null && !_updateBannerDismissed)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: cs.primaryContainer,
                  border: Border(
                    bottom: BorderSide(
                      color: cs.primary.withValues(alpha: 0.2),
                      width: 1,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.system_update_rounded,
                      size: 22,
                      color: cs.onPrimaryContainer,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'إصدار جديد متوفر للتطبيق! اضغط للتحديث',
                        style: TextStyle(
                          color: cs.onPrimaryContainer,
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                    FilledButton.tonal(
                      onPressed: () =>
                          AppUpdateService.downloadAndInstallBackground(context: context, directApkUrl: _updateInfo!.apkDirectUrl),
                      style: FilledButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      child: const Text('تحديث الآن', style: TextStyle(fontSize: 12)),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      color: cs.onPrimaryContainer,
                      onPressed: () =>
                          setState(() => _updateBannerDismissed = true),
                      tooltip: 'إغلاق',
                    ),
                  ],
                ),
              ),

            // ── Main Scroll View ─────────────────────────────────
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // ── Branding Header ─────────────────────────
                        Center(
                          child: Hero(
                            tag: 'app_logo',
                            child: LogoWidget(
                              logoBase64: branding.logoHeader,
                              fallbackText: branding.systemName,
                              size: 96,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        Text(
                          branding.systemName,
                          textAlign: TextAlign.center,
                          style: tt.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: cs.primary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          branding.sloganAr,
                          textAlign: TextAlign.center,
                          style: tt.bodyMedium?.copyWith(
                            color: cs.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 28),

                        // ── Login Card Form ────────────────────────
                        Card(
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                            side: BorderSide(
                              color: cs.outlineVariant.withValues(alpha: 0.5),
                              width: 1,
                            ),
                          ),
                          color: cs.surfaceContainerLow,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 24, vertical: 28),
                            child: Form(
                              key: _formKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(
                                    'تسجيل الدخول',
                                    style: tt.titleLarge?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: cs.onSurface,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'أدخل بيانات حسابك للمتابعة',
                                    style: tt.bodySmall?.copyWith(
                                      color: cs.onSurfaceVariant,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 24),

                                  // Email or Phone field
                                  TextFormField(
                                    controller: _emailCtrl,
                                    keyboardType: TextInputType.emailAddress,
                                    textInputAction: TextInputAction.next,
                                    onFieldSubmitted: (_) {
                                      FocusScope.of(context)
                                          .requestFocus(_passFocusNode);
                                    },
                                    decoration: InputDecoration(
                                      labelText: 'البريد الإلكتروني أو الهاتف',
                                      hintText: 'example@domain.com',
                                      prefixIcon: Icon(
                                        Icons.account_circle_outlined,
                                        color: cs.primary,
                                      ),
                                    ),
                                    validator: (v) {
                                      if (v == null || v.trim().isEmpty) {
                                        return 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 16),

                                  // Password field
                                  TextFormField(
                                    controller: _passCtrl,
                                    focusNode: _passFocusNode,
                                    obscureText: _obscurePass,
                                    textInputAction: TextInputAction.done,
                                    onFieldSubmitted: (_) => _submit(),
                                    decoration: InputDecoration(
                                      labelText: 'كلمة المرور',
                                      hintText: '••••••••',
                                      prefixIcon: Icon(
                                        Icons.lock_outline_rounded,
                                        color: cs.primary,
                                      ),
                                      suffixIcon: IconButton(
                                        icon: Icon(
                                          _obscurePass
                                              ? Icons.visibility_outlined
                                              : Icons.visibility_off_outlined,
                                          color: cs.onSurfaceVariant,
                                        ),
                                        tooltip: _obscurePass ? 'إظهار' : 'إخفاء',
                                        onPressed: () => setState(
                                            () => _obscurePass = !_obscurePass),
                                      ),
                                    ),
                                    validator: (v) {
                                      if (v == null || v.isEmpty) {
                                        return 'يرجى إدخال كلمة المرور';
                                      }
                                      return null;
                                    },
                                  ),

                                  // Error Display Banner
                                  if (auth.error != null) ...[
                                    const SizedBox(height: 16),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 12,
                                      ),
                                      decoration: BoxDecoration(
                                        color: cs.errorContainer,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(
                                          color: cs.error.withValues(alpha: 0.2),
                                          width: 1,
                                        ),
                                      ),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Icon(
                                            Icons.error_outline_rounded,
                                            color: cs.onErrorContainer,
                                            size: 20,
                                          ),
                                          const SizedBox(width: 10),
                                          Expanded(
                                            child: Text(
                                              auth.error!,
                                              style: TextStyle(
                                                color: cs.onErrorContainer,
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],

                                  const SizedBox(height: 24),

                                  // Submit Button
                                  FilledButton(
                                    onPressed: auth.loading ? null : _submit,
                                    style: FilledButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 14),
                                    ),
                                    child: auth.loading
                                        ? const SizedBox(
                                            height: 22,
                                            width: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                'دخول',
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                              SizedBox(width: 8),
                                              Icon(Icons.arrow_forward_rounded,
                                                  size: 18),
                                            ],
                                          ),
                                  ),

                                  const SizedBox(height: 8),

                                  // Forgot Password
                                  TextButton(
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'لإعادة تعيين كلمة المرور يرجى التواصل مع إدارة المعهد أو مسؤول النظام',
                                          ),
                                        ),
                                      );
                                    },
                                    child: const Text('نسيت كلمة المرور؟'),
                                  ),

                                  const Divider(height: 24),

                                  // ── Create Account Link ───────────
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'ليس لديك حساب؟',
                                        style: tt.bodySmall?.copyWith(
                                          color: cs.onSurfaceVariant,
                                        ),
                                      ),
                                      TextButton(
                                        onPressed: () {
                                          Navigator.of(context).push(
                                            MaterialPageRoute(
                                              builder: (_) =>
                                                  const RegisterScreen(),
                                            ),
                                          );
                                        },
                                        child: const Text(
                                          'إنشاء حساب جديد',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Official Footer
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            branding.messageFooter,
                            textAlign: TextAlign.center,
                            style: tt.bodySmall?.copyWith(
                              color: cs.onSurfaceVariant.withValues(alpha: 0.8),
                              height: 1.5,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
