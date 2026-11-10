# تقرير المرحلة 0: الاستكشاف

المرجع: `platform_plan/phase-0-explore.md` — تاريخ: 2026-11-09. لا تعديل كود في هذه المرحلة.

## 1. مراجع الطلبات (نحو 130 مرجعاً في 24 ملفاً)

### backend

| الملف | السطر | ماذا يفعل | يحتاج تعديلاً؟ |
|---|---|---|---|
| `db/schema.ts` | 115-129 | جدول `orders` وفيه `course_id NOT NULL` + FK | نعم — إضافة `order_items` وجعل `course_id` قديماً فقط |
| `db/schema.ts` | 197-207 | `receipts` (موجود، لا يُكتب فيه) | نعم — يصبح صفاً واحداً لكل طلب |
| `db/schema.ts` | 209-216 | `cart_items` (user_id+course_id، بلا سعر) | لا — يبقى كما هو |
| `db/connection.ts` | 21-25, 46 | `ALTER TABLE orders` (payment_method, notes, verified, sender_phone) | نعم — إضافة ALTERs جديدة فقط |
| `routes/orders.ts` | 10-52, 54-69, 71-84, 86-109, 111+ | إنشاء طلب = كورس واحد، إيصال داخل `orders.receipt_url`، `/my` JOIN courses، `/my/check` | نعم — إعادة كتابة + طبقة توافق |
| `routes/admin/orders.ts` | 11-49، 54-81، 84-145، 147-166، 168-201، 203-219 | قائمة/مالية/تغيير حالة/تعديل/إضافة/حذف — كلها تفترض كورساً واحداً و`o.amount` | نعم |
| `routes/admin/users.ts` | 248-249، 290-307 | حذف مستخدم + طلبات الطالب في ملفه | نعم |
| `routes/admin/certificates.ts` | 76-99 | الطلاب المستحقون للشهادة عبر `orders.course_id` | نعم |
| `routes/courses.ts` | 161-163 | حذف كورس يحذف كل طلباته | نعم + قرار (انظر §11) |
| `routes/exports.ts` | 180-185 | تصدير طلاب كورس من `orders` | نعم |
| `services/exportDatasets.ts` | 130، 137-189، 228، 738، 844-862 | حزمة `orders`، عدّاد الطلاب المدفوعين، المالية | نعم |
| `services/groupService.ts` | 237-244، 1070-1112 | استحقاق الشهادة، الطلاب غير المسكَّنين | نعم |
| `utils/aiTools.ts` | 29، 220-272، 294-316، 330-332، 380-399، 733-753، 777-778، 793، 807-821 | أدوات AI: قراءة/إضافة طلب، إحصاءات، إيرادات | نعم |
| `utils/aiClient.ts` | 13 | وصف مخطط `orders` في الـ prompt | نعم (نص) |
| `index.ts` 101/117 · `rbac.ts` 30 · `db/seed.ts` 21/33/127 · `externalNotificationService.ts` 268 | — | تركيب الراوترات، مفتاح صلاحية `orders`، رابط `/orders` | لا |

### admin-ui

| الملف | السطر | ماذا يفعل | يحتاج تعديلاً؟ |
|---|---|---|---|
| `app/orders/page.tsx` | 18-135، 187-191، 207-280، 300-390 | جدول الطلبات، تعديل مبلغ/طريقة دفع، إضافة طلب بكورس واحد، عرض الإيصال | نعم — إعادة كتابة |
| `app/courses/[id]/page.tsx` | 263-264، 1394 | طلاب الكورس من `/api/admin/orders?courseId=` + تصدير | نعم |
| `app/financials/page.tsx` | 18-24 | إجماليات من `/api/admin/orders/financials` | نعم |
| `app/page.tsx` | 21، 46، 118-124 | عدّاد الطلبات المعلّقة + تصدير | نعم |
| `app/students/page.tsx` | 239-249 | طلبات الطالب في المودال | نعم |
| `app/students/[id]/page.tsx` | 79-91 | طلبات الطالب في صفحته | نعم |
| `components/ExportModal.tsx` 15 · `Sidebar.tsx` 15 · `ClientLayout.tsx` 14 | — | تسميات/صلاحيات | لا |

### user-ui

| الملف | السطر | ماذا يفعل | يحتاج تعديلاً؟ |
|---|---|---|---|
| `app/checkout/page.tsx` | 193-224 | ينشئ **طلباً منفصلاً لكل كورس** في السلة، ويصفح إلى `/dashboard` | نعم — إعادة كتابة |
| `app/(dashboard)/orders/page.tsx` | 43-120، 150-230 | طلباتي (طلب = كورس)، لا يعرض الإيصال إطلاقاً | نعم |
| `app/(dashboard)/dashboard/page.tsx` | 68-127، 304 | الطلبات المعلّقة + رابط «عرض الكل» | نعم |
| `app/courses/[id]/page.tsx` | 211، 263-271، 623، 758 | `purchased` من `/api/orders/my/check` وزر «المادة العلمية» يعتمد عليه، زر «شراء الآن» | جزئي |
| `app/(dashboard)/cart/page.tsx` | 28، 101 | السلة وإجماليها (يُحسب في السيرفر) | جزئي |
| `components/CartDrawer.tsx` 52-100 · `Header.tsx` · `DashboardSidebar.tsx` · `MobileBottomNav.tsx` | — | سلة/روابط/عدّادات | لا |

