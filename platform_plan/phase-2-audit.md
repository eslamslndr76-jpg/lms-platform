# مراجعة المرحلة 2: كل مرجع في `phase-0-report.md` وما تغيّر فيه

المرجع: `platform_plan/phase-2-orders-redesign.md` — تاريخ: 2026-11-09.
القاعدة الجديدة: `orders` رأس (إجمالي واحد) + `order_items` مصدر الحقيقة للكورسات + صف إيصال واحد في `receipts`. عمود `orders.course_id` يُكتب فقط للتوافق ولا يُقرأ كحقيقة.

## backend

| الملف | ما تغيّر |
|---|---|
| `db/schema.ts` | `orders` صار رأساً (تعليق صريح أن `course_id` قديم فقط)؛ جدول جديد `order_items` (id, order_id, course_id, price, created_at)؛ `receipts` صار صفاً واحداً لكل طلب. |
| `db/connection.ts` | ALTERs إضافية فقط: `CREATE TABLE order_items` + فهرسان (`order_id`, `course_id`) + تعبئة رجعية idempotent لكل طلب قديم كعنصر واحد (`price = amount`) + ترحيل `receipt_url` إلى `receipts`. |
| `services/orderService.ts` (جديد) | Helpers مشتركة: `attachOrderDetails` (items + receipt + `title_ar` مدمج + `course_id` أول عنصر للتوافق)، `findBlockingOrder` (paid/مفتوح)، `getOrderCourseTitles`، `MAX_RECEIPT_CHARS = 2MB`. |
| `routes/orders.ts` | إعادة كتابة: `POST /` يقبل `items[]` و`{course_id}` القديم (409 لكورس مدفوع/مفتوح، السعر والإجمالي من السيرفر، 20 كورساً كحد أقصى)؛ `PATCH /:id/pay` (رقمي ← `review` بإيصال+هاتف، كاش ← `pending`)؛ `PATCH /:id/receipt` بقي للتوافق؛ `GET /my`, `/my/:id` (items + receipt + groups لكل كورس), `/my/check/:courseId` على `order_items`؛ 413 عند تجاوز 2MB. |
| `routes/admin/orders.ts` | القائمة ترجع items/الإجمالي/الإيصال مع فلترة الكورس عبر `order_items`؛ المالية على رأس الطلب؛ `PATCH /:id/status` يطبّق `paid` (تحقق + تسكين تلقائي لكل عنصر + إشعار `order_paid` واحد) و`cancelled` (إزالة من مجموعات كل الكورسات)؛ الإنشاء اليدوي يقبل `items[]` أو كورساً واحداً؛ الحذف ينظّف `order_items` و`receipts`. |
| `routes/admin/users.ts` | حذف المستخدم النهائي يحذف `receipts` ثم `order_items` ثم `orders`؛ ملف الطالب يرجع طلباته مع items وreceipt. |
| `routes/admin/certificates.ts` | الطلاب المستحقون من `order_items JOIN orders` (مستحق لكل كورس على حدة). |
| `routes/courses.ts` | حذف الكورس: 409 إن كان في طلب `paid`/`review`؛ يحذف عنصر الطلب من `pending`/`cancelled` ثم ينظّف الطلبات والإيصالات اليتيمة. |
| `routes/exports.ts` | تصدير طلاب الكورس من `order_items` وسعر العنصر (لا إجمالي الطلب). |
| `services/exportDatasets.ts` | حزمة `orders` تعرض كل كورسات الطلب مدمجة؛ عدّاد الطلاب المدفوعين لكل كورس والإيراد من `order_items`؛ التقرير المالي الشهري لكل كورس من `oi.price`؛ فلتر `courseId`/`studentId` عبر `order_items`. |
| `services/groupService.ts` | استحقاق الشهادة وعدّ الطلاب غير المسكَّنين من `order_items`. |
| `utils/aiTools.ts` | إحصاءات الكورسات/الإيراد/الكورسات منخفضة التسجيل من `order_items`؛ `get_all_orders` و`get_order_by_id` و`get_my_orders` ترجع items+receipt؛ `create_order` يكتب `order_items`؛ ملخصات الحالة من رأس الطلب. |
| `utils/aiClient.ts` | وصف مخطط `order_items` في prompt المساعد. |

## admin-ui

