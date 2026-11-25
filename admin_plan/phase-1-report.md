# تقرير المرحلة 1: الاستكشاف والحصر (قراءة فقط)

التاريخ: 2026-11-23. كل المسارات من جذر المشروع. المرجع: `admin_plan.md`.

## 1) كل ما يُصدَّر أو يُطبع

| الملف | النوع | الشعار حالياً |
|---|---|---|
| `backend/src/services/excelExportService.ts` | Excel (`buildBrandedWorkbook` سطر 296) | شعار **واحد**: `branding.logoHeader` وإلا الافتراضي من `config/brandLogo.ts`. أعلى يسار الورقة (col 0, row 0)، ارتفاع 54px. شيت «معلومات التقرير» (529) **بلا شعار** |
| `backend/src/services/exportDatasets.ts` | بيانات 16 داتاسِت (بلا شعار؛ تبني عبر buildBrandedWorkbook) | — |
| `backend/src/services/wordReportService.ts` | Word (تقرير المجموعة) | شعار **واحد** بالمنتصف أول فقرة، 150×100 (`brandingLogo()` 309) |
| `backend/src/services/proposalService.ts` | Word (وثيقة المقترح) | **بلا شعار إطلاقاً** — نص MINISTRY/UNIT فقط (42-43) |
| `backend/src/routes/certificates.ts` | HTML شهادة (3 مسارات) | شعار **واحد** `logoHtmlFor(branding.logoHeader)` (8) في هيدر القالب، max 50px |
| `backend/src/routes/exports.ts` | مسارات التسليم xlsx/csv/json | — |

**داتاسِتات `EXPORT_DATASETS` (16):** students، orders، courses، categories، groups، lectures، attendance، enrollments، group_roster، survey_results، instructor_eval، unassigned، certificates، employees، financials، notifications.

**الطباعة/PDF:** لا `window.print` ولا `pdfkit|jspdf` في admin-ui أو user-ui أو الباك إند. الطباعة الوحيدة: `@media print` داخل قالب الشهادة (531)، ومسار `/:id/download` يرسل **HTML** (1074) وليس PDF. صفحة تحقق عامة: `user-ui/app/verify/page.tsx` (iframe للمعاينة).

## 2) شعار المعهد (HIMS)

- **موجود**: `brand-assets/institute-logo.png` (152KB). المقاس **511×433**، RGBA بـ**خلفية شفافة** (فحص بكسل فعلي: أركان الصورة alpha=0)، حاد وواضح.
- مطابق **بصرياً** للمرشح `user-ui/public/partners/لوجو  hims.png` (نفس المقاس؛ الفرق بايتات حفظ فقط).
- ⏳ يحتاج تأكيد صاحب المشروع لاعتماده (المرحلة تُختم بعد التأكيد).

## 3) الحضور

- **إنشاء الصفوف**: جدول `lecture_attendance` (`db/schema.ts:188`). الإدراج في موضعين فقط:
  - QR `/api/attendance/mark` (`routes/attendance.ts:187`): حاضر فقط `attended=1`، لا ينشئ غائبين.
  - الحفظ اليدوي للأدمن (`groupService.setAttendance` 1422، bulk 1432 عبر `POST /groups/:id/lectures/:lectureId/attendance`): هذا **الموضع الوحيد** الذي يكتب `attended=0`.
  - `/stop` لا ينشئ صفوفاً. الغائب **يُشتق** بـ LEFT JOIN من `group_students` (`attendance.ts:257`، `groupService.ts:1407`) — شيت «كل الطلاب» يجب أن يتبع هذا النمط لا صفوف الجدول.
- **بيانات رأس التقرير المتاحة**: `groups` فيها `instructor_name`، `location`، `place_id`→`places.name`، `start_date/end_date`، `activity_type`، `status`. خط تقرير Word الموجود يحلها كلها جاهزة (`reportService.ts` 174-184 و251-266 مع `time_range/days_text` من المحاضرات) — يُعاد استخدامها.
- **أماكن التصدير في الأدمن**:
  1. نافذة الحضور بالمحاضرة: `ExportButton dataset="attendance" lectureId=…` (`courses/[id]/page.tsx:2832`).
  2. تبويب المجموعة «كشف الحضور» بـ `groupId` (2306 عبر `exportGroupDataset` 594).
  3. لا توجد صفحة تصدير عامة للحضور (وإلا فالتصديرات الأخرى داتاسِت-محورة).
  - داتاسِت `attendance` (`exportDatasets.ts:385`): INNER JOIN على `lecture_attendance` → الغائبون اليدويون فقط يظهرون؛ الأعمدة الحالية: student/phone/course/group_name/lecture_date/topic/attended/verification_method/attended_at، واسم الكورس **عمود** كما ذكرت الخطة.

