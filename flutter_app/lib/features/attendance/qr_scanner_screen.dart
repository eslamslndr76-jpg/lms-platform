import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../core/attendance/attendance_provider.dart';

class QrScannerScreen extends StatefulWidget {
  final int? targetLectureId;

  const QrScannerScreen({super.key, this.targetLectureId});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
    torchEnabled: false,
  );

  bool _isProcessing = false;
  bool _isTorchOn = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleBarcode(BarcodeCapture capture) async {
    if (_isProcessing) return;

    final barcode = capture.barcodes.firstOrNull;
    final rawValue = barcode?.rawValue;
    if (rawValue == null || rawValue.isEmpty) return;

    final provider = context.read<AttendanceProvider>();
    final parsed = provider.parseQrData(rawValue);

    if (parsed == null) {
      // Unrecognized QR code
      return;
    }

    final lectureId = parsed['lectureId'] as int;
    final code = parsed['code'] as String;

    setState(() => _isProcessing = true);
    await _controller.stop();

    if (!mounted) return;
    final result = await provider.markAttendance(
      lectureId: lectureId,
      code: code,
      method: 'qr',
    );

    if (!mounted) return;

    if (result.success) {
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.check_circle_rounded, size: 56, color: Theme.of(ctx).colorScheme.primary),
          title: Text(result.alreadyMarked ? 'تم تسجيل حضورك مسبقاً' : 'تم تأكيد الحضور بنجاح!'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                result.message,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Theme.of(ctx).colorScheme.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'كود المحاضرة: $code',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Theme.of(ctx).colorScheme.onPrimaryContainer,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            FilledButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop(true);
              },
              child: const Text('تم'),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      // Resume scanning after 2 seconds
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) {
        setState(() => _isProcessing = false);
        _controller.start();
      }
    }
  }

  void _showManualEntrySheet() {
    final lectureIdCtrl = TextEditingController(
      text: widget.targetLectureId != null ? '${widget.targetLectureId}' : '',
    );
    final codeCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        final cs = Theme.of(ctx).colorScheme;
        final tt = Theme.of(ctx).textTheme;

        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            left: 24,
            right: 24,
            top: 24,
          ),
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'إدخال كود الحضور يدوياً',
                  style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'إذا واجهتك صعوبة في قراءة رمز الـ QR، يمكنك إدخال الكود المكتوب على الشاشة مباشرة.',
                  textAlign: TextAlign.center,
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                ),
                const SizedBox(height: 20),

                // Lecture ID (if not provided)
                if (widget.targetLectureId == null) ...[
                  TextFormField(
                    controller: lectureIdCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'رقم المحاضرة',
                      prefixIcon: Icon(Icons.tag_rounded),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'مطلوب' : null,
                  ),
                  const SizedBox(height: 14),
                ],

                // 6-Character Code
                TextFormField(
                  controller: codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 4,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'كود الحضور (6 أحرف/أرقام)',
                    hintText: 'ABC123',
                  ),
                  validator: (v) {
                    if (v == null || v.trim().length < 4) {
                      return 'يرجى إدخال الكود بشكل صحيح';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                FilledButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    final lecId = widget.targetLectureId ?? int.tryParse(lectureIdCtrl.text.trim());
                    if (lecId == null) return;

                    Navigator.of(ctx).pop();
                    setState(() => _isProcessing = true);

                    final provider = context.read<AttendanceProvider>();
                    final res = await provider.markAttendance(
                      lectureId: lecId,
                      code: codeCtrl.text.trim(),
                      method: 'manual',
                    );

                    if (!mounted) return;
                    setState(() => _isProcessing = false);

                    if (res.success) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(res.message)),
                      );
                      Navigator.of(context).pop(true);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(res.message),
                          backgroundColor: cs.error,
                        ),
                      );
                    }
                  },
                  child: const Text('تأكيد الحضور'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showBleScannerSheet() {
    final provider = context.read<AttendanceProvider>();

    showModalBottomSheet(
      context: context,
      builder: (ctx) {
        return Consumer<AttendanceProvider>(
          builder: (context, att, _) {
            final cs = Theme.of(context).colorScheme;

            return Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.bluetooth_searching_rounded, size: 54, color: cs.primary),
                  const SizedBox(height: 16),
                  const Text(
                    'استشعار الحضور بالبلوتوث (BLE)',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'جاري البحث عن إشارة قاعة المحاضرات للتحقق من تواجدك الفعلي...',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                  ),
                  const SizedBox(height: 20),
                  if (att.isScanningBle)
                    const CircularProgressIndicator()
                  else
                    FilledButton.icon(
                      icon: const Icon(Icons.bluetooth_rounded),
                      label: const Text('بدء المسح الآن'),
                      onPressed: () {
                        provider.startBleScan(
                          onBeaconFound: (lectureId, code) async {
                            Navigator.of(ctx).pop();
                            final messenger = ScaffoldMessenger.of(context);
                            final navigator = Navigator.of(context);
                            final res = await provider.markAttendance(
                              lectureId: lectureId,
                              code: code,
                              method: 'ble',
                            );
                            if (!mounted) return;
                            messenger.showSnackBar(
                              SnackBar(content: Text(res.message)),
                            );
                            if (res.success) navigator.pop(true);
                          },
                        );
                      },
                    ),
                  if (att.error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      att.error!,
                      style: TextStyle(color: cs.error, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('تسجيل الحضور الذكي'),
        actions: [
          // Torch toggle
          IconButton(
            icon: Icon(
              _isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
              color: _isTorchOn ? Colors.amber : Colors.white,
            ),
            tooltip: 'الفلاش',
            onPressed: () {
              setState(() => _isTorchOn = !_isTorchOn);
              _controller.toggleTorch();
            },
          ),
          // Camera switch
          IconButton(
            icon: const Icon(Icons.flip_camera_ios_rounded, color: Colors.white),
            tooltip: 'تبديل الكاميرا',
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── Camera Feed ───────────────────────────────────────────────────
          MobileScanner(
            controller: _controller,
            onDetect: _handleBarcode,
          ),

          // ── Darkened Overlay with Cutout ──────────────────────────────────
          ColorFiltered(
            colorFilter: ColorFilter.mode(
              Colors.black.withValues(alpha: 0.55),
              BlendMode.srcOut,
            ),
            child: Stack(
              children: [
                Container(
                  decoration: const BoxDecoration(
                    color: Colors.transparent,
                  ),
                ),
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    width: 260,
                    height: 260,
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Target Frame Border & Instructions ───────────────────────────
          Align(
            alignment: Alignment.center,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: cs.primary, width: 3),
                borderRadius: BorderRadius.circular(24),
              ),
              child: _isProcessing
                  ? const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    )
                  : null,
            ),
          ),

          // ── Top Hint ──────────────────────────────────────────────────────
          Positioned(
            top: 30,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text(
                'وجّه الكاميرا نحو رمز الـ QR المعروض على شاشة المحاضرة',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
          ),

          // ── Bottom Controls ───────────────────────────────────────────────
          Positioned(
            bottom: 40,
            left: 24,
            right: 24,
            child: Row(
              children: [
                // Manual Entry Button
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: _showManualEntrySheet,
                    icon: const Icon(Icons.keyboard_rounded),
                    label: const Text('كتابة الكود'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white.withValues(alpha: 0.2),
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 12),

                // Bluetooth BLE Button
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _showBleScannerSheet,
                    icon: const Icon(Icons.bluetooth_rounded),
                    label: const Text('بلوتوث BLE'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
