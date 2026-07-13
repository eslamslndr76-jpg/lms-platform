# Repository Reference (project-specific facts)

## Layout
npm workspace (`name: lms-erp-monorepo`) with three independent pillars + a root Playwright suite:
- `backend/` — Node/Express 4 API on libSQL/Turso (SQLite-compatible). No ORM; hand-rolled `sql()` helper in `src/db/helpers.ts` with `?` placeholders → `escape()` → raw SQL. Mounted under `/api/*`.
- `admin-ui/` — Next.js 14 (App Router) admin dashboard. Client-rendered, role-gated.
- `user-ui/` — Next.js 14 (App Router) student-facing site. RTL Arabic marketing + authed `app/(dashboard)/` area.
- `tests/` — Playwright E2E (config at root `playwright.config.ts`; starts backend + user-ui as webServers, baseURL `localhost:3001`). 4 spec files: `admin-api.spec.ts`, `settings-test.spec.ts`, `backend-api.spec.ts`, `user-ui.spec.ts`.
- `whatsapp-bot/` — Baileys (WhatsApp Web library) service for OTP delivery. Runs as a standalone Node/Express process on port 3002. NOT deployed on Vercel (requires persistent WebSocket). Deployed separately on Render.com.
- Root `tsconfig.base.json` exists but **none of the pillars extend it** — each pillar ships its own `tsconfig.json`.

## Commands
Root (run from repo root):
- `npm run dev:backend` / `dev:admin` / `dev:user` — start each pillar independently.
- `npm run dev:whatsapp` — start WhatsApp bot locally (port 3002).
- `npm run build:backend` / `build:admin` / `build:user`
- `npm run lint` — `eslint . --ext .ts,.tsx` across the workspace (config: `@typescript-eslint`, no-unused-vars as warn, no-explicit-any as warn).
- `npm run format` — `prettier --write .` (config: single quotes, trailing commas, 100 print width, 2 tab width).

Per-pillar scripts: `dev`, `build`, `start` (Next/Node), `lint` (`next lint`). **No `typecheck` or `test` script anywhere.** Type-check manually with `npx tsc --noEmit`. Run Playwright via `npx playwright test`.

## Architecture Boundaries & Rules
- **Session isolation:** `user-ui` stores JWT in `localStorage['token']`; `admin-ui` uses `localStorage['admin_token']`. They share one backend but never share tokens — keep these namespaces separate.
- **Data layer:** Each frontend has its own `lib/api.ts` wrapper around native `fetch` (no axios). Both inject `Authorization: Bearer <token>` from localStorage and enforce a 15s `AbortController` timeout. Do not bypass — route all API calls through `lib/api.ts`.
- **user-ui guarded surface:** The real authed pages live only inside the `app/(dashboard)/` route group (its `layout.tsx` redirects to `/login` when unauthed).
- **admin-ui protection is client-side only:** `app/ClientLayout.tsx` redirects unauthed users to `/login`; no middleware/SSR guard. Expect auth flash on load.
- **QR workflow:** admin generates QR via `qrcode.react` → `QRCodeSVG` in `admin-ui/app/courses/[id]/page.tsx`. user-ui scans via `html5-qrcode`. Not in dedicated routes.
- **Backend routes:** one resource per file in `backend/src/routes/`, each default-exports an `express.Router`; admin-only routes under `routes/admin/`. Auth via `middleware/auth.ts` (`authMiddleware` / `optionalAuth`), RBAC via `middleware/rbac.ts` (`requireRole`, `requirePermission`). Role ids: `ADMIN=1`, `EMPLOYEE=2`, `STUDENT=3`.
- **BrandingProvider** in both UIs fetches `/api/branding` at runtime and injects `--primary`/`--secondary` CSS vars onto `document.documentElement`. Prefer `useBranding()` + inline `style` over hard-coded color literals (they get overridden).

## Coding Conventions
- **RTL/Arabic:** `<html lang="ar" dir="rtl">` hardcoded in both frontends' root `layout.tsx`. Keep all new UI RTL-aware.
- **No `next/image`:** images are base64 data URLs via `lib/imageUtils.ts` → `compressAndEncode` (canvas resize, max 800px / JPEG 0.7), rendered in plain `<img>`. No image-domain config in any `next.config.js`.
- **State:** React Context only (no Redux/Zustand/SWR/React-Query). **Animations:** hand-rolled CSS keyframes (no framer-motion). **Icons:** emoji glyphs (no icon library).
- **TypeScript:** `strict: true` everywhere. Path alias `@/*` in both UIs' tsconfig but code mostly uses relative imports.
- **Backend SQL:** uses `sql()` helper with `?` placeholders (positional, via string replace). No knex/prisma. The `execute()` in `turso-http.ts` handles two modes: `file:` URLs → `@libsql/client` local SQLite; `libsql://` → rewritten to `https://` + HTTP fetch to Turso pipeline API.