## 4) الاستبيان في الأدمن

- العرض: تبويب «الاستبيان» داخل `admin-ui/app/courses/[id]/page.tsx` (سطر 67، العرض 2030-2193) عبر `GET /api/surveys/group/:id/stats` (`routes/surveys.ts:70`).
- `getGroupSurveyStats` (`surveyService.ts:480`) يرجع: إحصاءات + `sections` + `items` + `helped` + **`responses`**: قائمة الردود الفردية **بإجاباتها الكاملة** (557-562)، و`student_name = null` للمجهول.
- الأدمن يعرض حالياً من الردود الفردية: الاسم/«بدون اسم» + التاريخ + `answers.notes` **فقط** — لا درجات البنود لكل طالب (2155-2187).
- تصدير `survey_results` (`exportDatasets.ts:554`): بلا فلتر `studentId` (المعامل العام موجود سطر 25 لكن غير موصَّل لهذا الداتاسِت)؛ الاسم يُخفى في SQL بـ `CASE WHEN is_anonymous=1 THEN 'مجهول'`.
- الطالب: `user-ui/app/(dashboard)/survey/[groupId]/page.tsx` (إرسال 192، مسودة 143). التطبيق: `features/surveys/survey_screen.dart` + `surveys_provider.dart`. ملاحظة: واجهة user-ui ترسل `is_anonymous: !isAnonymous` (الحالة معكوسة = «إظهار اسمي»).

## 5) الشهادات

- **البناء المكرر (3 مواضع)** في `routes/certificates.ts`: `/verify/:serial/html` (703، استعلامات منفصلة) و`/:id/html` (832، JOIN) و`/:id/download` (981، مطابق لـ/:id/html). كل كتلة ~120 سطراً متشابهة: branding + settings + عدد الحضور + المدة + QR + خريطة replacements (17 مفتاحاً). → استخراج خدمة مشتركة سهل، مع مراعاة اختلاف مصدر البيانات في مسار verify.
- **الإصدار** `POST /api/admin/certificates` (`routes/admin/certificates.ts:152`، ADMIN/EMPLOYEE + `certificates:write`): `ensureCertColumns` (13: status/revoked_at/revoke_reason) ← فحص تكرار `status='active'` → 409 (162-176) ← serial = `randomBytes(8).hex.toUpperCase()` (178) ← INSERT (180) ← `sendNotification('certificate_issued', {courseTitle, serialId})` **بلا link** (195-198). revoke/restore بنفس الملف.
- ⚠️ **اكتشاف يخالف الخطة**: يوجد **إصدار تلقائي فعلياً** عند إكمال المجموعة في `groupService.ts:291-303` بشرط حضور ≥ `certSettings.minAttendancePercent` (افتراضي 80)، وأيضاً أداة AI لإصدار الشهادة في `aiTools.ts:700-706` بصيغة serial مختلفة (`CERT-…`) وبلا إشعار. جدول «ما اكتُشف» قال «لا إصدار تلقائي» — **قرار مطلوب في المرحلة 5**: دمجهما مع المسار الجديد/تعطيلهما/إبقاؤهما.
- **شاشات الطالب**: user-ui: `/verify` عامة (77-97)، `account` تبويب الشهادات (99-115، تحويل HTML→PDF محلياً)، CTA في `courses/[id]`. التطبيق: `certificates_screen.dart` + `verify_certificate_screen.dart` + `certificate_pdf_service.dart` (PDF على الجهاز). لا ربط استبيان→شهادة في أي مكان (تعليق `surveyService.ts:10-11`).

## 6) الحضور «المفتوح» غلط

- **الكتابة**: `/start` يكتب `attendance_active=1` + `attendance_expires_at` (`attendance.ts:41-47`)، `/stop` يكتب 0 (122).
- **القراءة**: `/current` (97,101) و`/mark` (149-153) و`/poll` (227)؛ واجهة الطالب `user-ui .../my-courses/page.tsx:611`؛ التطبيق `group_details_screen.dart:286`. كلها تعتمد `attendance_active=1` فقط.
- **`attendance_expires_at` ميت**: يُقرأ في `/current` (97) ولا يُستخدم؛ لا شيء يفرض الانتهاء. وفي نفس UPDATE يُخزَّن `attendance_started_at` بصيغة `datetime('now')` و`attendance_expires_at` بصيغة `toISOString()` — غير قابلين للمقارنة النصية (خطر للمرحلة 7).

## 7) أساس الجودة (قبل أي تعديل)

