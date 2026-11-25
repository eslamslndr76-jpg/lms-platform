# تقرير المرحلة 9: المكونات المشتركة بنظام Material 3 (admin-ui)

التاريخ: 2026-11-23. أُعيدت صياغة المكونات **مرة واحدة** فتتحسن كل الصفحات التي تستخدمها، والخصائص (props) محفوظة عدا تعديل واحد مسجَّل أدناه وتم ترحيل الصفحة الوحيدة التي تستخدمه في نفس المرحلة.

## ما نُفذ
| المكوّن | التغيير |
|---|---|
| `Sidebar` | درج M3: عنصر نشط بحبة (pill) بلون `secondary-container`، أيقونات Material Symbols + نص، RTL، **قابل للطي إلى شريط أيقونات 76px** على الديسكتوب؛ على الموبايل درج منبثق مع طبقة تعتيم + زر عائم للفتح. الوضع الداكن والإشعارات انتقلا إلى الشريط العلوي. |
| `TopAppBar` (جديد) | شريط تطبيق علوي M3 ثابت: عنوان الصفحة من المسار، زر الوضع الداكن، `NotificationBell`، حسابي، وزر قائمة على الموبايل. |
| `ClientLayout` | يملك حالة الدرج/الطي ويمرّرها؛ المحتوى يزيح نفسه بهامش `--admin-sidebar-w` على الديسكتوب فقط (`.admin-main`). |
| `Modal` | حوار M3: `surface-container-high`، زوايا `extra-large`، ظل elevation-3، إغلاق بـ Esc وبالخلفية، **حبس التركيز داخل الحوار** + تركيز أولي. |
| `ConfirmDialog` | alertdialog بنفس الرموز؛ أيقونة الحالة بحاوية لون الحالة (error/warning/info) وأزرار M3. |
| `DataTable` | جداول M3: رأس `surface-container` بحد أدنى 13px، صفوف 52–56px، hover بـcolor-mix، فواصل `outline-variant`، تحديد صفوف بلون `primary` 8%، تمرير أفقي مع **العمود الأول مثبّتاً يميناً** على الموبايل، بحث بحقل `md3-field`. |
| `Pagination` | أزرار M3 بحلقات دائرية، الصفحة الحالية بحاوية `primary-container`، أسهم RTL صحيحة (chevron). |
| `StatusBadge` | رموز حالة جديدة (success/warning/info/error) في `globals.css` بحاويات M3 ونصوص عليها تباين مُقاس؛ لا ألوان ثابتة. |
| `StatsCard` | بطاقة `md3-card--elevated`، القيمة بلون النص، الأيقونة داخل حاوية 12×12 بلون مُخفَّف بـcolor-mix. |
| `Toast` | snackbar M3 على `inverse-surface`، أيقونات Material Symbols، بلا `opacity`. |
| `Skeleton` | يستخدم صنف `.skeleton` المشترك بأشكال المكونات (role=status). |
| `ExportButton` / `ExportModal` | أزرار M3 (filled/outlined/icon)، شرائح الأعمدة chips بحاوية `secondary-container`، رسائل خطأ/نجاح برموز الحالة. |
| `NotificationBell` | أيقونة Material Symbols، شارة عدّ `error`، لوحة على `surface-container-low`، مرشّح `TYPE_ICON` صار أسماء أيقونات، كل النصوص ≥12px. |
| `AIAssistant` | زر/لوحة M3، فقاعات chat برموز M3، حقل `md3-field`، جدول Markdown برموز M3. |
| `ErrorBoundary` | حالة خطأ برموز M3 وزر `md3-btn--filled`. |

## عناصر أساسية جديدة في `globals.css` (مستخدمة فعلاً من المكونات)
`.md3-btn` (filled/tonal/outlined/text/danger/icon — ارتفاع 40px، hover/pressed/disabled)، `.md3-field` (+ `.md3-field-error`، حدّ أصفر/أحمر عبر `aria-invalid`)، `.md3-tabs`/`.md3-tab` (تبويبات ثانوية) — جاهزة لمراحل الصفحات.

## تغيير واجهة برمجية (مسجَّل)
`Sidebar` لم يعد يأخذ props (كان `Sidebar()` بلا props أصلاً) — صار يأخذ `{ open, onOpenChange, collapsed, onToggleCollapse }`؛ المستهلك الوحيد `ClientLayout` رُحّل في نفس المرحلة. بقية المكونات: أسماء الخصائص وسلوكها كما هي.

## التحقق
- `npm run typecheck`: نظيف للثلاثة.
- سكربت التباين: **40/40 زوجاً تجتاز** في الفاتح والداكن (أُضيفت أزواج حالة نجاح/تحذير/معلومة).
- لا `#hex` ثابت في المكونات (باستثناء ألوان الهوية الافتراضية في `BrandingProvider` وهو مصدرها)، ولا `opacity` للنص بعد الإصلاح.

## ملاحظات
- صفحات قديمة ما زالت تستخدم `var(--bg)`/`var(--text)` القديمة: تعمل عبر طبقة aliases، وسيُرحَّل كل صفحة في مرحلتها (10–13). تحوّل الألوان تلقائياً مع الهوية والداكن.
- زر فتح الدرج العائم بالموبايل صار من ألوان `primary-container` بدل أزرق ثابت.