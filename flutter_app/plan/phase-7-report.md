# تقرير المرحلة 7: جدول المقارنة + تشخيص مركز الإشعارات

> تاريخ التقرير: 2026-11-10 · `dart analyze`: **No issues found!** (حتى مع سجلات التشخيص المضافة)
> تشغيل التطبيق على محاكي/جهاز: **تعذّر** (لا يوجد جهاز أندرويد متصل لحظة الفحص)، لذا التشخيص تحليل ثابت + أرجح الأسباب، مع سجلات `debugPrint` جاهزة للتشغيل.

---

## 1) جدول المقارنة (ويب الطالب/المحاضر ← التطبيق)

### أ) مغطاة في التطبيق (موجودة، مع ملاحظات)
| صفحة الويب | مقابل التطبيق | ملاحظات الفرق | المرحلة المسؤولة |
|---|---|---|---|
| `/login` | `login_screen` | بدون "نسيت كلمة المرور" | 10 |
| `/register` | `register_screen` | الويب خطوتان + OTP بريد؛ التطبيق بدون OTP ولا `forgot-password` | 10 |
| `/dashboard` | `home_screen` | التطبيق: ترحيب + مجموعاتي + سجل الاشتراكات + جرس. **الويب فيه إضافي:** تنبيهات الاستبيانات المعلقة + تقدم المحاضرات (lecture_progress) + رابط Zoom مباشر | 10 |
| `/my-courses` | `home_screen` + `group_details_screen` | بدون فلتر تبويبات (all/active/completed) ولا شارة اكتمال؛ الحضور من داخل المجموعة | 10 |
| `/attendance/[lectureId]` | `qr_scanner_screen` | موجود. **بلوتوث BLE ما زال داخل الشاشة** (زر + أيقونات) | 8 |
| `/courses` (كتالوج) | جزئياً في `home_screen` | الويب فيه بحث نصي + فلترة تصنيفات + تبديل grid/list — غير موجودة في التطبيق | 10 |
| `/courses/[id]` | `course_details_screen` | موجود (شراء/سلة). **ناقص:** عرض `materials_url` (رابط المادة العلمية — موثق في العقد بتاريخ 2026-11-08) | 10 |
| `/cart` | `cart_screen` | موجود. **ناقص:** قسم "مقترحات لك" (`GET /api/cart/suggestions`) و"تفريغ السلة" | 11 |
| `/account` | `profile_screen` + `certificates_screen` | التطبيق: تعديل أساسي + شهادات. **ناقص:** تبويب كلمة المرور (إن لم تكن موجودة)، حقول birthDate/gender/governorate، ربط Telegram، تحميل PDF الشهادة أوفلاين | 10 / 14 |
| إشعارات (جرس الويب) | `notifications_screen` | موجودة لكن **فارغة بسبب الخطأ الصامت** (انظر §2) | 9 |

### ب) غير موجودة في التطبيق إطلاقاً
| صفحة الويب | الميزات الأساسية | المرحلة المسؤولة |
|---|---|---|
| `/orders` | تفاصيل الطلب، دفع، **إلغاء طلب** (`PATCH /orders/:id/cancel`)، حذف كورس من طلب (`DELETE /orders/:id/items/:courseId`) | 10 (العرض) + 11 (الدفع/الإلغاء) |
| `/checkout` | مراحل review→data→booking→payment→done + `checkout-requirements` + طرق الدفع | 11 |
| `/survey/[groupId]` | استبيان تقييم الدورة: أقسام وأسئلة من الـ API، حفظ draft تلقائي، إرسال، منع التعديل بعد الإرسال | 10 |
| `/instructor` | مجموعاتي كمدرس | 12 |
| `/instructor/evaluate/[groupId]` | تقييم متدربين (أسئلة من API حسب course_mode) + draft/submit | 12 |
| `/instructor/proposals` (+`[id]`) | مقترحات الدورات CRUD + تقديم + شارات حالة | 12 |
| `/verify` | التحقق العام من شهادة بالرقم التسلسلي + PDF | 10 (تقييم الجدوى في 14) |
| `forgot-password` | استعادة كلمة المرور بالـ OTP | 10 |

