import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/security/app_lock_service.dart';
import 'app_lock_screen.dart';

/// يغلّف واجهة التطبيق ويضع غطاء القفل فوقها:
/// - عند الفتح إن كان القفل مفعّلاً.
/// - عند العودة من الخلفية بعد [AppLockService.lockAfterBackground].
///
/// الإشعارات تُستقبل وتُسجَّل عادةً؛ القفل غطاء واجهة فقط.
class AppLockGate extends StatefulWidget {
  final Widget child;

  const AppLockGate({super.key, required this.child});

  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  bool _locked = false;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _init() async {
    final enabled = await AppLockService.isEnabled();
    if (!mounted) return;
    setState(() {
      _locked = enabled;
      _ready = true;
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      AppLockService.markPaused();
    } else if (state == AppLifecycleState.resumed) {
      _lockIfNeededOnResume();
    }
  }

  Future<void> _lockIfNeededOnResume() async {
    if (_locked) return;
    final shouldLock = await AppLockService.shouldLockOnResume();
    if (!mounted || !shouldLock) return;
    setState(() => _locked = true);
  }

  Future<void> _unlock() async {
    await AppLockService.clearPaused();
    if (!mounted) return;
    setState(() => _locked = false);
  }

  @override
  Widget build(BuildContext context) {
    final isAuthenticated = context.watch<AuthProvider>().isAuthenticated;

    if (!_ready || !_locked || !isAuthenticated) return widget.child;

    return Stack(
      children: [
        widget.child,
        Positioned.fill(child: AppLockScreen(onUnlocked: _unlock)),
      ],
    );
  }
}
