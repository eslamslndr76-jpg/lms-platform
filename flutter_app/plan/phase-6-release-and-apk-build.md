# المرحلة السادسة: إعدادات الإطلاق وتوليد ملف التثبيت (Release & APK Build)

## هدف المرحلة
الوصول إلى المنتج النهائي الجاهز للتثبيت والتوزيع: إعداد هوية التطبيق البصرية (الأيقونة وشاشة البداية)، توقيع التطبيق بشهادة الحماية (Keystore Signing)، بناء ملف التثبيت الفعلي للأندرويد **(Release APK)** و **(App Bundle - AAB)**، وتجهيز آلية التحديث الإجباري التلقائي (Force Update).

---

## 1. المكونات والوظائف التقنية
1. **هوية التطبيق الرسمية (App Branding & Icons):**
   - تعيين الاسم العربي الرسمي في `AndroidManifest.xml`: `"وحدة التدريب و التطوير"`.
   - توليد أيقونات التطبيق التكيفية (Adaptive Icons) لجميع كثافات شاشات أندرويد عبر `flutter_launcher_icons`.
   - تجهيز شاشة البداية الأصلية (Native Splash Screen) بشعار المنصة عبر `flutter_native_splash`.
2. **توقيع التطبيق وتأمينه (Android Keystore Signing):**
   - توليد مفتاح التوقيع الرقمي للإنتاج باستخدام `keytool`:
     ```powershell
     keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
     ```
   - إعداد ملف `android/key.properties` وربطه مع `android/app/build.gradle` في كتلة `signingConfigs.release`.
3. **آلية التحديث الإجباري (Force Update):**
   - مقارنة رقم إصدار التطبيق الحالي في `pubspec.yaml` (مثلاً `1.0.0+1`) مع أقل إصدار مسموح به من الخادم.
   - في حال وجود تحديث إلزامي يتضمن تغييرات برمجية، تظهر شاشة توقف أنيقة تمنع المتابعة وتوفر زراً فورياً لتحميل التحديث وتثبيته.
4. **أوامر البناء وتوليد الحزم:**
   - بناء ملف الـ APK النهائي للإنتاج:
     ```powershell
     & "D:\flutter\bin\flutter.bat" build apk --release
     ```
   - بناء حزمة متجر جوجل بلاي (AAB):
     ```powershell
     & "D:\flutter\bin\flutter.bat" build appbundle --release
     ```
   - مسار ملف الـ APK النهائي الناتج:
     `d:\مركز تدريب\flutter_app\build\app\outputs\flutter-apk\app-release.apk`
5. **تجهيز نظام iOS للمستقبل:**
   - توحيد معرف الحزمة (Bundle ID): `com.trainingunit.flutterApp`.
   - جاهزية المشروع للأرشفة والتجميع عبر Xcode على أجهزة Mac دون تعديل في الكود المصدري.

---

## 2. الخطوات التنفيذية للوكيل
1. تثبيت وضبط حزم `flutter_launcher_icons` و `flutter_native_splash` في `pubspec.yaml`.
2. توليد الأيقونات وشاشات البداية وتشغيل أمر `flutter pub run flutter_launcher_icons`.
3. التحقق من سلامة تكوين `build.gradle` و `compileSdk` و `minSdk` (الحد الأدنى المدعوم API 21+).
4. تشغيل أمر التحليل النهائي `dart analyze` والتأكد التام من 0 أخطاء.
5. تنفيذ أمر بناء ملف الـ APK والتأكد من إتمامه بنجاح وحفظ مسار الملف للمستخدم.

---

## 3. تعليمات خاصة بالوكيل
- لا تقم بتضمين ملف `key.properties` أو كلمات مرور التوقيع داخل مستودع Git العام؛ استخدم ملفات `.gitignore` المناسبة.
- تأكد من تجربة تشغيل ملف الـ APK على هاتف حقيقي أو محاكي بعد البناء للتحقق من سرعة الإقلاع وسلامة الشاشات.
- **فور الانتهاء من جميع مهام هذه المرحلة وبناء ملف التثبيت بنجاح، يجب على الوكيل استبدال السطر التالي بتأكيد الإنجاز وتاريخ اليوم ومسار ملف الـ APK الناتج.**

---

المرحلة تمت بنجاح وتاريخها: 2026-11-07 - مسار ملف التثبيت: d:\مركز تدريب\flutter_app\build\app\outputs\flutter-apk\app-release.apk
