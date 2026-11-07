# المرحلة الأولى: البنية التحتية، إعداد البيئة، والمصادقة (Foundation & Authentication)

## هدف المرحلة
تجهيز بيئة عمل Flutter بالكامل على نظام Android، إنشاء المعمارية الأساسية لتطبيق الموبايل، وتطبيق نظام التصميم **Google Material 3** المستند ديناميكياً إلى ألوان وهوية المنصة من الـ Backend API، وإتمام دورة المصادقة وحفظ الجلسات وتأكيد أن الكود خالٍ تماماً من أي أخطاء برمجية (`dart analyze: 0 issues`).

---

## 1. المتطلبات والبيئة التقنية
- **Flutter SDK:** 3.27.1 • Dart 3.6.0
- **Android Toolchain:** Android SDK 36.0.0 + cmdline-tools
- **JDK:** Android Studio JBR
- **الحزم المعتمدة:**
  - `dio`: لإدارة طلبات HTTP والـ Interceptors.
  - `provider`: لإدارة الحالة العامة (State Management).
  - `flutter_secure_storage`: لتخزين JWT Token بأمان تام على الموبايل (EncryptedSharedPreferences).
  - `shared_preferences`: لتخزين التفضيلات العامة.
  - `intl`: لدعم اللغات والتقويم والتنسيقات.
  - `google_fonts`: لاستدعاء خط Cairo للغة العربية.
  - `go_router`: لدعم التوجيه المتقدم.

---

## 2. المهام المنفذة
1. **تثبيت وتهيئة بيئة Flutter:**
   - فحص وتثبيت أدوات الأندرويد وقبول التراخيص (`flutter doctor --android-licenses`).
   - ربط مسار الـ JDK بـ Android Studio JBR.
2. **إنشاء معمارية المشروع:**
   - إنشاء مشروع Flutter مستقل: `d:\مركز تدريب\flutter_app`.
   - تنظيم الهيكل الداخلي: `core` (api, auth, theme, models) و `features` (auth, home, courses) و `shared`.
3. **نظام تصميم Material 3 وهوية المنصة:**
   - إنشاء `AppTheme` مبني على Material 3 يدعم الوضع الفاتح والداكن (Light & Dark Schemes).
   - جلب هوية المنصة ديناميكياً عبر `BrandingProvider` من `/api/settings/branding`.
   - ضبط اتجاه النصوص للغة العربية (RTL) واستخدام خط Cairo.
4. **نظام المصادقة (Authentication):**
   - بناء `ApiClient` مع Interceptor لإرفاق توكن المصادقة تلقائياً `Authorization: Bearer <token>`.
   - بناء `AuthProvider` لدعم عمليات تسجيل الدخول، استرجاع الجلسة عند فتح التطبيق، وتسجيل الخروج.
   - إنشاء شاشة الدخول `LoginScreen` وشاشة الهيكل الأساسي `HomeScreen` وودجت الشعار `LogoWidget`.
5. **الفحص والتأكيد:**
   - تشغيل التحليل الثابت والتأكد من خلو المشروع تماماً من أي تحذيرات أو أخطاء.

---

## 3. الملفات المرتبطة بالمرحلة
- `lib/core/api/api_constants.dart`
- `lib/core/api/api_client.dart`
- `lib/core/theme/app_theme.dart`
- `lib/core/theme/branding_provider.dart`
- `lib/core/auth/auth_provider.dart`
- `lib/features/auth/login_screen.dart`
- `lib/features/home/home_screen.dart`
- `lib/shared/widgets/logo_widget.dart`
- `lib/app.dart`
- `lib/main.dart`

---

## 4. تعليمات لوكيل الذكاء الاصطناعي
- عند تعديل هذه المرحلة مستقبلاً أو إضافة شاشة تسجيل حساب جديد (`RegisterScreen`)، التزم دائماً بالـ Endpoints المحددة في `api_constants.dart`.
- تحقق دائماً بعد أي تعديل بتشغيل:
  ```powershell
  & "D:\flutter\bin\dart.bat" analyze
  ```
- لا تقم بتخزين كلمات المرور أو التوكن في نصوص صريحة؛ استخدم دائماً `FlutterSecureStorage`.

---

المرحلة تمت بنجاح وتاريخها: 2026-11-07
