import 'dart:io';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/certificate_model.dart';
import 'certificate_pdf_service.dart';

/// مستند الشهادة المحفوظ أوفلاين.
class CertificateDocument {
  final File file;
  final bool isPdf;

  const CertificateDocument({required this.file, required this.isPdf});
}

/// تنزيل/توليد/تخزين/مشاركة الشهادات أوفلاين (المرحلة 14/15).
///
/// 1. يُولَّد **PDF** داخل الجهاز (`CertificatePdfService`) ويُحفظ مرة واحدة،
///    فيُعرض ويُشارك لاحقاً بلا إنترنت.
/// 2. إن فشل التوليد لأي سبب: نسخة HTML من الـ API تُحفظ وتُفتح بالمتصفح.
class CertificateService {
  CertificateService._();

  static Future<Directory> _dir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}${Platform.pathSeparator}certificates');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  static File _pdfFile(Directory dir, int id) =>
      File('${dir.path}${Platform.pathSeparator}certificate_$id.pdf');

  static File _htmlFile(Directory dir, int id) =>
      File('${dir.path}${Platform.pathSeparator}certificate_$id.html');

  static Future<bool> _download(String path, String savePath) async {
    try {
      await ApiClient().dio.download(
        '${ApiConstants.defaultBaseUrl}$path',
        savePath,
        options: Options(responseType: ResponseType.bytes, followRedirects: true),
      );
      final file = File(savePath);
      return await file.exists() && await file.length() > 512;
    } catch (_) {
      try {
        final f = File(savePath);
        if (await f.exists()) await f.delete();
      } catch (_) {}
      return false;
    }
  }

  /// PDF الشهادة (احتياطي أوفلاين فقط): يُولَّد داخل الجهاز.
  /// يُمسح الكاش القديم دائماً لأن التصميم قد يتغير عبر الـ backend.
  static Future<CertificateDocument?> ensurePdf(
    CertificateModel cert, {
    required String studentName,
    required String systemName,
    required String primaryHex,
  }) async {
    final dir = await _dir();
    final file = _pdfFile(dir, cert.id);
    // Clear stale cached PDF so we don't serve an old design.
    if (await file.exists()) {
      try { await file.delete(); } catch (_) {}
    }
    try {
      final generated = await CertificatePdfService.build(
        certificate: cert,
        studentName: studentName,
        systemName: systemName,
        primaryHex: primaryHex,
      );
      return CertificateDocument(file: generated, isPdf: true);
    } catch (_) {
      return null;
    }
  }

  /// نسخة HTML من الـ API — يُنزَّل دائماً لضمان عرض أحدث تصميم للشهادة.
  static Future<CertificateDocument?> ensureHtml(CertificateModel cert) async {
    final dir = await _dir();
    final file = _htmlFile(dir, cert.id);
    // Always re-download to get the latest backend design (self-contained HTML).
    if (await file.exists()) {
      try { await file.delete(); } catch (_) {}
    }
    final ok = await _download('/api/certificates/${cert.id}/html', file.path);
    if (ok) return CertificateDocument(file: file, isPdf: false);
    return null;
  }

  /// مستند جاهز للعرض: HTML من الـ backend أولاً (تصميم محدَّث دائماً)،
  /// يتراجع إلى PDF محلي فقط إذا فشل الاتصال.
  static Future<CertificateDocument?> documentFor(
    CertificateModel cert, {
    required String studentName,
    required String systemName,
    required String primaryHex,
  }) async {
    // 1. Try fresh HTML from backend (matches web design).
    final html = await ensureHtml(cert);
    if (html != null) return html;
    // 2. Fallback: locally-generated PDF (offline).
    return ensurePdf(
      cert,
      studentName: studentName,
      systemName: systemName,
      primaryHex: primaryHex,
    );
  }

  /// مشاركة الشهادة (ملف PDF + كود التحقق).
  static Future<ShareResult?> share(
    CertificateModel cert, {
    required String studentName,
    required String systemName,
    required String primaryHex,
    String? verifyUrl,
  }) async {
    final doc = await ensurePdf(
      cert,
      studentName: studentName,
      systemName: systemName,
      primaryHex: primaryHex,
    );
    final text =
        'شهادة ${cert.titleAr}\nكود التحقق: ${cert.serialId}${verifyUrl == null ? '' : '\n$verifyUrl'}';
    if (doc != null) {
      return Share.shareXFiles(
        [XFile(doc.file.path, mimeType: 'application/pdf')],
        text: text,
      );
    }
    await Share.share(text);
    return null;
  }
}