## 2. مخطط الجداول والمفاتيح الأجنبية

| جدول | الأعمدة الحالية | ملاحظة |
|---|---|---|
| `orders` | id, user_id(FK users), course_id(FK courses, NOT NULL), amount, status, receipt_url, payment_method, notes, notes_team, notes_student, sender_phone, verified_by, verified_at, created_at | `receipt_url` هو الإيصال الفعلي اليوم |
| `receipts` | id, order_id(FK orders), file_url, payment_method, verified_by(FK users), verified_at, created_at | **لا يُكتب فيه ولا يُقرأ** — يُحذف منه فقط في 3 مواضع (courses.ts 161، admin/orders.ts 216، admin/users.ts 248) |
| `cart_items` | id, user_id(FK users), course_id(FK courses), created_at | لا سعر مخزَّن؛ الإجمالي يُحسب من `courses.price` في السيرفر (cart.ts 21) — متوافق مع القاعدة 6 |

المفاتيح الأجنبية التي تشير إلى `orders`: `receipts.order_id` فقط. لا جدول آخر يعتمد على `course_id` داخل الطلب. لا جدول `carts` (الاسم الفعلي `cart_items`).

## 3. رفع الصور والإيصالات

| البند | الواقع |
|---|---|
| إيصال الطلب | `compressAndEncode(file)` (800px، JPEG 0.7) → data URL base64 → يُرسل في `receipt_url` داخل JSON → يُحفظ كنص في `orders.receipt_url`. الحجم الناتج عادة 100-250KB |
| حد جسم الطلب | `express.json({ limit: '10mb' })` (`index.ts` 74) |
| `routes/uploads.ts` | multer غير مستخدم فعلاً؛ يقرأ base64 من الجسم ويكتب في `process.cwd()/uploads` (نظام ملفات للقراءة فقط على Vercel، والمصدر نفسه يعلّق بذلك) |
| هل `/uploads` مستخدم؟ | **لا**. لا يوجد أي نداء لـ `/api/uploads` في الويب أو التطبيق. الملفات في `backend/uploads` ليست جزءاً من المسار الحقيقي |
| الخلاصة | base64 في قاعدة البيانات هو المسار الفعلي، ولا حاجة لخدمة تخزين خارجية. المطلوب فقط حدّ أقصى للإيصال (انظر §11) + عرضه للطالب وللأدمن |

## 4. بيانات التسجيل (لتحديد «البيانات الناقصة» في المرحلة 3)

| الحقل | مطلوب في `/register`؟ | العمود |
|---|---|---|
| الاسم / البريد / كلمة المرور | نعم | `name`, `email`, `password` |
| الهاتف (11 رقماً يبدأ 01) | نعم (مُطبَّع على السيرفر) | `phone` (+`phone_verified`) |
| الرقم القومي (14 رقماً) | نعم | `national_id` |
| مسجّل بجامعة؟ + اسم الجامعة + كودها | شرطي | `is_enrolled`, `university_name`, `university_code` |
| تاريخ الميلاد / النوع / المحافظة | تُستخرج من الرقم القومي تلقائياً | `birth_date`, `gender`, `governorate` |
| الصورة/إشعارات | اختياري | `avatar`, `email_notifications`, `telegram_notifications`, `telegram_chat_id` |

الرقم القومي والجامعة هما أهم ما قد ينقص حساباً قديماً؛ اسم/بريد/هاتف مطلوبة أصلاً في التسجيل.

## 5. روابط الإشعارات مقابل صفحات الويب

`getLinkForType` في `externalNotificationService.ts` 259-283:

| الرابط | الصفحة موجودة؟ |
|---|---|
| `/attendance/:lectureId` | ✅ `app/(dashboard)/attendance/[lectureId]` (خلف تسجيل الدخول) |
| `/orders` | ✅ |
| `/survey/:groupId` | ✅ `app/(dashboard)/survey/[groupId]` |
| `/instructor` | ✅ |
| `/instructor/proposals/:id` | ✅ |
| `/my-courses` | ✅ |
| `/dashboard` | ✅ (افتراضي) |
| `/certificates` | ❌ لا توجد صفحة — الشهادات داخل `/account?tab=certificates` |
| `/groups/:groupId` | ❌ لا توجد صفحة (`assigned_to_group` / `moved_to_group` / `lecture_added`) |
| `/notifications` | ❌ لا توجد صفحة — مركز الإشعارات درج `NotificationBell` فقط |

