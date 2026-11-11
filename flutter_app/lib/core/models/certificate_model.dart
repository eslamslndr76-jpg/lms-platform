import '../utils/json_utils.dart';

class CertificateModel {
  final int id;
  final String serialId;
  final String titleAr;
  final String? titleEn;
  final String issuedAt;
  final String status; // 'active' | 'revoked'

  const CertificateModel({
    required this.id,
    required this.serialId,
    required this.titleAr,
    this.titleEn,
    required this.issuedAt,
    this.status = 'active',
  });

  factory CertificateModel.fromJson(Map<String, dynamic> json) {
    return CertificateModel(
      id: toInt(json['id']),
      serialId: toStr(json['serial_id']),
      titleAr: toStrOrNull(json['title_ar']) ?? 'شهادة إتمام دورة',
      titleEn: toStrOrNull(json['title_en']),
      issuedAt: toStr(json['issued_at']),
      status: toStrOrNull(json['status']) ?? 'active',
    );
  }

  bool get isActive => status == 'active';
}