## Environment Variables
Backend (`backend/`):
- `TURSO_DATABASE_URL` (defaults to `file:./data.db`)
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET` (fallback `'fallback-dev-secret-do-not-use-in-production'` in `src/middleware/auth.ts` — always set in prod)
- `FRONTEND_URL` (CORS origin; default `http://localhost:3000`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (seed admin user; defaults `admin@lms.com` / `admin123`)
- `GEMINI_API_KEY` (optional; powers AI assistant chat component in both UIs)
- No `dotenv` import — vars must exist in process env (Vercel injects them).

Frontends (both): `NEXT_PUBLIC_API_URL` — backend base URL; falls back to `http://localhost:3001`. (user-ui also reads `window.__NEXT_PUBLIC_API_URL` at runtime; admin-ui does not.)

## Deployment (`--prod` only, never preview URLs)
- Backend: Vercel serverless via `@vercel/node`; `vercel.json` routes all traffic to `api/index.ts` (re-exports Express app). Local entry `src/index.ts` calls `app.listen` only when `NODE_ENV !== 'production'`.
- admin-ui: `https://lms-admin-xi-seven.vercel.app` / `https://lms-admin-x2-hims.vercel.app`. Deploy from `admin-ui/` directory.
- user-ui: `https://lms-user-psi.vercel.app` / `https://lms-user-x2-hims.vercel.app` / `https://lms-user.vercel.app`. **Deploy from monorepo root** (not from `user-ui/`), using root `vercel.json` for build settings. The root `.vercel` must be linked to the `lms-user` project.

## Gotchas
- **Schema & migrations not versioned.** `backend/src/db/connection.ts` runs `SCHEMA_SQL` + hard-coded `ALTER TABLE` array **on every boot** (each wrapped in try/catch). `seed()` (default roles, branding, aiKeys, admin user) also runs on every startup. To add a column, append an idempotent `ALTER TABLE` to the array.
- **CORS allowlist bypassed:** `backend/src/index.ts` origin callback returns `cb(null, true)` in all branches — fix here when tightening origins.
- **`backend/data.db` is committed** as local fallback when `TURSO_DATABASE_URL` unset. Treat as scratch, not source of truth.
- **Groups managed inside course-detail page** (`admin-ui/app/courses/[id]/page.tsx`), not in a separate route.
- **No test/lint infrastructure inside pillars:** only root-level `lint` and Playwright. No Jest/Vitest and no per-pillar eslint config.
- **`uploads/` directory** mounted at `/uploads` as static files in backend. Handled via `multer` in `routes/uploads.ts`.
- **Root `vercel.json`** configures build for `lms-user` project (build inside `user-ui/`, output `user-ui/.next`). Required for deploying user-ui from monorepo root.

---

# Language & Branding Directives
- **Language:** Communicate with user in Arabic. English reserved for code, errors, and technical file contents only.
- **Branding (always use for mock data, headers, footers):**
  - Platform Name: "نادي ريادة الاعمال" (formerly "فريق تدريب X2")
  - Disclaimer: "هذه المنصة مقدمة من نادي ريادة الاعمال بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)"
  - Slogan (Arabic): "نحو تعليم أفضل"
  - Slogan (English): "Towards Better Learning"
- **UI/UX:** Premium polished interfaces with loading/success/error states on all components. Backend routes must have try/catch with descriptive HTTP status codes.
- **API contracts:** Define JSON request/response before connecting frontend to backend. Use matching variable names across DB schema, API, and frontend.
- **No placeholders or TODOs** in code — always deliver complete, functioning implementations.

# Automation Rules
- **Every code change** must be followed by: (1) deploy to Vercel `--prod`, (2) run `npx playwright test` locally, (3) verify deployed page loads without errors (browser snapshot). Do not skip any step.
- Deploy user-ui from monorepo root: `vercel deploy --prod --yes` (root must be linked to `lms-user`). Do NOT deploy from `user-ui/` directory.
- Deploy admin-ui from `admin-ui/`: `vercel deploy --prod --yes`
- Deploy backend from repo root: `vercel deploy --prod --yes` (uses `backend/` as root in project settings).