### ج) مصدر بنود الاستبيان/التقييم/المقترحات
- **الاستبيان:** البنود والمقياس معرّفة في الباكند (`backend/src/services/surveyService.ts`: `SURVEY_SCALE` ~س18، `LECTURER_ITEMS`/`PROGRAM_ITEMS` + `buildSections` ~س331) — الشاشة تعرضها من `GET /api/surveys/my/:groupId`، لا حاجة لتعريفها في التطبيق.
- **تقييم المحاضر للطلاب:** معرّف في `backend/src/services/instructorEvalService.ts` (`buildQuestions()` ~س30 حسب course_mode، مقياس 1–5).
- **المقترحات:** حقول حرة فقط (course_title, objectives, daily_content, materials_url) — الحقول نفسها تُبنى داخل نموذج التطبيق لاحقاً.
- الوحيد المكتوب في الواجهة: قائمة الـ 27 محافظة وخيارات الجنس في `account/page.tsx` (س16–28).

### د) إعادة تصنيف مقابل ما هو مكتوب في المراحل 1–6
- **المرحلة 4 قالت "الاستبيانات" — لا توجد شاشة استبيان في التطبيق فعلياً** (لا ملف في `features/`، ولا استخدام لـ `ApiConstants.mySurveys` خارج تعريفه). أُعيد تصنيفها → المرحلة 10.
- "مركز الإشعارات" من المرحلة 4 موجود كشاشة لكن حالة الخطأ غائبة تماماً (انظر §2).

---

## 2) تشخيص مركز الإشعارات الفارغ

### ما تم فحصه وسليم
- الـ Backend يعيد **مصفوفة خام** من `GET /api/notifications` (استعلام بـ `SELECT *`، صفوف: `id` عدد، `is_read` 0/1 عدد، `created_at` نص UTC، حد 50 عنصر افتراضياً) — مطابقة لما يفترضه `NotificationModel.fromJson`؛ لا يوجد تعارض أسماء حقول.
- مسارات الـ API في `ApiConstants` صحيحة (`/api/notifications` و `/api/notifications/unread-count`).
- التوقيت سليم: الجلب يحدث عند فتح الرئيسية، عند وصول Push (FCM foreground)، عند فتح رابط، وعند فتح الشاشة.
- التوكين يُقرأ من `flutter_secure_storage` بنفس المفتاح `token` الذي يكتبه `AuthProvider`.

### الأسباب الفعلية المرشحة (مرتبة)
1. **الشاشة لا تعرض الخطأ إطلاقاً (سبب مؤكد في الكود):** `notifications_screen.dart` يقرأ `isLoading` و `notifications` فقط، ويتجاهل `provider.error` تماماً — فأي فشل يعرض حالة "سجل الإشعارات فارغ حالياً" وكأنها فارغة حقيقية. هذا عكس قرار صاحب المشروع "المركز لا يظهر فارغاً بسبب خطأ صامت".
2. **`Future.wait` يُسقط الاثنين معاً (مرجح):** طلبا القائمة والعدد متوازيان؛ فشل أحدهما (timeout 15s على سيرفر الإنتاج، انقطاع لحظي، أو 401 لتوكين منتهٍ بعد تغيير الجلسة) يرمي استثناءً واحداً → القائمة تبقى فارغة. الويب يتأثر بالفشل نفسه لكنه يعرض Toast + إعادة محاولة، فلا يبدو "فارغاً".
3. **رد غير 200 يُتجاهل بصمت:** داخل `fetchNotifications`، إن لم يكن `statusCode == 200` أو البيانات ليست List فتُترك `_notifications` كما هي بدون أي رسالة (الفشل هنا لا يمر عبر `catch` إلا مع DioException).
4. **استثناء تحليل صف واحد يُسقط القائمة كلها:** `id: (json['id'] as num)` مثلها يرمي على أول صف شاذ. (لم يُعثر على صف شاذ فعلي في الشيمات الحالية — احتمال منخفض).

