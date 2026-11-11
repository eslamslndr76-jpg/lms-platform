import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/api/api_client.dart';
import '../../core/utils/json_utils.dart';

/// Public certificate verification: enter the serial id (or scan its QR) and
/// see whether the certificate is valid. Mirrors the web `/verify` page.
class VerifyCertificateScreen extends StatefulWidget {
  const VerifyCertificateScreen({super.key});

  @override
  State<VerifyCertificateScreen> createState() => _VerifyCertificateScreenState();
}

class _VerifyCertificateScreenState extends State<VerifyCertificateScreen> {
  final _api = ApiClient();
  final _serialCtrl = TextEditingController();

  bool _isLoading = false;
  String? _error;
  Map<String, dynamic>? _result;
  bool? _isValid;

  @override
  void dispose() {
    _serialCtrl.dispose();
    super.dispose();
  }

  Future<void> _verify(String rawSerial) async {
    final serial = rawSerial.trim();
    if (serial.isEmpty) {
      setState(() => _error = 'يرجى إدخال رقم الشهادة');
      return;
    }
    setState(() {
      _isLoading = true;
      _error = null;
      _result = null;
      _isValid = null;
    });
    try {
      final res = await _api.get('/api/certificates/verify/${Uri.encodeComponent(serial)}');
      if (!mounted) return;
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        setState(() {
          _isLoading = false;
          _isValid = toBool(data['valid']);
          _result = toJsonMap(data['certificate']) ?? data;
        });
      } else if (res.statusCode == 404) {
        setState(() {
          _isLoading = false;
          _error = 'لم يتم العثور على شهادة بهذا الرقم';
        });
      } else {
        setState(() {
          _isLoading = false;
          _error = 'تعذر التحقق من الشهادة، حاول مرة أخرى';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _error = 'تعذر الاتصال بالخادم';
      });
    }
  }

  Future<void> _scanQr() async {
    final raw = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _QrScanSheet()),
    );
    if (raw == null || !mounted) return;
    // The QR holds a verify URL; extract the serial query param or last segment.
    final uri = Uri.tryParse(raw);
    final serial = uri?.queryParameters['serial'] ??
        (uri != null && uri.pathSegments.isNotEmpty ? uri.pathSegments.last : raw);
    _serialCtrl.text = serial;
    await _verify(serial);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: const Text('التحقق من شهادة')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: cs.primaryContainer.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Icon(Icons.verified_outlined, size: 48, color: cs.primary),
                const SizedBox(height: 10),
                Text(
                  'تحقق من صحة الشهادات الصادرة',
                  style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  'أدخل رقم الشهادة التسلسلي أو امسح رمز الـ QR المطبوع عليها.',
                  textAlign: TextAlign.center,
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant, height: 1.5),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _serialCtrl,
            textDirection: TextDirection.ltr,
            textAlign: TextAlign.center,
            decoration: const InputDecoration(
              labelText: 'رقم الشهادة التسلسلي',
              hintText: 'CERT-2026-0001',
              prefixIcon: Icon(Icons.confirmation_number_outlined),
              border: OutlineInputBorder(),
            ),
            onSubmitted: _verify,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _isLoading ? null : () => _verify(_serialCtrl.text),
                  icon: _isLoading
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.search_rounded),
                  label: const Text('تحقق'),
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.filledTonal(
                onPressed: _isLoading ? null : _scanQr,
                icon: const Icon(Icons.qr_code_scanner_rounded),
                tooltip: 'مسح رمز QR',
                style: IconButton.styleFrom(minimumSize: const Size(50, 50)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          if (_error != null)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: cs.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline_rounded, color: cs.onErrorContainer),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(_error!, style: TextStyle(color: cs.onErrorContainer, fontSize: 13)),
                  ),
                ],
              ),
            ),
          if (_result != null) _buildResult(cs, tt),
        ],
      ),
    );
  }

  Widget _buildResult(ColorScheme cs, TextTheme tt) {
    final valid = _isValid == true;
    final color = valid ? Colors.green.shade700 : cs.error;
    final cert = _result!;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(valid ? Icons.verified_rounded : Icons.gpp_bad_rounded, color: color, size: 32),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  valid ? 'شهادة صحيحة وموثقة' : 'شهادة ملغاة',
                  style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: color),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _row('اسم الطالب', cert['student_name']),
          _row('الدورة', cert['title_ar'] ?? cert['title_en']),
          _row('رقم الشهادة', cert['serial_id']),
          _row('تاريخ الإصدار', cert['issued_at']),
          if (!valid && cert['revoke_reason'] != null) _row('سبب الإلغاء', cert['revoke_reason']),
        ],
      ),
    );
  }

  Widget _row(String label, dynamic value) {
    if (value == null || value.toString().isEmpty) return const SizedBox.shrink();
    final tt = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: tt.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ),
          Expanded(child: Text(value.toString(), style: tt.bodySmall?.copyWith(fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}

/// Full-screen QR scanner returning the raw scanned value.
class _QrScanSheet extends StatefulWidget {
  const _QrScanSheet();

  @override
  State<_QrScanSheet> createState() => _QrScanSheetState();
}

class _QrScanSheetState extends State<_QrScanSheet> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null || raw.isEmpty) return;
    _handled = true;
    Navigator.of(context).pop(raw);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: const Text('مسح رمز الشهادة'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Align(
            alignment: Alignment.center,
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: cs.primary, width: 3),
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),
          const Positioned(
            top: 30,
            left: 20,
            right: 20,
            child: Text(
              'وجّه الكاميرا نحو رمز الـ QR المطبوع على الشهادة',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
