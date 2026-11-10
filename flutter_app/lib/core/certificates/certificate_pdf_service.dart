import 'dart:io';
import 'package:flutter/services.dart' show rootBundle;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:qr/qr.dart';
import '../models/certificate_model.dart';

/// توليد شهادة PDF داخل الجهاز — يعمل أوفلاين بلا خدمة خارجية، بخط Cairo العربي،
/// بمقاس A4 أفقي، مع QR للتحقق وتوقيع مدير الوحدة، ويعاد استخدام الملف المحفوظ.
class CertificatePdfService {
  CertificatePdfService._();

  /// اسم مدير وحدة التدريب والتطوير (توقيع الشهادة) — يمكن تجاوزه من الإعدادات.
  static const String defaultDirectorName = 'دكتور شيماء محمد محمد عبد الدايم';
  static const String defaultDirectorTitle = 'مدير وحدة التدريب و التطوير';
  static const String defaultFooterText =
      'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)';

  /// رابط الموقع العام المستخدم في التحقق.
  static const String _webBaseUrl = 'https://lms-user.vercel.app';

  static pw.Font? _regular;
  static pw.Font? _bold;

  static Future<pw.Font> _loadFont({required bool bold}) async {
    if (bold && _bold != null) return _bold!;
    if (!bold && _regular != null) return _regular!;
    final data = await rootBundle.load(
      bold ? 'assets/fonts/Cairo-Bold.ttf' : 'assets/fonts/Cairo-Regular.ttf',
    );
    final font = pw.Font.ttf(data);
    if (bold) {
      _bold = font;
    } else {
      _regular = font;
    }
    return font;
  }

  static PdfColor colorFromHex(String hex, PdfColor fallback) {
    try {
      final cleaned = hex.replaceAll('#', '').trim();
      if (cleaned.length != 6) return fallback;
      final value = int.parse(cleaned, radix: 16);
      return PdfColor.fromInt(0xFF000000 | value);
    } catch (_) {
      return fallback;
    }
  }