**السبب الفعلي الأرجح:** فشل أحد الطلبين المتوازيين (غالباً على سيرفر الإنتاج مع بناء release حيث `baseUrl = lms-backend-flame-seven.vercel.app`)، مع غياب حالة الخطأ في الشاشة فيبدو المركز "فارغاً". لا يوجد خلل في تعيين الحقول أو المسارات.

### سجلات التشخيص المضافة (مؤقتة)
- في `lib/core/notifications/notifications_provider.dart` داخل `fetchNotifications`: حالة كل رد ونوعه وطوله، فشل تحليل أي صف مع محتواه، وأي استثناء مع أول 6 أسطر من الـ stack — جميعها بالبادئة `[NOTIF-DIAG]`.
- طريقة التشغيل لاحقاً: محاكي أندرويد مع `npm run dev:backend` + حساب طالب لديه إشعارات، وفلترة اللوج بـ `[NOTIF-DIAG]`. **تُحذف هذه السجلات في المرحلة 9 مع الإصلاح.**

---

## 3) الفحوصات الأخرى

1. **النطاقات:** `prodBaseUrl = https://lms-backend-flame-seven.vercel.app` (الباكند) — مطابق. المضيف في `AndroidManifest.xml`: `lms-user.vercel.app` (الرسمي في العقد) **+ مضيف زائد قديم `lms-user-psi.vercel.app`** (س63) — يُنصح بحذفه/تأكيده في المرحلة 9.
2. **التحديث:** الإصدار من `pubspec.yaml` (`1.0.2+3`) — ليس ثابتاً في الكود. روابط التنزيل تأتي من `GET /api/settings/app-version` (`downloadUrl`/`apkDirectUrl`) مع قيم fallback ثابتة `https://lms-user.vercel.app/download` و `.../downloads/training-unit.apk` — يجب التأكد لاحقاً أن ملف الـ APK موجود فعلاً على هذا المسار وإلا يسقط التحميل على الـ fallback الخاطئ.
3. **البلوتوث (مواضعه كاملة قبل الإزالة في المرحلة 8):**
   - `pubspec.yaml` س26: `flutter_blue_plus: ^2.3.15`.
   - `AndroidManifest.xml` س17–24: صلاحيات BLUETOOTH + BLUETOOTH_SCAN/CONNECT + uses-feature ble، **وصلاحيات `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` (س22–23) مقترنة بالـ BLE فقط — لا استخدام آخر للموقع في الكود**، تُحذف معها.
   - `attendance_provider.dart` س4 + منطق المسح ~س141–160.
   - `qr_scanner_screen.dart` س254 (أيقونة) وس431 (زر BLE).
   - `ios/Runner/Info.plist`: مجلد iOS غير موجود أصلاً — لا شيء يُحذف منه.
4. **الإشعارات والـ Bottom Sheets (8 مواضع في 5 ملفات):** `app_update_service.dart` (dialog 129 + sheet 160)، `qr_scanner_screen.dart` (dialog 62 + sheets 126/240)، `cart_screen.dart` (dialog 49)، `profile_screen.dart` (dialogان 173/205). **لا يوجد مكوّن Sheet مشترك — قاعدة المرحلة 13 ستحتاج توحيدها.**
5. **التوجيه:** `AppNavigation.handleLink` ما زال سلسلة `contains` (س44–120: groups → attendance → my-courses → courses → notifications → orders/cart → profile/certificates). روابط تقع على الرئيسية بلا هدف: كل روابط الاستبيانات (`/survey/...`)، المحاضر (`/instructor/...`)، `/checkout`، `/account`، `/verify` — منطقي اليوم لغياب الشاشات، ويعاد بناؤه بجدول توجيه مركزي في المرحلة 9.
6. **`dart analyze`:** `No issues found!` على الحالة الحالية (شاملة سجلات التشخيص المضافة).

---

## الخطوة التالية
انتظار موافقة صاحب المشروع على هذا التقرير، ثم البدء بالمرحلة 8 (حذف البلوتوث + شاشة الإعدادات + مكوّن Bottom Sheet المشترك). الإصلاح الفعلي لمركز الإشعارات (حالة خطأ مرئية + فصل الطلبين + تحصين التحليل) في المرحلة 9.
