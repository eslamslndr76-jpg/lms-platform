import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/theme/branding_provider.dart';
import '../../core/utils/national_id_parser.dart';
import '../../shared/widgets/logo_widget.dart';
import '../home/home_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  int _currentStep = 0;

  // Step 1 Controllers
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  // Step 2 Controllers
  final _nationalIdCtrl = TextEditingController();
  NationalIdInfo? _nationalIdInfo;
  bool _isEnrolled = false;
  final _universityNameCtrl = TextEditingController();
  final _universityCodeCtrl = TextEditingController();

  // Step 3 Controllers
  final _passCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  bool _obscurePass = true;
  bool _obscureConfirmPass = true;

  // Form keys
  final _step1Key = GlobalKey<FormState>();
  final _step2Key = GlobalKey<FormState>();
  final _step3Key = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _nationalIdCtrl.dispose();
    _universityNameCtrl.dispose();
    _universityCodeCtrl.dispose();
    _passCtrl.dispose();
    _confirmPassCtrl.dispose();
    super.dispose();
  }

  void _onNationalIdChanged(String val) {
    final cleaned = val.replaceAll(RegExp(r'\s+'), '');
    if (cleaned.length == 14) {
      setState(() {
        _nationalIdInfo = NationalIdInfo.parse(cleaned);
      });
    } else {
      if (_nationalIdInfo != null) {
        setState(() => _nationalIdInfo = null);
      }
    }
  }

  int _calculatePasswordStrength(String pass) {
    if (pass.isEmpty) return 0;
    int score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (RegExp(r'[a-z]').hasMatch(pass) && RegExp(r'[A-Z]').hasMatch(pass)) score++;
    if (RegExp(r'\d').hasMatch(pass)) score++;
    if (RegExp(r'[^a-zA-Z0-9]').hasMatch(pass)) score++;
    return score.clamp(1, 4);
  }

  void _nextStep() {
    FocusScope.of(context).unfocus();
    if (_currentStep == 0) {
      if (!_step1Key.currentState!.validate()) return;
      setState(() => _currentStep = 1);
    } else if (_currentStep == 1) {
      if (!_step2Key.currentState!.validate()) return;
      if (_nationalIdInfo == null || !_nationalIdInfo!.valid) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_nationalIdInfo?.error ?? 'يرجى إدخال رقم قومي صحيح مكون من 14 رقماً')),
        );
        return;
      }
      setState(() => _currentStep = 2);
    }
  }

  void _prevStep() {
    FocusScope.of(context).unfocus();
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _submitRegister() async {
    FocusScope.of(context).unfocus();
    if (!_step3Key.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    final success = await auth.register(
      name: _nameCtrl.text.trim(),
      email: _emailCtrl.text.trim(),
      password: _passCtrl.text,
      phone: _phoneCtrl.text.trim(),
      nationalId: _nationalIdCtrl.text.trim(),
      birthDate: _nationalIdInfo?.birthDate,
      gender: _nationalIdInfo?.gender,
      governorate: _nationalIdInfo?.governorate,
      isEnrolled: _isEnrolled,
      universityName: _isEnrolled ? _universityNameCtrl.text.trim() : null,
      universityCode: _isEnrolled ? _universityCodeCtrl.text.trim() : null,
    );

    if (success && mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const HomeScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final branding = context.watch<BrandingProvider>().branding;
    final auth = context.watch<AuthProvider>();

    final steps = [
      {'title': 'المعلومات الأساسية', 'icon': Icons.person_outline_rounded},
      {'title': 'الهوية والجامعة', 'icon': Icons.badge_outlined},
      {'title': 'كلمة المرور', 'icon': Icons.lock_outline_rounded},
    ];

    return Scaffold(
      backgroundColor: cs.surface,
      appBar: AppBar(
        title: const Text('إنشاء حساب جديد'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo
                  Center(
                    child: LogoWidget(
                      logoBase64: branding.logoHeader,
                      fallbackText: branding.systemName,
                      size: 64,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'انضم إلى ${branding.systemName}',
                    textAlign: TextAlign.center,
                    style: tt.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: cs.primary,
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Stepper Header ──────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                    decoration: BoxDecoration(
                      color: cs.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: cs.outlineVariant.withValues(alpha: 0.5),
                      ),
                    ),
                    child: Row(
                      children: List.generate(steps.length, (i) {
                        final isActive = i == _currentStep;
                        final isCompleted = i < _currentStep;
                        final icon = steps[i]['icon'] as IconData;

                        return Expanded(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  children: [
                                    AnimatedContainer(
                                      duration: const Duration(milliseconds: 250),
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: isCompleted
                                            ? cs.primary
                                            : isActive
                                                ? cs.primaryContainer
                                                : cs.surfaceContainerHighest,
                                      ),
                                      child: Icon(
                                        isCompleted ? Icons.check_rounded : icon,
                                        size: 18,
                                        color: isCompleted
                                            ? cs.onPrimary
                                            : isActive
                                                ? cs.onPrimaryContainer
                                                : cs.onSurfaceVariant,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      steps[i]['title'] as String,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: isActive ? FontWeight.w800 : FontWeight.w500,
                                        color: isActive ? cs.primary : cs.onSurfaceVariant,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              if (i < steps.length - 1)
                                Container(
                                  width: 24,
                                  height: 2,
                                  color: isCompleted
                                      ? cs.primary
                                      : cs.outlineVariant.withValues(alpha: 0.4),
                                ),
                            ],
                          ),
                        );
                      }),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Step Content Card ───────────────────────────────────
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
                      padding: const EdgeInsets.all(20),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 300),
                        child: _buildStepContent(cs, tt),
                      ),
                    ),
                  ),

                  // Error Display
                  if (auth.error != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: cs.errorContainer,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, color: cs.onErrorContainer, size: 20),
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

                  const SizedBox(height: 20),

                  // ── Navigation Buttons ─────────────────────────────────
                  Row(
                    children: [
                      if (_currentStep > 0) ...[
                        Expanded(
                          flex: 1,
                          child: OutlinedButton(
                            onPressed: auth.loading ? null : _prevStep,
                            child: const Text('السابق'),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        flex: 2,
                        child: FilledButton(
                          onPressed: auth.loading
                              ? null
                              : (_currentStep == 2 ? _submitRegister : _nextStep),
                          child: auth.loading
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(_currentStep == 2 ? 'إتمام التسجيل' : 'التالي'),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Back to Login link
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('لديك حساب بالفعل؟ تسجيل الدخول'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepContent(ColorScheme cs, TextTheme tt) {
    switch (_currentStep) {
      case 0:
        return _buildStep1(cs, tt);
      case 1:
        return _buildStep2(cs, tt);
      case 2:
      default:
        return _buildStep3(cs, tt);
    }
  }

  // ── Step 1: Personal Info ───────────────────────────────────────────────
  Widget _buildStep1(ColorScheme cs, TextTheme tt) {
    return Form(
      key: _step1Key,
      child: Column(
        key: const ValueKey('step1'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'المعلومات الأساسية',
            style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'أدخل اسمك وبيانات التواصل الخاصة بك',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 20),

          // Name
          TextFormField(
            controller: _nameCtrl,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'الاسم الكامل',
              hintText: 'مثال: محمد أحمد',
              prefixIcon: Icon(Icons.person_outline_rounded),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'الاسم مطلوب';
              if (v.trim().length < 3) return 'الاسم قصير جداً';
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Email
          TextFormField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(
              labelText: 'البريد الإلكتروني',
              hintText: 'example@domain.com',
              prefixIcon: Icon(Icons.email_outlined),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'البريد الإلكتروني مطلوب';
              if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v.trim())) {
                return 'يرجى إدخال بريد إلكتروني صحيح';
              }
              return null;
            },
          ),
          const SizedBox(height: 14),

          // Phone
          TextFormField(
            controller: _phoneCtrl,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _nextStep(),
            decoration: const InputDecoration(
              labelText: 'رقم الهاتف (11 رقماً)',
              hintText: '011xxxxxxxx',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'رقم الهاتف مطلوب';
              final cleaned = v.trim().replaceAll(RegExp(r'\s+'), '');
              if (!RegExp(r'^01[0-9]{9}$').hasMatch(cleaned)) {
                return 'يجب أن يبدأ بـ 01 ويتكون من 11 رقماً';
              }
              return null;
            },
          ),
        ],
      ),
    );
  }

  // ── Step 2: National ID & Institute Info ────────────────────────────────
  Widget _buildStep2(ColorScheme cs, TextTheme tt) {
    return Form(
      key: _step2Key,
      child: Column(
        key: const ValueKey('step2'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'بيانات الهوية والجامعة',
            style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'أدخل رقمك القومي المصري للتحقق الآلي',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 20),

          // National ID
          TextFormField(
            controller: _nationalIdCtrl,
            keyboardType: TextInputType.number,
            maxLength: 14,
            onChanged: _onNationalIdChanged,
            decoration: const InputDecoration(
              labelText: 'الرقم القومي (14 رقماً)',
              hintText: '299xxxxxxxxxxx',
              prefixIcon: Icon(Icons.badge_outlined),
              counterText: '',
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return 'الرقم القومي مطلوب';
              final cleaned = v.trim().replaceAll(RegExp(r'\s+'), '');
              if (cleaned.length != 14) return 'الرقم القومي يجب أن يتكون من 14 رقماً';
              final info = NationalIdInfo.parse(cleaned);
              if (!info.valid) return info.error ?? 'رقم قومي غير صالح';
              return null;
            },
          ),

          // Real-time Extraction Preview Card
          if (_nationalIdInfo != null && _nationalIdInfo!.valid) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: cs.primaryContainer.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: cs.primary.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.verified_user_rounded, color: cs.primary, size: 18),
                      const SizedBox(width: 8),
                      Text(
                        'بيانات مستخرجة تلقائياً:',
                        style: TextStyle(
                          color: cs.primary,
                          fontWeight: FontWeight.w800,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('تاريخ الميلاد: ${_nationalIdInfo!.birthDate}', style: const TextStyle(fontSize: 12)),
                      Text('النوع: ${_nationalIdInfo!.gender}', style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('المحافظة: ${_nationalIdInfo!.governorate}', style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),
          const Divider(),

          // Enrolled Switch
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'هل أنت طالب مقيد بجامعة أو معهد؟',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
            ),
            value: _isEnrolled,
            onChanged: (val) => setState(() => _isEnrolled = val),
          ),

          if (_isEnrolled) ...[
            const SizedBox(height: 10),
            TextFormField(
              controller: _universityNameCtrl,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'اسم المعهد أو الجامعة',
                hintText: 'مثال: معهد العلوم الإدارية بالقطامية',
                prefixIcon: Icon(Icons.school_outlined),
              ),
              validator: (v) {
                if (_isEnrolled && (v == null || v.trim().isEmpty)) {
                  return 'يرجى إدخال اسم الجامعة أو المعهد';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _universityCodeCtrl,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _nextStep(),
              decoration: const InputDecoration(
                labelText: 'الكود الجامعي (رقم الطالب)',
                hintText: 'مثال: 20241012',
                prefixIcon: Icon(Icons.tag_rounded),
              ),
              validator: (v) {
                if (_isEnrolled && (v == null || v.trim().isEmpty)) {
                  return 'يرجى إدخال الكود الجامعي';
                }
                return null;
              },
            ),
          ],
        ],
      ),
    );
  }

  // ── Step 3: Password & Confirmation ────────────────────────────────────
  Widget _buildStep3(ColorScheme cs, TextTheme tt) {
    final strength = _calculatePasswordStrength(_passCtrl.text);
    final strengthLabels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'ممتازة'];
    final strengthColors = [cs.error, Colors.orange, Colors.amber.shade700, Colors.teal, Colors.green];

    return Form(
      key: _step3Key,
      child: Column(
        key: const ValueKey('step3'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'كلمة المرور والأمان',
            style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            'أنشئ كلمة مرور قوية لحماية حسابك التعليمي',
            style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 20),

          // Password
          TextFormField(
            controller: _passCtrl,
            obscureText: _obscurePass,
            textInputAction: TextInputAction.next,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'كلمة المرور',
              hintText: '••••••••',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                icon: Icon(_obscurePass ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscurePass = !_obscurePass),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'كلمة المرور مطلوبة';
              if (v.length < 6) return 'يجب ألا تقل عن 6 أحرف أو أرقام';
              return null;
            },
          ),

          // Password Strength Bar
          if (_passCtrl.text.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: List.generate(4, (i) {
                return Expanded(
                  child: Container(
                    height: 4,
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    decoration: BoxDecoration(
                      color: i < strength ? strengthColors[strength] : cs.outlineVariant.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 4),
            Text(
              'قوة كلمة المرور: ${strengthLabels[strength]}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: strengthColors[strength],
              ),
            ),
          ],

          const SizedBox(height: 14),

          // Confirm Password
          TextFormField(
            controller: _confirmPassCtrl,
            obscureText: _obscureConfirmPass,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _submitRegister(),
            decoration: InputDecoration(
              labelText: 'تأكيد كلمة المرور',
              hintText: '••••••••',
              prefixIcon: const Icon(Icons.lock_clock_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirmPass ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                onPressed: () => setState(() => _obscureConfirmPass = !_obscureConfirmPass),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'تأكيد كلمة المرور مطلوب';
              if (v != _passCtrl.text) return 'كلمتا المرور غير متطابقتين';
              return null;
            },
          ),
        ],
      ),
    );
  }
}
