import 'package:add_2_calendar/add_2_calendar.dart';
import 'local_notification_service.dart';

/// نتيجة محاولة إضافة محاضرة إلى تقويم الهاتف.
class CalendarResult {
  final bool opened;
  final bool reminderScheduled;

  const CalendarResult({required this.opened, required this.reminderScheduled});

  String get message {
    if (opened && reminderScheduled) {
      return 'تم فتح التقويم، وسيصلك تذكير قبل المحاضرة بساعة.';
    }
    if (opened) return 'تم فتح التقويم لإضافة المحاضرة.';
    return 'تعذر فتح التقويم على هذا الجهاز.';
  }
}

/// إضافة المحاضرة للتقويم + تذكير محلي قبلها (المرحلة 14).
///
/// - التقويم يُفتح عبر intent تقويم الهاتف (`add_2_calendar`) بلا صلاحيات.
/// - التذكير: إشعار محلي مجدول قبل الموعد بـ [reminderBefore] (يعمل على أندرويد
///   وiOS)، إضافة إلى تنبيه iOS داخل الحدث نفسه.
class CalendarService {
  CalendarService._();

  /// مدة الحدث الافتراضية عند عدم توفر وقت نهاية.
  static const Duration defaultDuration = Duration(hours: 2);

  /// التذكير قبل المحاضرة (قابل للتعديل).
  static const Duration reminderBefore = Duration(hours: 1);

  /// يبني بداية المحاضرة من `date` و`time_from` القادمين من الـ API.
  /// يدعم `YYYY-MM-DD` + `HH:MM[:SS]`، ويتجاهل القيم غير الصالحة.
  static DateTime? parseLectureStart(String date, String timeFrom) {
    final rawDate = date.trim();
    if (rawDate.isEmpty) return null;
    DateTime? day;
    try {
      day = DateTime.tryParse(rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate);
    } catch (_) {
      day = null;
    }
    if (day == null) return null;

    var hour = 0;
    var minute = 0;
    final parts = timeFrom.trim().split(':');
    if (parts.isNotEmpty) {
      hour = int.tryParse(parts[0]) ?? 0;
      if (parts.length > 1) minute = int.tryParse(parts[1]) ?? 0;
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      hour = 0;
      minute = 0;
    }
    return DateTime(day.year, day.month, day.day, hour, minute);
  }

  /// يفتح التقويم بالحدث، ويجدول تذكيراً محلياً قبل الموعد إن أمكن.
  static Future<CalendarResult> addLecture({
    required int lectureId,
    required DateTime start,
    required String title,
    String? description,
    String? location,
    String? link,
  }) async {
    var reminderScheduled = false;
    final reminderAt = start.subtract(reminderBefore);
    if (reminderAt.isAfter(DateTime.now())) {
      try {
        reminderScheduled = await LocalNotificationService.scheduleAt(
          id: 300000 + lectureId,
          when: reminderAt,
          title: 'تذكير بمحاضرة',
          body: '$title — تبدأ بعد ساعة',
          payload: link,
          type: 'lecture_added',
          link: link,
        );
      } catch (_) {
        reminderScheduled = false;
      }
    }

    bool opened = false;
    try {
      opened = await Add2Calendar.addEvent2Cal(
        Event(
          title: title,
          description: description,
          location: (location == null || location.trim().isEmpty) ? null : location,
          startDate: start,
          endDate: start.add(defaultDuration),
          iosParams: const IOSParams(reminder: reminderBefore),
        ),
      );
    } catch (_) {
      opened = false;
    }

    return CalendarResult(opened: opened, reminderScheduled: reminderScheduled);
  }
}
