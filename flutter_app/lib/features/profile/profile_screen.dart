import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/branding_provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';
import '../certificates/certificates_screen.dart';
import '../cart/cart_screen.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final auth = context.watch<AuthProvider>();
    final branding = context.watch<BrandingProvider>().branding;
    final user = auth.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('الملف الشخصي'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // ── User Header Card ──────────────────────────────────────────
            Card(
              color: cs.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 34,
                      backgroundColor: cs.primaryContainer,
                      child: Text(
                        (user?.name.isNotEmpty == true) ? user!.name[0] : 'ط',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: cs.onPrimaryContainer,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.name ?? 'طالب المنصة',
                            style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            user?.email ?? '',
                            style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                            decoration: BoxDecoration(
                              color: cs.primaryContainer,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'طالب متدرب',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: cs.onPrimaryContainer,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Quick Links ───────────────────────────────────────────────
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(Icons.workspace_premium_outlined, color: cs.primary),
                    title: const Text('شهاداتي المعتمدة', style: TextStyle(fontWeight: FontWeight.w700)),
                    trailing: const Icon(Icons.chevron_left_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CertificatesScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.shopping_bag_outlined, color: cs.primary),
                    title: const Text('سلة المشتريات', style: TextStyle(fontWeight: FontWeight.w700)),
                    trailing: const Icon(Icons.chevron_left_rounded),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const CartScreen()),
                      );
                    },
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.lock_outline_rounded, color: cs.primary),
                    title: const Text('تغيير كلمة المرور', style: TextStyle(fontWeight: FontWeight.w700)),
                    trailing: const Icon(Icons.chevron_left_rounded),
                    onTap: () => _showChangePasswordDialog(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // ── About Platform ────────────────────────────────────────────
            Card(
              color: cs.surfaceContainerLow,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Text(
                      branding.systemName,
                      style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      branding.sloganAr,
                      style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      branding.messageFooter,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        color: cs.onSurfaceVariant.withValues(alpha: 0.8),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // ── Logout Button ─────────────────────────────────────────────
            OutlinedButton.icon(
              onPressed: () => _confirmLogout(context),
              icon: Icon(Icons.logout_rounded, color: cs.error),
              label: Text('تسجيل الخروج', style: TextStyle(color: cs.error)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: cs.error.withValues(alpha: 0.5)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد تسجيل الخروج'),
        content: const Text('هل أنت متأكد من رغبتك في تسجيل الخروج من التطبيق؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(ctx).pop();
              final navigator = Navigator.of(context);
              await context.read<AuthProvider>().logout();
              navigator.pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (route) => false,
              );
            },
            child: const Text('تأكيد الخروج'),
          ),
        ],
      ),
    );
  }

  void _showChangePasswordDialog(BuildContext context) {
    final currentPassCtrl = TextEditingController();
    final newPassCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) {
        bool isLoading = false;

        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('تغيير كلمة المرور'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: currentPassCtrl,
                      obscureText: true,
                      textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(
                        labelText: 'كلمة المرور الحالية',
                      ),
                      validator: (v) => (v == null || v.isEmpty) ? 'مطلوب' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: newPassCtrl,
                      obscureText: true,
                      textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(
                        labelText: 'كلمة المرور الجديدة',
                      ),
                      validator: (v) => (v == null || v.length < 6)
                          ? 'يجب أن لا تقل عن 6 أحرف'
                          : null,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('إلغاء'),
                ),
                FilledButton(
                  onPressed: isLoading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setDialogState(() => isLoading = true);
                          final messenger = ScaffoldMessenger.of(context);
                          final nav = Navigator.of(ctx);

                          try {
                            final res = await ApiClient().put(
                              ApiConstants.changePassword,
                              data: {
                                'currentPassword': currentPassCtrl.text,
                                'newPassword': newPassCtrl.text,
                              },
                            );

                            if (res.statusCode == 200) {
                              nav.pop();
                              messenger.showSnackBar(
                                const SnackBar(content: Text('تم تغيير كلمة المرور بنجاح!')),
                              );
                            }
                          } catch (e) {
                            String err = 'فشل تغيير كلمة المرور';
                            try {
                              err = (e as dynamic).response?.data?['error'] ?? err;
                            } catch (_) {}
                            messenger.showSnackBar(
                              SnackBar(content: Text(err), backgroundColor: Colors.red),
                            );
                          } finally {
                            setDialogState(() => isLoading = false);
                          }
                        },
                  child: isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('حفظ التغييرات'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
