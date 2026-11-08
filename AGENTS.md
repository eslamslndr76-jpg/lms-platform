# AGENTS.md

## Working rules (token budget — highest priority)
- Reply to me in Arabic, short (a few lines). Code, comments, errors, commit messages in English.
- Do NOT deploy, run Playwright/E2E, run full `build`, or open a browser unless I explicitly ask. After code changes run only `npm run typecheck` (+ lint on changed files if needed).
- Don't read big files whole or dump long logs: use `grep` / line ranges; pipe command output through `tail -n 30`.
- Never read or grep: `node_modules`, `.next`, `dist`, `backend/data.db` (scratch DB), lockfiles, `tests/`.
- Don't re-explore the repo each session; rely on this file. Don't restate plans or re-summarize your work beyond 2–3 lines.
- Write complete working code (no TODOs/placeholders). Async UI needs loading/error states. Backend routes use try/catch with descriptive HTTP status codes.
- Task plan lives in `edit-plan.md` + `plan/phase-N-*.md`. Read them only when working on that plan, and only the current phase file.
- `GROUP_WORKFLOW.md` is a human guide (group states, notifications). Read it only when touching group-state or notification logic.

## Layout
npm workspace with three pillars:
- `backend/` — Express 4 API on libSQL/Turso. No ORM: `sql()` helper in `src/db/helpers.ts` (`?` placeholders). Routes in `src/routes/` (one resource per file, default-exported Router; admin-only under `routes/admin/`), mounted at `/api/*`.
- `admin-ui/` — Next.js 14 App Router admin dashboard (client-rendered, role-gated).
- `user-ui/` — Next.js 14 App Router student site: RTL Arabic marketing + authed `app/(dashboard)/`.
- Root `tsconfig.base.json` is unused; each pillar has its own `tsconfig.json`.

## Commands (repo root)
- `npm run dev` — all pillars: backend `:3001`, user-ui `:3000`, admin-ui `:3002`. Single: `dev:backend` / `dev:admin` / `dev:user`.
- `npm run typecheck` — tsc for all three. `npm run lint` — eslint. `npm run format` — prettier (single quotes, trailing commas, width 100).

## Architecture rules
- **Sessions:** user-ui JWT in `localStorage['token']`; admin-ui in `localStorage['admin_token']`. Never share.
- **API calls:** each UI has `lib/api.ts` (native fetch, Bearer token from localStorage, 15s timeout). Route all calls through it; no axios.
- **user-ui auth:** real authed pages only under `app/(dashboard)/` (layout redirects to `/login`).
- **admin-ui auth:** client-side only (`app/ClientLayout.tsx`); auth flash on load is expected.
- **Backend auth:** `middleware/auth.ts` (`authMiddleware`/`optionalAuth`), `middleware/rbac.ts` (`requireRole`/`requirePermission`). Role ids: ADMIN=1, EMPLOYEE=2, STUDENT=3.
- **Notifications:** Email (Nodemailer) + Telegram Bot API, sent together via `Promise.allSettled` in `backend/src/services/externalNotificationService.ts`. No WhatsApp.
- **QR:** admin generates via `qrcode.react` in `admin-ui/app/courses/[id]/page.tsx`; user-ui scans with `html5-qrcode`.
- **Groups** are managed inside the course-detail page (`admin-ui/app/courses/[id]/page.tsx`), not a separate route.
- **Branding:** `BrandingProvider` (both UIs) fetches `/api/branding` and sets `--primary`/`--secondary` CSS vars. Use `useBranding()` + inline `style`, not hard-coded colors.

## Conventions
- RTL Arabic: `<html lang="ar" dir="rtl">` in both root layouts. All new UI must be RTL-aware.
- No `next/image`: images are base64 data URLs (`lib/imageUtils.ts` → `compressAndEncode`, max 800px / JPEG 0.7) in plain `<img>`.
- State: React Context only. Animations: hand-rolled CSS keyframes. Icons: emoji glyphs. No extra libraries.
- TypeScript `strict: true`. Alias `@/*` exists, but code mostly uses relative imports.
- DB columns, API fields, and frontend variables use the same names. Define request/response JSON before wiring frontend to backend.
- Uploads: `multer` in `routes/uploads.ts`, served statically at `/uploads`.

