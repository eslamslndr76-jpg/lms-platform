# AGENTS.md

## Working rules (token budget — highest priority)
- Reply to me in Arabic, short (a few lines). Code, comments, errors, commit messages in English.
- Do NOT deploy, run Playwright/E2E, run full `build`, or open a browser unless I explicitly ask. After code changes run only `npm run typecheck` (+ lint on changed files if needed). The Flutter agent runs only `dart analyze`.
- Don't read big files whole or dump long logs: use `grep` / line ranges; pipe command output through `tail -n 30`.
- Never read or grep: `node_modules`, `.next`, `dist`, `backend/data.db` (scratch DB), lockfiles, `tests/`, and for Flutter: `.dart_tool/`, `build/`, `android/.gradle/`.
- Don't re-explore the repo each session; rely on this file. Don't restate plans or re-summarize your work beyond 2–3 lines.
- Write complete working code (no TODOs/placeholders). Async UI needs loading/error states. Backend routes use try/catch with descriptive HTTP status codes.
- `GROUP_WORKFLOW.md` is a human guide (group states, notifications). Read it only when touching group-state or notification logic.

## The agent and the current plan
Several AI agents may work on this project, one after another or in parallel.

- The current work plan is `ui-fix-plan/`. Start with `ui-fix-plan/README.md` (protocol and decisions), then `ui-fix-plan/PROGRESS.md` (status board), then `01-diagnosis.md` and ONLY the file of your phase.
- When the owner says "continue" / "كمل من المرحلة اللي وقفنا عندها": pull branch `ui-excel-fixes`, read `PROGRESS.md` and its handover log, then:
  1. A task marked `[~]` or `[!]` is unfinished: if the owner asked you to resume it, read its notes and continue it. If it may still be running with another agent, ask first.
  2. Otherwise take the first `[ ]` task whose dependencies are all `[x]`.
  3. Claim it in `PROGRESS.md` before editing any code, as the README describes.
- Work only on branch `ui-excel-fixes`. Never merge into `main` or deploy without the owner's approval.
- When a task is finished, mark it `[x]` with date and time (Africa/Cairo) in `PROGRESS.md`, add a handover line, commit and push the branch.
- `api-contract.md` (root) is the live description of the API the app consumes. Keep it accurate whenever you change an endpoint the app uses.
- Reference documents for forms (survey, instructor evaluation, report, proposal) live in `docs/forms-refs/*.md`. Read them only when a phase says so.
- The certificate design reference lives in `docs/certificate-design/` (design file + image assets). Read it only in the certificate-design phase.
- Brand assets live in `brand-assets/`: unit logo (`logo.png`, `logo.svg`, `logo-white.png`) and the institute logo (`institute-logo.png`, HIMS).

## Layout
npm workspace with three pillars (+ the standalone Flutter project):
- `backend/` — Express 4 API on libSQL/Turso. No ORM: `sql()` helper in `src/db/helpers.ts` (`?` placeholders). Routes in `src/routes/` (one resource per file, default-exported Router; admin-only under `routes/admin/`), mounted at `/api/*`.
- `admin-ui/` — Next.js 14 App Router admin dashboard (client-rendered, role-gated).
- `user-ui/` — Next.js 14 App Router student site: RTL Arabic marketing + authed `app/(dashboard)/`.
- `flutter_app/` — Flutter mobile app (Android APK first). NOT part of the npm workspace.
- Root `tsconfig.base.json` is unused; each pillar has its own `tsconfig.json`.

## Commands (repo root)
- `npm run dev` — all pillars: backend `:3001`, user-ui `:3000`, admin-ui `:3002`. Single: `dev:backend` / `dev:admin` / `dev:user`.
- `npm run typecheck` — tsc for all three. `npm run lint` — eslint. `npm run format` — prettier (single quotes, trailing commas, width 100).