  /// QR مرسوم كوحدات سوداء/بيضاء متجهة (بلا صور أو مكتبات صور).
  static pw.Widget _qrWidget(String data, {double size = 62}) {
    final qr = QrImage(
      QrCode.fromData(data: data, errorCorrectLevel: QrErrorCorrectLevel.M),
    );
    final modules = qr.moduleCount;
    final cell = size / modules;
    return pw.Container(
      width: size,
      height: size,
      padding: const pw.EdgeInsets.all(3),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
      ),
      child: pw.Column(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        children: [
          for (var row = 0; row < modules; row++)
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.center,
              children: [
                for (var col = 0; col < modules; col++)
                  pw.Container(
                    width: cell,
                    height: cell,
                    color: qr.isDark(row, col) ? PdfColors.black : PdfColors.white,
                  ),
              ],
            ),
        ],
      ),
    );
  }

  /// يبني ملف PDF للشهادة ويحفظه في مجلد التطبيقات ويعيد الملف.
  static Future<File> build({
    required CertificateModel certificate,
    required String studentName,
    required String systemName,
    required String primaryHex,
    String? directorName,
    String? directorTitle,
    String? footerText,
    String? certificateTitle,
  }) async {
    final regular = await _loadFont(bold: false);
    final bold = await _loadFont(bold: true);
    final primary = colorFromHex(primaryHex, PdfColors.blue800);

    final doc = pw.Document(
      theme: pw.ThemeData.withFont(base: regular, bold: bold),
    );

    final issueDate = _formatDateAr(certificate.issuedAt);
    final verifyUrl = '$_webBaseUrl/verify?serial=${certificate.serialId}';

    final director = (directorName ?? '').trim().isEmpty
        ? defaultDirectorName
        : directorName!.trim();
    final directorTitleResolved = (directorTitle ?? '').trim().isEmpty
        ? defaultDirectorTitle
        : directorTitle!.trim();
    final footer = (footerText ?? '').trim().isEmpty
        ? defaultFooterText
        : footerText!.trim();
    final title = (certificateTitle ?? '').trim().isEmpty
        ? 'شهادة إتمام'
        : certificateTitle!.trim();

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(20),
        build: (context) {
          return pw.Container(
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: primary, width: 3),
            ),
            child: pw.Container(
              padding: const pw.EdgeInsets.symmetric(horizontal: 36, vertical: 24),
              decoration: pw.BoxDecoration(
                border: pw.Border.all(color: primary, width: 0.8),
              ),
              child: pw.Column(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Column(
                    children: [
                      pw.Text(
                        systemName,
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(
                          fontSize: 13,
                          color: primary,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.SizedBox(height: 6),
                      pw.Text(
                        title,
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(
                          fontSize: 34,
                          color: primary,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                      pw.Text(
                        'Certificate of Completion',
                        style: pw.TextStyle(fontSize: 11, color: PdfColors.grey700),
                      ),
                    ],
                  ),
                  pw.Column(
                    children: [
                      pw.Text(
                        'تُمنح هذه الشهادة إلى',
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(fontSize: 13, color: PdfColors.grey800),
                      ),
                      pw.SizedBox(height: 10),
                      pw.Text(
                        studentName,
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(
                          fontSize: 26,
                          fontWeight: pw.FontWeight.bold,
                          color: primary,
                        ),
                      ),
                      pw.SizedBox(height: 14),
                      pw.Text(
                        'لإتمامه دورة',
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(fontSize: 12, color: PdfColors.grey800),
                      ),
                      pw.SizedBox(height: 6),
                      pw.Text(
                        certificate.titleAr,
                        textDirection: pw.TextDirection.rtl,
                        style: pw.TextStyle(
                          fontSize: 18,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.grey900,
                        ),
                      ),
                      if (certificate.titleEn != null &&
                          certificate.titleEn!.trim().isNotEmpty) ...[
                        pw.SizedBox(height: 4),
                        pw.Text(
                          certificate.titleEn!,
                          style: pw.TextStyle(fontSize: 11, color: PdfColors.grey700),
                        ),
                      ],
                    ],
                  ),
                  pw.Column(
                    children: [
                      if (footer.isNotEmpty) ...[
                        pw.Text(
                          footer,
                          textDirection: pw.TextDirection.rtl,
                          textAlign: pw.TextAlign.center,
                          style: pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                        ),
                        pw.SizedBox(height: 12),
                      ],
                      pw.Row(
                        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                        crossAxisAlignment: pw.CrossAxisAlignment.end,
                        children: [
                          pw.Column(
                            crossAxisAlignment: pw.CrossAxisAlignment.start,
                            children: [
                              pw.Text(
                                'تاريخ الإصدار: $issueDate',
                                textDirection: pw.TextDirection.rtl,
                                style: pw.TextStyle(fontSize: 10, color: PdfColors.grey800),
                              ),
                              pw.SizedBox(height: 3),
                              pw.Text(
                                'كود التحقق: ${certificate.serialId}',
                                textDirection: pw.TextDirection.rtl,
                                style: pw.TextStyle(fontSize: 10, color: PdfColors.grey800),
                              ),
                              pw.SizedBox(height: 3),
                              pw.Text(
                                verifyUrl,
                                textDirection: pw.TextDirection.ltr,
                                style: pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
                              ),
                            ],
                          ),
                          _qrWidget(verifyUrl),
                          pw.Column(
                            children: [
                              pw.Text(
                                director,
                                textDirection: pw.TextDirection.rtl,
                                style: pw.TextStyle(
                                  fontSize: 12,
                                  fontWeight: pw.FontWeight.bold,
                                  color: PdfColors.grey900,
                                ),
                              ),
                              pw.Container(
                                width: 150,
                                margin: const pw.EdgeInsets.symmetric(vertical: 4),
                                decoration: const pw.BoxDecoration(
                                  border: pw.Border(
                                    top: pw.BorderSide(color: PdfColors.grey500, width: 0.8),
                                  ),
                                ),
                              ),
                              pw.Text(
                                directorTitleResolved,
                                textDirection: pw.TextDirection.rtl,
                                style: pw.TextStyle(fontSize: 9, color: PdfColors.grey800),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );

    final bytes = await doc.save();
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}${Platform.pathSeparator}certificates');
    if (!await dir.exists()) await dir.create(recursive: true);
    final file = File(
      '${dir.path}${Platform.pathSeparator}certificate_${certificate.id}.pdf',
    );
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  static String _formatDateAr(String raw) {
    final date = DateTime.tryParse(raw);
    if (date == null) return raw;
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
