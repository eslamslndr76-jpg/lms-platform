# عقد الـ API بين المنصة والتطبيق (`api-contract.md`)

> يكتبه وكيل المنصة من الكود الفعلي. وكيل التطبيق يقرأه فقط ولا يعدّل إلا القسم 11.
> المصدر: `backend/src/routes/*` و`backend/src/services/*` بتاريخ 2026-11-10.

## 1. عام

| البند | القيمة |
|---|---|
| النطاق الرسمي للواجهة | `https://lms-user.vercel.app` |
| قاعدة الـ API | `NEXT_PUBLIC_API_URL` + `/api` (تطوير: `http://localhost:3001`، محاكي أندرويد: `http://10.0.2.2:3001`) |
| الصيغة | JSON (`Content-Type: application/json`)، مهلة العميل 15 ثانية |
| المصادقة | `Authorization: Bearer <JWT>` |
| شكل الـ JWT | `{ userId, roleId, role }` — `role`: `admin` \| `employee` \| `student` \| `instructor` (لا يتغيّر) |
| شكل الخطأ | `{ "error": "رسالة عربية" }` — استثناء الحضور يضيف `success:false` |
| الأكواد | 400 مدخلات، 401 توكن، 403 صلاحية، 404 غير موجود، 409 تعارض، 413 حجم، 500 عام |
| CORS | الطلبات بلا `Origin` مسموحة دائماً (التطبيق)، والويب حسب القائمة البيضاء |

**تسجيل الدخول** — `POST /api/auth/login` → `{ "email": "<بريد أو هاتف>", "password": "..." }` (اسم الحقل `email` كما هو للتوافق).

- البريد غير حساس لحالة الأحرف/المسافات، والهاتف يُقبل بأي صيغة مصرية (`01155644315` أو `+201155644315` أو `1155644315`).
- الرد: `200 { token, user }`. `400` بيانات ناقصة، `401` «لا يوجد حساب بهذا البريد الإلكتروني أو رقم الهاتف» أو «كلمة المرور غير صحيحة»، `403` «هذا الحساب موقوف…».

## 2. طرق الدفع

`GET /api/payment-methods` — (مستخدم مسجّل) الطرق النشطة فقط، والطريقة الرقمية بلا رقم حساب تُخفى.

```json
[{ "id": 3, "key": "instapay", "label": "إنستا باي", "kind": "digital",
   "account_number": "01000000000", "account_name": "وحدة التدريب",
   "instructions": "حوّل ثم أرفق صورة التحويل", "sort_order": 1 }]
```

`kind`: `cash` (الدفع في الخزنة) أو `digital` (يتطلب إيصالاً).

## 3. الطلبات

| المسار | الدور | الوظيفة |
|---|---|---|
| `POST /api/orders` | student | إنشاء حجز |
| `PATCH /api/orders/:id/pay` | صاحب الطلب | اختيار طريقة الدفع / إرسال الإيصال |
| `PATCH /api/orders/:id/cancel` | صاحب الطلب | إلغاء حجزه غير المدفوع (pending أو review) |
| `DELETE /api/orders/:id/items/:courseId` | صاحب الطلب | حذف كورس من حجز غير مدفوع (يُعاد حساب الإجمالي؛ آخر كورس يلغي الطلب) |
| `PATCH /api/orders/:id/receipt` | صاحب الطلب | رفع إيصال (توافق مع النسخ القديمة) |
| `GET /api/orders/my` | مستخدم | كل طلباتي |
| `GET /api/orders/my/:id` | صاحب الطلب | تفصيل طلب + مجموعاتي |
| `GET /api/orders/my/check/:courseId` | مستخدم | هل اشترى الكورس / هل له شهادة |
| `GET /api/orders/checkout-requirements` | مستخدم | الحقول الناقصة قبل الدفع |
| `PUT /api/auth/profile` | مستخدم | تحديث بيانات الحساب (بما فيها الحقول الناقصة) |
| `DELETE /api/admin/orders/:id/items/:courseId` | admin/employee | حذف كورس من طلب (يشمل المدفوع: يُخرج الطالب من مجموعات الكورس ويُعاد حساب الإجمالي، بلا تسجيل مبلغ استرداد) |

**إنشاء حجز** — `POST /api/orders`

```json
{ "items": [{ "course_id": 12 }, { "course_id": 15 }],
  "payment_method": "instapay", "note_student": "ملاحظة", "sender_phone": "01...0000",
  "receipt_url": "data:image/jpeg;base64,..." }
```