- `npm run typecheck`: نظيف للثلاثة (backend، admin-ui، user-ui — exit 0).
- `dart analyze` (flutter_app): **No issues found!**

## 8) تصميم الأدمن — خط الأساس (المراحل 8-14)

**الأعداد المعاد عدها (تؤكد الخطة):**

| الفئة | app | components | الإجمالي |
|---|---|---|---|
| `text-xs` | 367 | 28 | **395** |
| `text-sm` | 450 | 33 | **483** |
| `text-base` | 0 | 0 | **0** |
| أصغر من 12px | 36 | 6 | **42** (10px×10، 11px×32) |
| `opacity-40/50/60` | — | — | **77** (7/61/9) |

**الأساس:**
- `admin-ui/app/globals.css` (52 سطراً): 8 متغيرات legacy فقط (`--primary`، `--bg`…) بلا رموز M3، خط `system-ui` بلا Cairo، `.dark` بـ 8 متغيرات، وحركة واحدة.
- `user-ui/app/globals.css` (640 سطراً): `--md-sys-color-*` فاتح + `.dark` كامل، طبقة aliases legacy (46-60)، radius (67)، typescale كامل (73-191)، keyframes (407-447)، أصناف `.md3-card/chip/badge/elevation/state-layer`. آلية الداكن: صنف `.dark` على `<html>` بلوحة ثابتة.
- **الهوية**: `BrandingProvider` في user-ui يولّد مخطط M3 كاملاً من `primaryColor` عبر `@material/material-color-utilities` ويحقن 27 متغيراً (`<style id="md3-dynamic">`)؛ نسخة admin تحدّد `--primary/--secondary` فقط، و`tailwind.config.ts` بلا أي ألوان — مسار M3 غائب في admin-ui.
- **الخطوط والأيقونات (user-ui/layout.tsx 60-65)**: `<link>` Google Fonts (Roboto 400/500/700 + Cairo 400/600/700 + Material Symbols Outlined)؛ الأيقونات glyphs `material-symbols-outlined`. ملاحظة: imports الـ`@material/web` في user-ui **غير مستخدمة فعلياً** (لا وسم واحد في الماركب) — لا تنسخها للأدمن (يوافق الافتراضي المؤجل).
- **الأزرار/الحقول/الحوارات**: لا أصناف `.btn/.field/.dialog` — البناء Tailwind + متغيرات CSS + أصناف `md3-*`.
- **المكونات المشتركة (16 ملفاً) وحجم الاستخدام**: ExportButton 9 صفحات، Toast 8، DataTable 7، Modal 7، ConfirmDialog 6، Skeleton 6، StatusBadge 5، StatsCard 3، Pagination 2، BrandingProvider/DarkModeProvider (providers)، AIAssistant/ErrorBoundary/Sidebar 1، ExportModal وNotificationBell داخليان.
- **الصفحات (15 = 9,559 سطراً)**: courses/[id] 2899، settings 2060، permissions 1182، proposals/[id] 728، certificates 542، orders 507، courses 499، students 403، proposals 196، page.tsx 141، account 131، students/[id] 123، login 75، financials 67، employees 6.

**الدفعات المقترحة (10-13):**

| المرحلة | المحتوى | الحجم |
|---|---|---|
| 10 | الأساس (رموز M3 + tailwind + خطوط) + providers/Sidebar/Toast + login + الرئيسية + account + employees | ~350 سطر صفحات + الهيكل |
| 11 | students، students/[id]، courses، orders، certificates، financials | ~2.1k |
| 12 | courses/[id] وحدها | 2.9k |
| 13 | proposals، proposals/[id]، permissions، settings (تصاعدياً) | ~4.2k (إن ثقُل: فصل settings إلى 13b) |

## 9) مرجع تصميم الشهادة

موجود وكامل في `docs/certificate-design/`: `README-AR.md`، `AGENT-PROMPT-AR.md`، `certificate-template.js/.html/.css`، `certificate-data.js`، معاينة PNG+PDF، `reference-original-certificate.pptx`، و`assets/` (نمط وزخارف وشعاران مقصوصان وQR). **المرحلة 6 غير محجوبة.**

---

## يؤكَّد من صاحب المشروع
1. اعتماد `brand-assets/institute-logo.png` (المطابق للمرشح — بجودة كاملة وخلفية شفافة).
2. علمك بوجود الإصدار التلقائي الحالي (إكمال مجموعة ≥80% حضور + أداة AI) — القرار النهائي في المرحلة 5.

**الحالة: اكتمل الحصر — بانتظار موافقة صاحب المشروع على التقرير وتأكيد الشعار.**
