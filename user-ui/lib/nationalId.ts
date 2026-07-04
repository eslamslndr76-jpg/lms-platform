const GOVERNORATES: Record<string, string> = {
  '01': 'القاهرة', '02': 'الإسكندرية', '03': 'بورسعيد', '04': 'السويس',
  '11': 'دمياط', '12': 'الدقهلية', '13': 'الشرقية', '14': 'القليوبية',
  '15': 'كفر الشيخ', '16': 'الغربية', '17': 'المنوفية', '18': 'البحيرة',
  '19': 'الإسماعيلية', '21': 'الجيزة', '22': 'بني سويف', '23': 'الفيوم',
  '24': 'المنيا', '25': 'أسيوط', '26': 'سوهاج', '27': 'قنا',
  '28': 'أسوان', '29': 'الأقصر', '31': 'البحر الأحمر', '32': 'الوادي الجديد',
  '33': 'مطروح', '34': 'شمال سيناء', '35': 'جنوب سيناء',
  '88': 'خارج الجمهورية',
};

export interface NationalIdInfo {
  valid: boolean;
  birthDate: string;
  gender: 'ذكر' | 'أنثى';
  governorate: string;
  governorateCode: string;
  error?: string;
}

export function parseNationalId(id: string): NationalIdInfo {
  const cleaned = id.replace(/\s/g, '');

  if (!/^\d{14}$/.test(cleaned)) {
    return { valid: false, birthDate: '', gender: 'ذكر', governorate: '', governorateCode: '', error: 'الرقم القومى يجب أن يكون 14 رقماً' };
  }

  const century = cleaned[0];
  const year = cleaned[1] + cleaned[2];
  const month = cleaned[3] + cleaned[4];
  const day = cleaned[5] + cleaned[6];
  const govCode = cleaned[7] + cleaned[8];
  const serial = cleaned.substring(9, 13);

  let fullYear: number;
  if (century === '2') fullYear = 1900 + parseInt(year);
  else if (century === '3') fullYear = 2000 + parseInt(year);
  else return { valid: false, birthDate: '', gender: 'ذكر', governorate: '', governorateCode: '', error: 'رمز القرن غير صالح' };

  const m = parseInt(month);
  const d = parseInt(day);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { valid: false, birthDate: '', gender: 'ذكر', governorate: '', governorateCode: '', error: 'تاريخ الميلاد غير صالح' };
  }

  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  const birthDate = `${fullYear}-${mm}-${dd}`;

  const gov = GOVERNORATES[govCode] || 'غير معروفة';

  const serialNum = parseInt(serial);
  const gender: 'ذكر' | 'أنثى' = serialNum % 2 === 1 ? 'ذكر' : 'أنثى';

  return { valid: true, birthDate, gender, governorate: gov, governorateCode: govCode };
}
