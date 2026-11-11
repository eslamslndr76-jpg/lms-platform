import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../../core/attendance/attendance_provider.dart';
import '../../core/widgets/app_bottom_sheet.dart';
import '../../core/utils/json_utils.dart';

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

    final lectureId = toIntOrNull(parsed['lectureId']);
    final code = toStr(parsed['code']);
    if (lectureId == null || code.isEmpty) {
      // Unrecognized QR code
      return;
    }

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
      final cs = Theme.of(context).colorScheme;
      await AppBottomSheet.show(
        context: context,
        title: result.alreadyMarked ? 'تم تسجيل حضورك مسبقاً' : 'تم تأكيد الحضور بنجاح!',
        subtitle: 'كود المحاضرة: $code',
        body: (ctx, scrollController) => Padding(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.check_circle_rounded, size: 56, color: cs.primary),
              const SizedBox(height: 12),
              Text(
                result.message,
                textAlign: TextAlign.center,
                style: Theme.of(ctx).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: cs.primaryContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'كود المحاضرة: $code',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: cs.onPrimaryContainer,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('تم'),
          ),
        ],
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
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

    final cs = Theme.of(context).colorScheme;

    AppBottomSheet.show(
      context: context,
      title: 'إدخال كود الحضور يدوياً',
      subtitle:
          'إذا واجهتك صعوبة في قراءة رمز الـ QR، أدخل الكود المكتوب على الشاشة مباشرة.',
      body: (ctx, scrollController) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
        child: Form(
          key: formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
            ],
          ),
        ),
      ),
      actions: [
        FilledButton(
          onPressed: () async {
            if (!formKey.currentState!.validate()) return;
            final lecId = widget.targetLectureId ?? int.tryParse(lectureIdCtrl.text.trim());
            if (lecId == null) return;

            Navigator.of(context).pop();
            if (!mounted) return;
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('مسح رمز الحضور (QR)'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: Icon(_isTorchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded),
            onPressed: () {
              _controller.toggleTorch();
              setState(() => _isTorchOn = !_isTorchOn);
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          // Camera scanner
          MobileScanner(
            controller: _controller,
            onDetect: _handleBarcode,
          ),

          // Darkened Overlay with Cutout
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

          // Target Frame Border & Instructions
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

          // Top Hint
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

          // Bottom Controls
          Positioned(
            bottom: 40,
            left: 24,
            right: 24,
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.tonalIcon(
                onPressed: _showManualEntrySheet,
                icon: const Icon(Icons.keyboard_rounded),
                label: const Text('كتابة الكود يدوياً'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.2),
                  foregroundColor: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
