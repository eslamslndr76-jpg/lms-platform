class NationalIdInfo {
  final bool valid;
  final String? birthDate;
  final String? gender;
  final String? governorate;
  final String? error;

  const NationalIdInfo({
    required this.valid,
    this.birthDate,
    this.gender,
    this.governorate,
    this.error,
  });

  static const Map<String, String> governorates = {
    '01': 'القاهرة',
    '02': 'الإسكندرية',
    '03': 'بورسعيد',
    '04': 'السويس',
    '11': 'دمياط',
    '12': 'الدقهلية',
    '13': 'الشرقية',
    '14': 'القليوبية',
    '15': 'كفر الشيخ',
    '16': 'الغربية',
    '17': 'المنوفية',
    '18': 'البحيرة',
    '19': 'الإسماعيلية',
    '21': 'الجيزة',
    '22': 'بني سويف',
    '23': 'الفيوم',
    '24': 'المنيا',
    '25': 'أسيوط',
    '26': 'سوهاج',
    '27': 'قنا',
    '28': 'أسوان',
    '29': 'الأقصر',
    '31': 'البحر الأحمر',
    '32': 'الوادي الجديد',
    '33': 'مطروح',
    '34': 'شمال سيناء',
    '35': 'جنوب سيناء',
    '88': 'خارج الجمهورية',
  };

  factory NationalIdInfo.parse(String id) {
    final cleaned = id.replaceAll(RegExp(r'\s+'), '');

    if (!RegExp(r'^\d{14}$').hasMatch(cleaned)) {
      return const NationalIdInfo(
        valid: false,
        error: 'الرقم القومي يجب أن يتكون من 14 رقماً',
      );
    }

    final century = cleaned[0];
    final year = cleaned.substring(1, 3);
    final month = cleaned.substring(3, 5);
    final day = cleaned.substring(5, 7);
    final govCode = cleaned.substring(7, 9);
    final serial = cleaned.substring(9, 13);

    int fullYear;
    if (century == '2') {
      fullYear = 1900 + int.parse(year);
    } else if (century == '3') {
      fullYear = 2000 + int.parse(year);
    } else {
      return const NationalIdInfo(
        valid: false,
        error: 'رمز القرن غير صالح (يجب أن يبدأ بـ 2 أو 3)',
      );
    }

    final m = int.parse(month);
    final d = int.parse(day);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return const NationalIdInfo(
        valid: false,
        error: 'تاريخ الميلاد المستخرج من الرقم القومي غير صالح',
      );
    }

    final mm = m.toString().padLeft(2, '0');
    final dd = d.toString().padLeft(2, '0');
    final birthDate = '$fullYear-$mm-$dd';

    final gov = governorates[govCode] ?? 'محافظة غير محددة';

    final serialNum = int.tryParse(serial) ?? 0;
    final gender = (serialNum % 2 == 1) ? 'ذكر' : 'أنثى';

    return NationalIdInfo(
      valid: true,
      birthDate: birthDate,
      gender: gender,
      governorate: gov,
    );
  }
}
