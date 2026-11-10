import 'package:flutter/material.dart';
import 'dart:async';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';

/// Three-step password reset: request OTP → verify → set a new password.
/// Uses the existing `/api/notifications/{forgot-password,verify-otp,reset-password}`.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

enum _Step { email, otp, password, done }

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _api = ApiClient();
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  _Step _step = _Step.email;
  bool _isLoading = false;
  String? _error;
  bool _obscure = true;
  Timer? _cooldownTimer;
  int _cooldown = 0;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _emailCtrl.dispose();
    _otpCtrl.dispose();
    _passCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  String _readError(dynamic e, String fallback) {
    try {
      final data = (e as dynamic).response?.data;
      if (data is Map && data['error'] != null) return data['error'].toString();
    } catch (_) {}
    return fallback;
  }

  void _startCooldown() {
    _cooldown = 60;
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _cooldown--);
      if (_cooldown <= 0) t.cancel();
    });
  }

  Future<void> _sendCode() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await _api.post(ApiConstants.forgotPassword, data: {'email': email});
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          _step = _Step.otp;
          _isLoading = false;
        });
        _startCooldown();
      } else {
        setState(() {
          _isLoading = false;
          _error = 'تعذر إرسال الرمز، حاول مرة أخرى';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = _readError(e, 'تعذر الاتصال بالخادم');
      });
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpCtrl.text.trim();
    if (otp.length < 4) {
      setState(() => _error = 'يرجى إدخال الرمز المكوَّن من 6 أرقام');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await _api.post(
        ApiConstants.verifyOtp,
        data: {'email': _emailCtrl.text.trim(), 'otp': otp},
      );
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          _step = _Step.password;
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = 'الرمز غير صحيح أو منتهي الصلاحية';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = _readError(e, 'تعذر التحقق من الرمز');
      });
    }
  }

  Future<void> _resetPassword() async {
    final pass = _passCtrl.text;
    if (pass.length < 6) {
      setState(() => _error = 'كلمة المرور يجب ألا تقل عن 6 أحرف');
      return;
    }
    if (pass != _confirmCtrl.text) {
      setState(() => _error = 'كلمتا المرور غير متطابقتين');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final res = await _api.post(
        ApiConstants.resetPassword,
        data: {
          'email': _emailCtrl.text.trim(),
          'otp': _otpCtrl.text.trim(),
          'password': pass,
        },
      );
      if (!mounted) return;
      if (res.statusCode == 200) {
        setState(() {
          _step = _Step.done;
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = 'تعذر تغيير كلمة المرور، حاول مرة أخرى';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = _readError(e, 'تعذر تغيير كلمة المرور');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('استعادة كلمة المرور')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              Icon(Icons.lock_reset_rounded, size: 64, color: cs.primary),
              const SizedBox(height: 20),
              Text(
                switch (_step) {
                  _Step.email => 'أدخل بريدك الإلكتروني',
                  _Step.otp => 'أدخل رمز التحقق',
                  _Step.password => 'كلمة مرور جديدة',
                  _Step.done => 'تم بنجاح',
                },
                textAlign: TextAlign.center,
                style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                switch (_step) {
                  _Step.email => 'سنرسل رمز تحقق إلى بريدك لإعادة التعيين.',
                  _Step.otp => 'أُرسل رمز مكوَّن من 6 أرقام إلى ${_emailCtrl.text.trim()}',
                  _Step.password => 'اختر كلمة مرور جديدة لا تقل عن 6 أحرف.',
                  _Step.done => 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
                },
                textAlign: TextAlign.center,
                style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.5),
              ),
              const SizedBox(height: 24),

              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: cs.errorContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _error!,
                    style: TextStyle(color: cs.onErrorContainer, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 16),
              ],

              ..._buildStepFields(),

              const SizedBox(height: 20),
              _buildPrimaryButton(),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildStepFields() {
    switch (_step) {
      case _Step.email:
        return [
          TextField(
            controller: _emailCtrl,
            keyboardType: TextInputType.emailAddress,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(
              labelText: 'البريد الإلكتروني',
              prefixIcon: Icon(Icons.email_outlined),
              border: OutlineInputBorder(),
            ),
          ),
        ];

      case _Step.otp:
        return [
          TextField(
            controller: _otpCtrl,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            maxLength: 6,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 8),
            decoration: const InputDecoration(
              labelText: 'رمز التحقق',
              hintText: '123456',
              border: OutlineInputBorder(),
              counterText: '',
            ),
          ),
        ];

      case _Step.password:
        return [
          TextField(
            controller: _passCtrl,
            obscureText: _obscure,
            decoration: InputDecoration(
              labelText: 'كلمة المرور الجديدة',
              prefixIcon: const Icon(Icons.lock_outline_rounded),
              suffixIcon: IconButton(
                icon: Icon(_obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded),
                onPressed: () => setState(() => _obscure = !_obscure),
              ),
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _confirmCtrl,
            obscureText: _obscure,
            decoration: const InputDecoration(
              labelText: 'تأكيد كلمة المرور',
              prefixIcon: Icon(Icons.lock_outline_rounded),
              border: OutlineInputBorder(),
            ),
          ),
        ];

      case _Step.done:
        return [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.green.shade700, size: 28),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text('تم تغيير كلمة المرور بنجاح', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        ];
    }
  }

  Widget _buildPrimaryButton() {
    if (_step == _Step.done) {
      return FilledButton.icon(
        onPressed: () => Navigator.of(context).pop(),
        icon: const Icon(Icons.login_rounded),
        label: const Text('العودة لتسجيل الدخول'),
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
      );
    }

    return FilledButton(
      onPressed: _isLoading
          ? null
          : switch (_step) {
              _Step.email => _sendCode,
              _Step.otp => _verifyOtp,
              _Step.password => _resetPassword,
              _Step.done => null,
            },
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
      child: _isLoading
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            )
          : Text(
              switch (_step) {
                _Step.email => 'إرسال الرمز',
                _Step.otp => 'تحقق من الرمز',
                _Step.password => 'تغيير كلمة المرور',
                _Step.done => 'تم',
              },
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
            ),
    );
  }
}
