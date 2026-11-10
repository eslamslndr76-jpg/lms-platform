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

  static bool _looksLikePdf(File file) {
    try {
      final bytes = file.readAsBytesSync();
      if (bytes.length < 5) return false;
      return bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44; // %PD
    } catch (_) {
      return false;
    }
  }

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

  /// PDF الشهادة: يُعاد من الملف المحفوظ، أو يُولَّد داخل الجهاز مرة واحدة.
  static Future<CertificateDocument?> ensurePdf(
    CertificateModel cert, {
    required String studentName,
    required String systemName,
    required String primaryHex,
  }) async {
    final dir = await _dir();
    final file = _pdfFile(dir, cert.id);
    if (await file.exists() && _looksLikePdf(file)) {
      return CertificateDocument(file: file, isPdf: true);
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

  /// نسخة HTML من الـ API (بديل احتياطي فقط).
  static Future<CertificateDocument?> ensureHtml(CertificateModel cert) async {
    final dir = await _dir();
    final file = _htmlFile(dir, cert.id);
    if (await file.exists() && await file.length() > 512) {
      return CertificateDocument(file: file, isPdf: false);
    }
    final ok = await _download('/api/certificates/${cert.id}/html', file.path);
    if (ok) return CertificateDocument(file: file, isPdf: false);
    return null;
  }

  /// مستند جاهز للعرض أوفلاين: PDF إن أمكن، وإلا HTML.
  static Future<CertificateDocument?> documentFor(
    CertificateModel cert, {
    required String studentName,
    required String systemName,
    required String primaryHex,
  }) async {
    final pdf = await ensurePdf(
      cert,
      studentName: studentName,
      systemName: systemName,
      primaryHex: primaryHex,
    );
    if (pdf != null) return pdf;
    return ensureHtml(cert);
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