## Env vars
Backend (no `dotenv`; vars must exist in process env): `TURSO_DATABASE_URL` (default `file:./data.db`), `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS`, `BACKEND_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed admin, default `admin@lms.com`/`admin123`), `GEMINI_API_KEY` (optional).
Frontends: `NEXT_PUBLIC_API_URL` (default `http://localhost:3001`).

## Gotchas
- **No versioned migrations.** `backend/src/db/connection.ts` runs `SCHEMA_SQL` + an `ALTER TABLE` array (each in try/catch) and `seed()` on every boot. To add a column, append an idempotent `ALTER TABLE` to that array.
- **CORS:** allowlist = known prod origins + `FRONTEND_URL` + `ADMIN_URL` + `ALLOWED_ORIGINS`; localhost allowed outside production; requests without `Origin` always allowed.
- **Telegram webhook** `/api/notifications/telegram/webhook` requires header `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET` (derived from bot token by default). After changing bot token or `BACKEND_URL`, re-register via `POST /api/notifications/telegram/setup-webhook` (admin token).
- `execute()` in `turso-http.ts`: `file:` URLs → `@libsql/client` local SQLite; `libsql://` → HTTPS fetch to Turso pipeline API.

## Flutter Mobile App (APK / iOS) — Parallel Development

> **A second AI agent is actively developing the Flutter mobile app in `flutter_app/` in parallel.**
> Both agents share the same Backend and DB — coordinate carefully when touching APIs.

- **Location:** `d:\مركز تدريب\flutter_app\` — standalone Flutter project, NOT part of the npm workspace.
- **Purpose:** Native student-facing mobile app (Android APK first, iOS later) that consumes the same `backend/` REST API.
- **Platform:** Android Studio installed; Flutter SDK will be installed separately. Target Flutter Stable ≥ 3.22.
- **Auth:** JWT stored in `flutter_secure_storage` (NOT localStorage). Same `/api/auth/login` endpoint, same token format.
- **API base URL:** Read from env/config — same `NEXT_PUBLIC_API_URL` equivalent (`http://localhost:3001` in dev, real server in prod).
- **Native features the Flutter app uses:** Bluetooth LE (attendance), Camera/QR scan, Push Notifications (Firebase FCM), GPS.
- **Shared resources with web:** All `/api/*` endpoints, same DB schema, same JWT secret, same branding API (`/api/branding`).

### Rules for the **web/backend agent** (do NOT break Flutter compatibility):
- When adding a **new API endpoint**, keep response shape consistent: `{ data, error }` — no breaking renames.
- When adding a **new DB column**, it's fine — just append the idempotent `ALTER TABLE` as usual; Flutter will read it via API.
- When adding a **new role or permission**, update `middleware/rbac.ts` only — Flutter reads roles from the JWT payload.
- Do NOT change the JWT payload shape (`{ userId, roleId, role }`) without notifying the Flutter agent.
- Do NOT change existing API field names that are already consumed by Flutter (coordinate via this file or comments).
- **CORS:** Flutter in dev hits the backend directly (no browser Origin header) — requests without Origin are already allowed; keep it that way.
- If you add a new `/api/*` route that Flutter will need, document it here under "API changes for Flutter" below.

### API changes for Flutter (append here when adding new endpoints Flutter will consume):
<!-- Format: METHOD /api/path — description — added by web agent on DATE -->
- GET /api/groups/:id/report — fresh group report data (staff only; used by the admin report tab) — 2026-11-08
- POST /api/groups/:id/report/word — Word report, optional `images` multipart field (max 8, JPG/PNG, not stored) — 2026-11-08
- GET/PUT /api/settings/report — report default texts (coordinator, certificate, notes, recommendations, activity type) — 2026-11-08
- GET /api/exports/group_roster?groupId= — Excel: group + students (staff only) — 2026-11-08
- GET /api/exports/survey_results?groupId= — Excel: survey answers + per-item averages — 2026-11-08
- GET /api/exports/instructor_eval?groupId= — Excel: instructor evaluation of students — 2026-11-08
- GET /api/courses/:id — course object now includes `materials_url` (Google Drive link to the scientific material; http(s) only, max 500 chars, may be empty). Show it to enrolled students and staff only — 2026-11-08

## Language & branding
- Platform name: "وحدة التدريب و التطوير" (formerly "فريق تدريب X2").
- Disclaimer: "هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)"
- Slogan: "نحو تعليم أفضل" / "Towards Better Learning"
- Use this branding in mock data, headers, footers. Premium, polished UI.