| الملف | ما تغيّر |
|---|---|
| `app/orders/page.tsx` | إعادة كتابة: عمود الكورسات من `items`، نافذة التفاصيل تعرض كل عنصر بسعره + معاينة الإيصال وحالته، موافقة/مراجعة/رفض/حذف بضغطة على الطلب كله؛ إضافة حجز باختيار عدة كورسات وإجمالي محسوب من الأسعار المعروضة. |
| `app/courses/[id]/page.tsx` | تبويب الطلاب يعرض سعر عنصر هذا الكورس من `items` (بديل `amount` القديم) ونفس تصدير `courseId`. |
| `app/financials/page.tsx` | الإجماليات المالية من `/api/admin/orders/financials` (رأس الطلب، بلا تكرار) — تعمل كما هي. |
| `app/page.tsx` | عدّاد الطلبات المعلقة وآخر الطلبات تعرض `title_ar` المدمج للطلب متعدد الكورسات. |
| `app/students/page.tsx` | طلبات الطالب في المودال تعرض كورسات الطلب المدمجة. |
| `app/students/[id]/page.tsx` | نفس الشيء في صفحة الطالب. |

## user-ui

| الملف | ما تغيّر |
|---|---|
| `app/(dashboard)/orders/page.tsx` | إعادة كتابة عرض: الكورسات من `items`، عدد كورسات الطلب، ومكوّن `OrderExtra` يعرض قائمة الكورسات وإيصال الدفع وحالته (تم التحقق / بانتظار المراجعة) في الشيت والديالوج. |
| `app/(dashboard)/dashboard/page.tsx` | الطلبات المعلقة تُعدّ على رأس الطلب (pending/review) كما هي — متوافق. |
| `app/courses/[id]/page.tsx` | `purchased` من `/api/orders/my/check` الذي يقرأ `order_items`؛ زر «المادة العلمية» Hidden خلف نفس الفحص — متوافق بلا تعديل. |
| `app/(dashboard)/cart/page.tsx` | الإجمالي من `/api/cart` (السيرفر) — متوافق بلا تعديل. |
| `app/checkout/page.tsx` | **لم يُعدَّل في هذه المرحلة**: إعادة تدفق الشراء (طلب واحد للسلة) هي المرحلة 3؛ حالياً ينشئ طلباً لكل كورس، وهو جسم قديم مقبول من طبقة التوافق. |

## التحقق من الأرقام قبل/بعد

| الرقم | قبل | بعد | متطابق؟ |
|---|---|---|---|
| إجمالي الإيرادات | `SUM(orders.amount) WHERE paid` | نفس الاستعلام (الإجمالي محسوب في السيرفر لكل رأس) | ✅ |
| الإيراد الشهري | تجميع `orders.amount` | نفس التجميع في `financials` و`aiTools.get_revenue_report` | ✅ |
| الإيراد الشهري حسب الكورس (تصدير) | `orders.amount` على `orders.course_id` | `SUM(oi.price)` على `order_items`؛ الترحيل يضع `price = amount` للطلبات القديمة | ✅ |
| عدد الطلاب المدفوعين لكل كورس | `COUNT(*) FROM orders WHERE course_id=? AND paid` | `COUNT(*) FROM order_items JOIN orders ... AND paid` — صف واحد لكل كورس في الطلب | ✅ (لا تكرار: عناصر الطلب متميزة بالكورس، ولا كورس مكرر في نفس الطلب) |
| الحذف المتتالي | تنظيف `receipts` فقط | `receipts` + `order_items` في حذف الطلب/المستخدم، وتنظيف العناصر اليتيمة عند حذف كورس | ✅ |

ملاحظة تحقق: لم تُعَد البيانات على `backend/data.db` الحقيقي (ممنوع فتحه حسب `AGENTS.md`)؛ التطابق مستنتج من الترحيل idempotent + استعلامات مكافئة، و`npm run typecheck` نظيف.

## قرارات مطبَّقة من §11 في تقرير المرحلة 0

- حد الإيصال 2MB (413 برسالة عربية) — `routes/orders.ts`.
- حذف كورس مرتبط بطلبات مدفوع/مراجعة ممنوع (409) — `routes/courses.ts`.
- عرض الإيصال وحالته للطالب داخل تفاصيل الطلب — `user-ui/app/(dashboard)/orders/page.tsx`.
- طبقة توافق للجسم القديم `{ course_id, amount, ... }` و`PATCH /:id/receipt` — `routes/orders.ts`.