- يُقبل أيضاً `items:[12,15]` أو الحقل القديم `course_id`.
- الحد: 20 كورساً في الطلب. الرد: `201 { id, status, amount, message, items:[{course_id}] }`.
- **الحجز يُؤكَّد في الخطوة الأخيرة فقط:** عند إرسال `payment_method` مع الطلب (وهو ما تفعله المنصة والتطبيق: الدفع = آخر خطوة) يُنشأ الطلب بحالته النهائية مباشرة: `digital` → `review` **بشرط** وجود `receipt` و`sender_phone` وإلا 400، و`cash` → `pending`، ويُرسل إشعار `order_created` («تم تأكيد حجزك») **مرة واحدة**.
- العملاء القديمة (التطبيق المثبَّت قبل 1.0.6) تنشئ الطلب بلا بيانات دفع ثم تنادي `/pay`؛ في هذه الحالة **لا يُرسل أي إشعار عند الإنشاء**، ويُرسل إشعار التأكيد من `/pay` (أو من `PATCH /api/orders/:id/receipt` القديم).
- 409 إذا كان أحد الكورسات مدفوعاً أو داخل طلب مفتوح: `{ error, course_id, status }`.
- **السلة على السيرفر:** عند نجاح الحجز (من المنصة أو التطبيق أو طلب يدوي من الأدمن) تُحذف **كورسات الطلب فقط** من سلة صاحبه ويبقى باقي السلة كما هو؛ "اشترِ الآن" كذلك. فشل الحجز لا يغيّر السلة، والإلغاء أو انتهاء الحجز لا يعيد الكورس للسلة.
- `POST /api/cart` يرفض بـ 409 الكورس **المدفوع** أو **داخل طلب مفتوح** بنفس رسالتي الطلبات (`مدفوع بالفعل` / `داخل طلب مفتوح`) ويرجع `{ error, course_id, status }`؛ الكورس الذي أُلغي طلبه أو انتهى يمكن إضافته.
- `GET /api/cart` يحذف قبل الإرجاع أي كورس مدفوع أو داخل طلب مفتوح (تنظيف السلال القديمة) ويعيد نفس الشكل `{ items, total, count }`.

**الدفع** — `PATCH /api/orders/:id/pay`

```json
{ "payment_method": "instapay", "sender_phone": "01000000000",
  "receipt": "data:image/jpeg;base64,...", "note_student": "اختياري" }
```

- `digital`: الإيصال و`sender_phone` إلزاميان → الحالة `review`.
- `cash`: بلا إيصال → تبقى `pending`.
- الرد: `{ id, status, message }`. 409 لطلب مدفوع/ملغي، 413 لحجم إيصال كبير.

**حالات الطلب**

| status | المعنى عند الطالب |
|---|---|
| `pending` | حجز بانتظار الدفع |
| `review` | الإيصال قيد مراجعة الإدارة |
| `paid` | مدفوع ومؤكَّد |
| `cancelled` | ملغي |

- **انتهاء الحجز تلقائياً:** الطلب `pending` غير المدفوع يُلغى تلقائياً بعد **مدة الحجز** (افتراضياً 168 ساعة = 7 أيام، تُعدَّل من لوحة الأدمن `GET/PUT /api/settings/booking` بالحقل `hours` من 1 إلى 720). الطلب `review` لا ينتهي تلقائياً. يُرسل إشعار `order_expired` للطالب ويصبح بإمكانه الحجز من جديد.
- **سبب الإلغاء:** كل طلب ملغي يحمل `cancel_reason`: `student` (الطالب ألغى حجزه) | `admin` (الإدارة) | `expired` (انتهت المدة). حقل اختياري قد يكون `null` في الطلبات القديمة.

**قائمة/تفصيل** — كل عنصر طلب يضم: `id, status, amount, payment_method, notes_student, sender_phone, cancel_reason, created_at, course_id, title_ar, title_en, items:[{course_id,title_ar,title_en,instructor,course_mode,image_url,price}], receipt:{file_url,payment_method,verified_by,verified_at,created_at}|null`. التفصيل يضيف `groups:[{id,name,course_id,instructor_name,location,start_date,end_date,is_complete,zoom_link}]`.

**التحقق من الشراء** — `GET /api/orders/my/check/:courseId` → `{ hasPaidOrder, hasCertificate, serialId }`.