## 6. النطاق (Domain)

| الموضع | القيمة |
|---|---|
| `config/notification.ts` 105 | افتراضي `FRONTEND_URL` = `https://lms-user-psi.vercel.app` |
| `routes/settings.ts` 68، 84 | رابط تنزيل التطبيق = `https://lms-user.vercel.app/download` |
| `index.ts` 37-44 | CORS يقبل: `lms-admin-xi-seven`, `lms-admin-x2-hims`, `lms-admin-drk2id8pb-x2-hims`, `lms-user-psi`, `lms-user-x2-hims`, `lms-user` |
| التطبيق (Manifest) | يستقبل `lms-user.vercel.app` و`lms-user-psi.vercel.app` |
| `.env.local` (backend) | `http://localhost:3000` للتطوير |

لا يوجد نطاق واحد: **المرشّح الرسمي `https://lms-user.vercel.app`** لأنه المستخدم في رابط تنزيل APK وفي Manifest، ويجب توحيد الافتراضي في `notification.ts` والـ CORS عليه. يحتاج تأكيد صاحب المشروع.

## 7. إصدار التطبيق

| البند | الواقع |
|---|---|
| `GET /api/settings/app-version` | يقرأ `system_settings.appVersion` أو الافتراضي `{latestVersion:'1.0.2', buildNumber:3, forceUpdate:false, title, message, downloadUrl}` |
| `PUT /api/settings/app-version` | يستقبل ويحفظ `latestVersion, buildNumber, forceUpdate, title, message, downloadUrl` فقط |
| `apkDirectUrl` | **غير موجود** لا في القراءة ولا في الحفظ (التطبيق يستعمل `downloadUrl`/رابط APK ثابت) |

## 8. إبتلاع الأخطاء حول الإشعارات

| الموضع | الحالة |
|---|---|
| `externalNotificationService.ts` 195-199 | ✅ يسجّل `console.error` عند فشل صف الإشعار |
| `externalNotificationService.ts` 469 (`broadcastAnnouncement` → `createNotification`) | ❌ `catch (_) {}` صامت تماماً |
| `externalNotificationService.ts` 475، 478، 481 | ❌ صامت لـ FCM/إيميل/تليجرام في البث |
| `routes/admin/certificates.ts` 242، 286 | ❌ `.catch(() => {})` حول `sendNotification` (سحب/استعادة شهادة) |
| `services/proposalService.ts` 238 | ❌ `.catch(() => undefined)` لإشعار الأدمن بمقترح جديد |
| `routes/notifications.ts` 414-416 | ✅ يرجع 500، لكن لا يميّز الفشل الجزئي لكل مستخدم |
| `routes/orders.ts` 31، 45 | ✅ `console.error` عند فشل `order_created` |

## 9. أماكن طرق الدفع الثابتة

| الموضع | الواقع |
|---|---|
| `user-ui/app/checkout/page.tsx` 271-276 | ثلاث خيارات مكتوبة: `wallet`, `instapay`, `cash` + تلميح نصي 308. **لا توجد أرقام تحويل ولا تعليمات** |
| `admin-ui/app/orders/page.tsx` 249-251 | قائمة منسدلة (تعديل طلب): wallet/instapay/cash |
| `admin-ui/app/orders/page.tsx` 374-376 | نفس القائمة (إضافة طلب) |
| أي مكان آخر | لا يوجد (لا صفحة إعدادات دفع في `admin-ui/app/settings`) |

المطلوب في المرحلة 1 والمرحلة 3: استبدال هذه الثلاثة بقراءة `GET /api/payment-methods`.

## 10. الفحص الحالي

`npm run typecheck` (backend + admin-ui + user-ui): **نظيف، بلا أخطاء مسبقة**.

## 11. قرارات صاحب المشروع (2026-11-09)

| الموضوع | القرار |
|---|---|
| النطاق الرسمي | `https://lms-user.vercel.app` — يُوحَّد عليه افتراضي `notification.ts` وروابط الإشعارات و`downloadUrl` وCORS يبقى يقبل القديم مؤقتاً |
| حدّ الإيصال | **2MB** كحد أقصى للصورة بعد الضغط (base64)، وما فوقه 413/400 برسالة واضحة |
| حذف كورس مرتبط بطلبات | **منع الحذف** إن كان الكورس في طلب `paid`/`review` (409 + رسالة)، وحذف عنصر الطلب فقط من طلبات `pending`/`cancelled` |
| الإيصال في الويب | يُضاف عرضه وحالته للطالب داخل تفاصيل الطلب في المرحلة 2 (إضافة لا تغيير) |
