# تقرير المرحلة 8: أساس التصميم والخطوط ووضوح القراءة (admin-ui)

التاريخ: 2026-11-23. بلا أي تعديل على الصفحات (كما تحدد المرحلة).

## ما نُفذ
1. **الرموز**: `admin-ui/app/globals.css` يستوعب كتل Material 3 من `user-ui/app/globals.css` كما هي: الألوان (فاتح + `.dark`)، سلم الخطوط `--md-sys-typescale-*`، الأشكال، الحركة، أصناف `md3-card/chip/badge/elevation/state-layer`، و`.skeleton`. لم يُنسخ ما يخص صفحات الطالب (MWC overrides، glass، reveal، أنيميشن العناصر التسويقية). طبقة **aliases legacy** محفوظة ومربوطة بالرموز الجديدة، مع `--sidebar-bg` جديد → `surface-container-lowest`/`container` في الداكن — كل المتغيرات التي تستخدمها الصفحات الحالية السبع (`--bg --border --card --primary --sidebar-bg --text --text-muted`) مغطاة فلا انكسار.
2. **الهوية**: `admin-ui/components/BrandingProvider.tsx` صار نسخة `user-ui` حرفياً — يولّد مخطط M3 كاملاً (27 متغيراً فاتح+داكن) من `primaryColor` عبر `@material/material-color-utilities` ويحقنه في `<style id="md3-dynamic">` فتعاد ثيمات أصناف Tailwind أيضاً. أُضيفت الحزمة لـ`admin-ui/package.json`.
3. **الخطوط والأيقونات**: `admin-ui/app/layout.tsx` حمّل Google Fonts كما في `user-ui` (Cairo 400/500/600/700 + Roboto 400/500/700 + Material Symbols Outlined)، و`body` صار `Cairo` للعربية (`html[lang=ar]`) مع `line-height: 1.55` وبلا letter-spacing.
4. **ربط Tailwind** (`tailwind.config.ts`): 27 لوناً → `var(--md-sys-color-*)` (bg-primary، text-on-surface-variant…)، وحواف `md3-*` → رموز الأشكال. **إضافي بالكامل** — لا أسماء افتراضية استُبدلت، فالصفحات القديمة بلا تأثير. أحجام الخط الافتراضية أصلاً مطابقة للحد (xs=12px، sm=14px).
5. **قواعد وضوح القراءة**: موثقة كتعليق في أعلى `globals.css` (14px أساسي، 12px أدنى، سطر ≥1.5، لا opacity للنص، حلقة تركيز 2px، reduced-motion، لمس ≥40px) + مطبقة عامة: `:focus-visible` بحلقة 2px، `prefers-reduced-motion`، و`line-height` و`letter-spacing: 0` على body.

## نتيجة فحص التباين (`admin_plan/tools/contrast-check.mjs`)
30 زوجاً (15 لكل وضع) — **كلها تجتاز** ✅. أدنى النسب المسجلة:

| الوضع | الزوج | النسبة | الحد |
|---|---|---|---|
| فاتح | النص الثانوي على السطح | 8.82:1 | 4.5 |
| فاتح | حدود الحقول على حقل | 3.66:1 | 3 |
| فاتح | نص زر رئيسي | 6.18:1 | 4.5 |
| داكن | حدود الحقول على حقل | 4.50:1 | 3 |
| داكن | النص الثانوي على حقل | 8.40:1 | 4.5 |
| داكن | نص زر رئيسي | 7.72:1 | 4.5 |

الأزواج المشمولة: النص الأساسي/الثانوي على السطح والبطاقات والحقول، نص الأزرار والحاويات (رئيسية/ثانوية/خطأ)، حدود الحقول، أيقونة رئيسية وخطأ على السطح، ونص الـinverse — في الفاتح والداكن. إعادة التشغيل: `node admin_plan/tools/contrast-check.mjs`.

## الخط الأساسي للأعداد (قبل مراحل الصفحات 10-14)
لم يتغير (لا تعديل صفحات هنا): 395 `text-xs`، 483 `text-sm`، 0 `text-base`، 42 أصغر من 12px، 77 `opacity-40/50/60` — تُقاس مجدداً بعد كل دفعة.

## ملاحظات
- الخط الافتراضي القديم (`system-ui`) أُزيل؛ الصفحات القديمة ستعرض Cairo فوراً عبر body دون تغيير كودها (مطلوب الاعتماد: «الأدمن يعرض Cairo»).
- وسم `<head>` مع روابط الخطوط في `layout.tsx` بنفس أسلوب `user-ui/app/layout.tsx`.
- `typecheck`: نظيف للثلاثة بعد كل التعديلات.
