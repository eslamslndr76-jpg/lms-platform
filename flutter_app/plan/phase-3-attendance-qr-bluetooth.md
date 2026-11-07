# المرحلة الثالثة: نظام الحضور الذكي (QR Code & Bluetooth LE)

## هدف المرحلة
تفعيل أقوى الميزات التي تميز تطبيق الموبايل الأصلي (Native Capabilities): تسجيل حضور المحاضرات عبر **كاميرا الموبايل وقراءة الـ QR Code الديناميكي**، واستشعار الحضور التلقائي عبر **البلوتوث منخفض الطاقة (Bluetooth Low Energy - BLE)** لضمان وجود الطالب الفعلي داخل القاعة التدريبية.

---

## 1. المكونات والوظائف التقنية
1. **مسح رمز الاستجابة السريعة (QR Code Scanner):**
   - استخدام مكتبة `mobile_scanner` للوصول المباشر إلى كاميرا الهاتف.
   - واجهة مخصصة للمسح بإطار تفاعلي، تشغيل الفلاش، والتبديل بين الكاميرات.
   - فك تشفير بيانات الـ QR والتحقق من الجلسة في أجزاء من الثانية.
2. **الحضور عبر البلوتوث (BLE Attendance):**
   - استخدام مكتبة `flutter_blue_plus` لمسح إشارات البلوتوث في محيط الطالب.
   - التقاط معرّف المحاضرة (Lecture Beacon UUID / Service Data) الصادر من جهاز المحاضر أو القاعة.
   - قياس قوة الإشارة (RSSI) لضمان تواجد الطالب داخل مسافة الأمان المسموح بها في القاعة ومنع تسجيل الحضور عن بُعد.
3. **التأكيد والتغذية الراجعة:**
   - إرسال بيانات التحقق إلى الخادم عبر `POST /api/attendance/mark`.
   - شاشة نجاح متطورة بأسلوب Material 3 مع اهتزاز تفاعلي (Haptic Feedback) وعرض تفاصيل المحاضرة وتوقيت الحضور.

---

## 2. الصلاحيات المطلوبة في `AndroidManifest.xml`
يجب إضافة الصلاحيات التالية في ملف `android/app/src/main/AndroidManifest.xml`:
```xml
<!-- الكاميرا لمسح الـ QR -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- البلوتوث وتحديد الموقع المطلوب لفحص BLE -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

## 3. الـ Endpoints المرتبطة
- `POST /api/attendance/mark`: تسجيل الحضور (يرسل `lectureId`, `code`, أو `bleToken`).
- `GET /api/attendance/poll`: استعلام دوري عن حالة جلسة الحضور المفتوحة في كورسات الطالب.
- `GET /api/attendance/my/:lectureId`: الاستعلام عن حالة حضور الطالب لمحاضرة محددة.

---

## 4. الخطوات التنفيذية للوكيل
1. تثبيت حزم `mobile_scanner` و `flutter_blue_plus` و `permission_handler`.
2. ضبط ملف `AndroidManifest.xml` بإضافة الصلاحيات المناسبة لـ Android 12+ (API 31+).
3. إنشاء `AttendanceProvider` للتعامل مع تدفقات البلوتوث والكاميرا.
4. إنشاء شاشة مسح الـ QR: `qr_scanner_screen.dart`.
5. إنشاء شاشة استشعار البلوتوث التلقائي: `ble_scanner_widget.dart`.
6. معالجة حالات الرفض (صلاحية الكاميرا مرفوضة، البلوتوث مغلق) بتوجيه واضح للمستخدم لتشغيلها.
7. فحص الكود وتشغيل `dart analyze`.

---

## 5. تعليمات خاصة بالوكيل
- احرص على عدم تشغيل الكاميرا أو مسح البلوتوث في الخلفية دون داعٍ حفاظاً على بطارية الجهاز.
- تأكد من إيقاف المشاهدين (Stream Subscriptions) في دالة `dispose` لمنع أي تسريب في الذاكرة (Memory Leaks).
- **فور الانتهاء من جميع مهام هذه المرحلة والتأكد من فحص الأكواد، يجب على الوكيل استبدال السطر التالي بتأكيد الإنجاز وتاريخ اليوم.**

---

المرحلة تمت بنجاح وتاريخها: 2026-11-07