**الحقول الناقصة** — `GET /api/orders/checkout-requirements` → `{ missing_fields:[{key,label}] }`، المفاتيح: `name`, `phone`, `national_id` (14 رقماً)، و`university_name`/`university_code` عند `is_enrolled=1`.

**الحساب** — `PUT /api/auth/profile` يقبل `name, phone, avatar, birthDate, gender, governorate, universityName, universityCode, nationalId (14 رقماً), isEnrolled` ويرجع صف المستخدم كاملاً (`national_id`, `is_enrolled`).

## 4. الإيصال

- الصيغة: **data URL** لصورة JPEG مضغوطة (`data:image/jpeg;base64,...`) — لا يوجد endpoint رفع ملف لهذا الغرض.
- الحد الأقصى: 2,097,152 حرفاً (~2MB) → 413 `حجم الإيصال أكبر من 2MB، اضغط الصورة وحاول مرة أخرى`.
- الإيصال يُحفظ صفاً واحداً لكل طلب (يُستبدل عند التحديث) ويُدقّق من الأدمن.
- للعميل: `compressAndEncode` (800px، JPEG 0.7) قبل الإرسال.

## 5. الإشعارات

`GET /api/notifications?limit=20&offset=0` (الافتراضي 20/0؛ `limit` أقصاه 50) يعيد صفوف مركز الإشعارات (`id, title, message, type, link, is_read, created_at`) و`GET /api/notifications/unread-count` عدد غير المقروء. `offset` للترقيم: صفحة أقصر من `limit` = نهاية القائمة. حقول FCM (`data`): `link`, `type` (فئة: `info`/`success`/`warning`)، `notificationId`, `groupId`, `lectureId`, `orderId`, `courseId`.

| نوع الإشعار | `link` | الشاشة في الويب |
|---|---|---|
| `account_created`, `password_reset_done` | `/account` | الحساب |
| `attendance_opened` | `/attendance/<lectureId>` | صفحة الحضور (مسح/إدخال الكود) |
| `attendance_confirmed` | `/my-courses` | كورساتي |
| `certificate_issued`, `certificate_restored`, `certificate_revoked` | `/account?tab=certificates` | الحساب ← الشهادات |
| `order_created`, `order_paid`, `order_cancelled` | `/orders` | طلباتي |
| `order_expired` (انتهت مدة الحجز) | `/orders` | طلباتي |
| `order_course_removed` (حذف كورس من الطلب) | `/orders` | طلباتي |
| `survey_opened`, `survey_reminder` | `/survey/<groupId>` | الاستبيان |
| `instructor_eval_opened` | `/instructor/evaluate/<groupId>` (أو `/instructor`) | تقييم الطلاب |
| `instructor_eval_submitted` | `/instructor` | لوحة المحاضر |
| `proposal_reviewed` | `/instructor/proposals/<proposalId>` | مقترح الكورس |
| `lecture_completed` | `/courses/<courseId>` (أو `/my-courses`) | صفحة الكورس |
| `assigned_to_group`, `moved_to_group`, `removed_from_group`, `lecture_added`, `group_completed` | `/my-courses` | كورساتي |

## 6. الحضور وروابط QR

- قيمة الـ QR: `<FRONTEND_URL>/attendance/<lectureId>?code=<CODE>` (نص الرابط نفسه؛ التطبيق يقبل أيضاً JSON `{"v":1,"c":"<CODE>"}`).
- الكود 6 خانات hex، يتغيّر كل **15 ثانية**، ويُقبل الكود الحالي والسابق (≈30 ثانية سماح).
- `POST /api/attendance/mark` (student) — `{ lectureId, code, method: "qr"|"manual" }` → `{ success:true, message }` أو `{ success:false, error }`؛ `alreadyMarked:true` إن سبق التسجيل. أخطاء: 400 (بيانات ناقصة/كود خاطئ/الجلسة غير نشطة)، 403 (ليس في المجموعة).
- `GET /api/attendance/:lectureId/current` (مستخدم) → `{ code, qrData, expiresIn }`.
- للأدمن: `POST /api/attendance/:lectureId/start` → `{ seed, code, qrData, expiresAt, expiresIn }`، و`POST /api/attendance/stop/:lectureId`.
- ملاحظة: التطبيق يسجّل الحضور بـ QR فقط (لا Bluetooth).

## 7. إصدار التطبيق

`GET /api/settings/app-version` (عام بلا توكن):