## Architecture rules
- **Sessions:** user-ui JWT in `localStorage['token']`; admin-ui in `localStorage['admin_token']`. Never share.
- **API calls:** each UI has `lib/api.ts` (native fetch, Bearer token from localStorage, 15s timeout). Route all calls through it; no axios.
- **user-ui auth:** real authed pages only under `app/(dashboard)/` (layout redirects to `/login`).
- **admin-ui auth:** client-side only (`app/ClientLayout.tsx`); auth flash on load is expected.
- **Backend auth:** `middleware/auth.ts` (`authMiddleware`/`optionalAuth`), `middleware/rbac.ts` (`requireRole`/`requirePermission`). Role ids: ADMIN=1, EMPLOYEE=2, STUDENT=3 (instructor role exists too: see `rbac.ts`).
- **Notifications:** every notification is first written to the `notifications` table (the in-app notification center, shared by web and app), then sent through Email (Nodemailer), Telegram Bot API and FCM push, in `backend/src/services/externalNotificationService.ts`. No WhatsApp. A failure to write the in-app row must be logged loudly, never swallowed.
- **QR (attendance):** admin generates via `qrcode.react` in `admin-ui/app/courses/[id]/page.tsx`. The QR value is a URL: `<FRONTEND_URL>/attendance/<lectureId>?code=<CODE>`. user-ui scans with `html5-qrcode`; the mobile app scans with the camera. Attendance in the app is QR only (Bluetooth was removed).
- **Groups** are managed inside the course-detail page (`admin-ui/app/courses/[id]/page.tsx`), not a separate route.
- **Branding:** `BrandingProvider` (both UIs) fetches `/api/branding` and sets `--primary`/`--secondary` CSS vars. Use `useBranding()` + inline `style`, not hard-coded colors.

## Conventions
- RTL Arabic: `<html lang="ar" dir="rtl">` in both root layouts. All new UI must be RTL-aware, mobile first.
- No `next/image`: images are base64 data URLs (`lib/imageUtils.ts` → `compressAndEncode`, max 800px / JPEG 0.7) in plain `<img>`.
- Design system: the Material 3 tokens in `user-ui/app/globals.css` are the source of truth; `admin-ui` mirrors them. Never hard-code colors or use `opacity` to dim text; minimum text size 12px (14px for content).
- State: React Context only. Animations: hand-rolled CSS keyframes. Icons: emoji glyphs. No extra libraries.
- TypeScript `strict: true`. Alias `@/*` exists, but code mostly uses relative imports.
- DB columns, API fields, and frontend variables use the same names. Define request/response JSON before wiring frontend to backend.
- Uploads: `multer` in `routes/uploads.ts`, served statically at `/uploads`. Check in the platform plan phase 0 whether this storage persists in production before relying on it.

## Env vars
Backend (no `dotenv`; vars must exist in process env): `TURSO_DATABASE_URL` (default `file:./data.db`), `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS`, `BACKEND_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed admin, default `admin@lms.com`/`admin123`), `GEMINI_API_KEY` (optional).
Frontends: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Gotchas
- **No versioned migrations.** `backend/src/db/connection.ts` runs `SCHEMA_SQL` + an `ALTER TABLE` array (each in try/catch) and `seed()` on every boot. To add a column, append an idempotent `ALTER TABLE` to that array (and mirror it in `schema.ts`).
- **CORS:** allowlist = known prod origins + `FRONTEND_URL` + `ADMIN_URL` + `ALLOWED_ORIGINS`; localhost allowed outside production; requests without `Origin` always allowed (the mobile app relies on this; keep it).
- **Telegram webhook** `/api/notifications/telegram/webhook` requires header `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET` (derived from bot token by default). After changing bot token or `BACKEND_URL`, re-register via `POST /api/notifications/telegram/setup-webhook` (admin token).
- `execute()` in `turso-http.ts`: `file:` URLs → `@libsql/client` local SQLite; `libsql://` → HTTPS fetch to Turso pipeline API.