```json
{ "latestVersion": "1.0.2", "buildNumber": 3, "forceUpdate": false,
  "title": "تحديث جديد متوفر", "message": "...",
  "downloadUrl": "https://lms-user.vercel.app/download", "apkDirectUrl": "" }
```

`apkDirectUrl` رابط APK مباشر اختياري (فارغ = استخدم `downloadUrl`). الحفظ بنفس الحقول عبر `PUT` (ADMIN فقط).

**بث إشعار التحديث:** عند حفظ `buildNumber` أحدث من السابق يُبث إشعار فوري لكل مستخدمي التطبيق (طلبة ومحاضرين) عبر مركز الإشعارات + FCM + البريد + تليجرام (link = `/download`)، والرد يضم `broadcastCount`. ويمكن إعادة البث يدوياً في أي وقت: `POST /api/settings/app-version/broadcast` (ADMIN) → `{ success, count, message }`.

## 8. الاستبيان وتقييم المحاضر والمقترحات

**الاستبيان** — الطالب:

| المسار | الوظيفة |
|---|---|
| `GET /api/surveys/my` | المجموعات المكتملة وحالة الاستبيان |
| `GET /api/surveys/my/:groupId` | تعريف الاستبيان + المسودة |
| `PUT /api/surveys/my/:groupId/draft` | حفظ تلقائي |
| `POST /api/surveys/my/:groupId/submit` | إرسال نهائي (مرة واحدة) |

عنصر القائمة: `{ group_id, group_name, course_title, course_mode, completed_at, closes_at, days_left, status, answered_at, updated_at }`، `status`: `pending` \| `draft` \| `submitted` \| `closed`.

`GET my/:groupId` → `{ available, status (not_open|closed|submitted|draft|pending), can_edit, is_closed, closes_at, days_left, group:{...}, student:{name}, sections:[{key,title,items:[{key,label}]}], helped, notes_label, scale:[{value,label}] (1..5), settings:{openDays}, response }`.

جسم الحفظ/الإرسال: `{ "answers": { "<item key>": 1..5 }, "is_anonymous": false, "current_step": 2 }` — أي بند ناقص يرفض الإرسال (400).

> بنود الاستبيان تُعرَّف في الـ backend (`surveyService.buildSections` / `SURVEY_SCALE`)، لا في الويب ولا في التطبيق؛ التطبيق يرسم `sections` كما تصل.

**تقييم المحاضر للطلاب** (role `instructor`، يُفتح بعد إنهاء المجموعة):

| المسار | الوظيفة |
|---|---|
| `GET /api/instructor/groups/:id/evaluation` | الأسئلة + درجات الطلاب |
| `PUT /api/instructor/groups/:id/evaluation/draft` | حفظ مؤقت |
| `POST /api/instructor/groups/:id/evaluation/submit` | إرسال نهائي (يُقفل) |

الرد: `{ group, status (not_open|draft|submitted), questions:[{key,label}], scale:[{value,label}] (1..5), students:[{ id, name, scores:[...], total, complete }] }`.
جسم الحفظ: `{ "scores": { "<studentId>": [5,4,5,...] } }` (طول المصفوفة = عدد الأسئلة، والقيمة 1..5 أو `null`).

**مقترح كورس** (role `instructor`):

| المسار | الوظيفة |
|---|---|
| `GET /api/instructor/proposals` · `GET /:id` | مقترحات المحاضر |
| `POST /api/instructor/proposals` | مسودة جديدة |
| `PUT /api/instructor/proposals/:id` | تعديل (في `draft` أو `needs_changes` فقط) |
| `POST /api/instructor/proposals/:id/submit` | تقديم للإدارة |
| `GET /api/instructor/proposals/:id/word` | تنزيل Word |

الجسم: `{ course_title, objectives:[string], daily_content:[{...}], materials_url }` (`materials_url` http(s) ≤ 500 حرف).
`status`: `draft` مسودة · `submitted` مقدَّم · `approved` مقبول · `rejected` مرفوض · `needs_changes` مطلوب تعديل (يُقرأ أيضاً `status_label` و`admin_note`).

## 9. مسارات إضافية (طلبات التطبيق، موظفون)