## Flutter Mobile App (APK) — rules shared by both agents
- **Location:** `flutter_app/` (on the owner's machine: `D:\training_center\flutter_app\`). Standalone Flutter project.
- **Auth:** JWT in `flutter_secure_storage`. Same `/api/auth/login`, same token format. JWT payload shape is `{ userId, roleId, role }` and must not change.
- **API base URL:** from `ApiConstants` (`http://10.0.2.2:3001` on the emulator, the real server in production).
- **Native features the app uses:** Camera/QR scan, Push Notifications (Firebase FCM), local notifications + WorkManager, app links (QR and notification deep links), in-app APK update. Bluetooth is NOT used.
- **Shared resources with web:** all `/api/*` endpoints, same DB, same JWT secret, same branding API (`/api/settings/branding` is the path the app reads).

### Rules when changing backend/web (do NOT break the installed app)
- API changes are additive by default: new endpoints, new optional fields. No renames or removals of fields the app consumes, unless the platform plan explicitly says so (the orders redesign in phase 2 does, and keeps a legacy shim).
- New DB column: append the idempotent `ALTER TABLE` as usual.
- New role or permission: update `middleware/rbac.ts` only.
- Do NOT change the JWT payload shape.
- Every endpoint the app will consume is documented in `api-contract.md`.

### API changes for the app (append here when adding endpoints; details live in `api-contract.md`)
<!-- Format: METHOD /api/path — description — added on DATE -->
- GET /api/groups/:id/report — fresh group report data (staff only; used by the admin report tab) — 2026-11-08
- POST /api/groups/:id/report/word — Word report, optional `images` multipart field (max 8, JPG/PNG, not stored) — 2026-11-08
- GET/PUT /api/settings/report — report default texts (coordinator, certificate, notes, recommendations, activity type) — 2026-11-08
- GET /api/exports/group_roster?groupId= — Excel: group + students (staff only) — 2026-11-08
- GET /api/exports/survey_results?groupId= — Excel: survey answers + per-item averages — 2026-11-08
- GET /api/exports/instructor_eval?groupId= — Excel: instructor evaluation of students — 2026-11-08
- GET /api/courses/:id — course object includes `materials_url` (Google Drive link to the scientific material; http(s) only, max 500 chars, may be empty). Show it to enrolled students and staff only — 2026-11-08
- GET /api/payment-methods — active payment methods with account number/instructions (auth user; digital methods without a number are hidden) — 2026-11-09
- GET/POST/PUT/DELETE /api/admin/payment-methods — full CRUD (ADMIN only; methods used by orders are disabled, never deleted) — 2026-11-09
- GET /api/orders/checkout-requirements — `{ missing_fields:[{key,label}] }` for the checkout data step (student auth; never asks for known fields) — 2026-11-09
- PUT /api/auth/profile — also accepts `nationalId` (14 digits) and `isEnrolled`; returns `national_id`/`is_enrolled` — 2026-11-09
- GET/PUT /api/settings/app-version — now also returns/saves `apkDirectUrl` (optional direct APK link; empty string when unset) — 2026-11-09
- PATCH /api/orders/:id/cancel — student cancels own unpaid booking (pending/review → cancelled, `cancel_reason='student'`) — 2026-11-10
- DELETE /api/orders/:id/items/:courseId — student removes one course from own unpaid booking (total recomputed; last item cancels the order) — 2026-11-10
- DELETE /api/admin/orders/:id/items/:courseId — staff removes a course from any order (paid too: student leaves that course's groups; no refund amount recorded) — 2026-11-10
- Orders rows now include `cancel_reason` (`student`|`admin`|`expired`|null); `pending` orders auto-cancel after the booking window (default 168h) — 2026-11-10
- GET/PUT /api/settings/booking — booking window in hours (1..720, default 168) — 2026-11-10
- GET /api/notifications?limit=&offset= — optional `offset` for pagination (short page = end of list) — 2026-11-10
- POST /api/settings/app-version/broadcast — re-broadcast the app-update notification to all app users (students + instructors); also fires automatically on saving a newer buildNumber — 2026-11-10
- New notification types: `order_expired`, `order_course_removed` (link `/orders`) — 2026-11-10
- Cart is server-owned: `POST /api/orders` (and admin manual orders) removes only the booked courses from the cart; `POST /api/cart` returns 409 for a paid/booked course; `GET /api/cart` self-cleans those rows — 2026-11-11
- Single payment route (treasury cash): `GET /api/payment-methods` returns only `kind='cash'`; `POST /api/orders` always creates `pending` + `cash` (client `payment_method`/`receipt` ignored); receipt uploaded later via `PATCH /api/orders/:id/receipt` (→ `review`, notification `order_receipt_uploaded`); `PATCH /api/orders/:id/pay` kept as legacy cash-only confirmation — 2026-11-14
- GET /api/surveys/group/:id/stats — also returns `scale`, `notes_label`, and per-response `user_id` (null for anonymous) for the admin per-student survey view/export — 2026-11-23
- GET /api/exports/survey_results — accepts `studentId=` (with `groupId=`) for a per-student export (identity fields move to the workbook info block); anonymous responses never match — 2026-11-23
- GET /api/exports/attendance — now derives absentees (LEFT JOIN over group_students × lectures, no DB rows written); status column rendered as ✓/✗ badge; narrow scope (lectureId/groupId/courseId) moves course/group fields to the workbook info block — 2026-11-23
- POST /api/surveys/my/:groupId/submit — response now includes `certificate: { id, serial_id } | null`: the certificate auto-issues after submission when the student has a paid order for the course (no attendance minimum); issuance failure never fails the submission — 2026-11-23
- Certificates: all issuers (manual admin route, group-completion auto-issue, AI tool, post-survey auto-issue) now go through the shared `services/certificateService.ts` (`issueCertificate`/`issueCertificateIfPaid`) — one duplicate rule (active per student+course → 409), one serial format, one notification; no survey↔certificate link stored — 2026-11-23
- Certificate HTML redesigned from the approved reference pack (`docs/certificate-design/`): one template + one shared renderer (`renderCertificateFor`) behind all three routes (`/verify/:serial/html`, `/:id/html`, `/:id/download` — 1083→838 lines); assets inlined in `config/certificateAssets.ts`; A4 landscape single page; الطالب/الطالبة wording from `users.gender` then national-id digit 13 (neutral wording + warning when unknown — never guessed); QR + serial unchanged (same verify page) — 2026-11-23
- Attendance sessions now expire: one "open" definition (`active=1 AND datetime(expires_at) > now`), single write format (`datetime('now','+2 hours')`), enforced in /current /mark /poll and the student/admin lecture lists, lazy close on read, closed on lecture/group completion — 2026-11-23
- Permissions tightened: `GET /api/attendance/:lectureId/current` and `GET /api/settings/auto-group` are staff-only; `POST /api/groups/:id/report/word` requires ADMIN/EMPLOYEE; `DELETE /api/admin/users/:id/hard` is ADMIN-only; Telegram webhook fails closed (503) when no secret is configured — 2026-11-23
- OTP fixes: expiry stored in SQLite format matching the verify query (was ISO vs `datetime('now')` — codes stayed valid ~24h), and the per-minute send limit now parses SQLite timestamps as UTC (never fired before) — 2026-11-23
- `GET /api/courses/:id` now Number()-converts all boolean flags like the list endpoint (`featured`, `enable_direct_purchase`, …) — clients compare strictly — 2026-11-23
- Booking expiry now also runs lazily on order list reads (`GET /api/orders/my`, admin orders list) since the 6-hour interval never runs on a warm production instance — 2026-11-23

## Language & branding
- Platform name: "وحدة التدريب و التطوير" (formerly "فريق تدريب X2").
- Disclaimer: "هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)"
- Slogan: "نحو تعليم أفضل" / "Towards Better Learning"
- Use this branding in mock data, headers, footers. Premium, polished UI.