| المسار | الدور | الوظيفة |
|---|---|---|
| `GET /api/courses/:id` | مستخدم | كائن الكورس يتضمّن `materials_url` (رابط المادة العلمية؛ يُعرض للطالب المسجَّل والموظف فقط) |
| `GET /api/groups/:id/report` | admin/employee | بيانات تقرير المجموعة (الطلاب والحضور والاستبيان) |
| `POST /api/groups/:id/report/word` | admin/employee | تنزيل تقرير Word؛ حقل multipart اختياري `images` (حتى 8 صور JPG/PNG، لا تُخزَّن) |
| `GET /api/settings/report` | مستخدم | نصوص التقرير الافتراضية (المنسق، الشهادة، الملاحظات، التوصيات، نوع النشاط) |
| `PUT /api/settings/report` | admin | حفظ النصوص الافتراضية |
| `GET /api/exports/:dataset?groupId=` | صلاحية القراءة للقسم | ملف Excel: `group_roster` (كشف المجموعة) · `survey_results` (نتائج الاستبيان + متوسطات البنود) · `instructor_eval` (تقييم المحاضر للطلاب) |
| `GET/POST/PUT/DELETE /api/admin/payment-methods` | admin | إدارة طرق الدفع (الطرق المستخدمة في طلبات تُعطَّل ولا تُحذف) |
| `GET /api/settings/booking` | admin/employee | مدة الحجز بالساعات `{ hours }` (افتراضي 168) |
| `PUT /api/settings/booking` | admin | تعديل مدة الحجز (1..720 ساعة) |
| `POST /api/auth/refresh` | مستخدم | تجديد التوكن: `{ token }` (صالح أو منتهٍ بحد 30 يوماً) ويعيد `{ token, expires_in }`؛ يعيد فحص نشاط الحساب. شكل الـ JWT ثابت `{ userId, roleId, role }` |

## 10. App Links
- **اسم الحزمة (`applicationId`):** `com.trainingunit.flutter_app`
- **النطاق الرسمي:** `https://lms-user.vercel.app`
- **`assetlinks.json`:** `user-ui/public/.well-known/assetlinks.json` → `https://lms-user.vercel.app/.well-known/assetlinks.json`، يُخدم `200` و`Content-Type: application/json` بلا إعادة توجيه (تم التحقق محلياً على Next dev).
- **مفتاح التوقيع:** مفتاح الإنتاج `flutter_app/android/app/upload-keystore.jks` (alias `upload` في `key.properties`). أي APK موقّع بمفتاح آخر (debug مثلاً) لن يطابق البصمة ولن يفتح الروابط داخله.
- **بصمة SHA-256 لشهادة التوقيع:** `2E:DC:2D:E3:20:7B:92:A3:66:93:3C:07:9C:25:A3:11:ED:97:4D:63:CF:D3:11:AF:DE:47:97:D8:CE:79:15:A9`
- **وكيل التطبيق:** اضبط في `AndroidManifest.xml` فلتر `intent-filter` مع `android:autoVerify="true"` على المضيف `lms-user.vercel.app` ومساراته (`/attendance`، `/courses`، `/orders` …)، ووقّع نسخة الإنتاج بنفس الـ keystore أعلاه.

## 11. طلبات التطبيق للمنصة
<!-- وكيل التطبيق يضيف هنا فقط. الصيغة: التاريخ | المرحلة | الطلب | السبب | الحالة (مفتوح/معتمد/منفّذ) -->

| التاريخ | المرحلة | الطلب | السبب | الحالة |
|---|---|---|---|---|
| 2026-11-10 | 14 | `GET /api/certificates/:id/pdf` — ملف PDF جاهز للشهادة (نفس حماية `/html`: صاحب الشهادة أو أدمن، ويرفض الملغاة) | الشهادة تُبنى HTML ويُولَّد الـ PDF في المتصفح، ولا يمكن توليده على Vercel (يحتاج Chromium) | ✅ أُغلق بلا حاجة للمنصة — التطبيق يولّد PDF على الجهاز بخط Cairo (`certificate_pdf_service.dart`) ويحفظه للمشاركة أوفلاين |
| 2026-11-10 | 14 | `POST /api/auth/refresh` — تجديد التوكن قبل انتهائه (body: `{ token }` أو header، يرد `{ token }`) | لا يوجد مسار تجديد؛ التطبيق الآن يعالج 401 بإعادة المستخدم لتسجيل الدخول، ومع جلسات طويلة قد يفقد المستخدم حالة غير محفوظة | ✅ منفّذ (2026-11-10) — يقبل توكن صالحاً أو منتهياً بحد 30 يوماً ويعيد فحص الحساب |
