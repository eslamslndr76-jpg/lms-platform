\# System Architecture \& Development Guidelines

You are an expert Full-Stack AI Developer Agent building a decoupled LMS \& ERP system (Monorepo) designed as a White-label solution.



\## 1. Project Structure

Create the following directories inside the root folder:

\- `/backend`: Node.js, Express, Turso DB (SQLite on edge).

\- `/admin-ui`: React/Next.js (TailwindCSS) for the Admin Dashboard.

\- `/user-ui`: React/Next.js (TailwindCSS) for the Student Storefront/Portal.



\## 2. Dynamic Branding \& Identity (White-label)

\- The system identity MUST NOT be hardcoded. 

\- Create a "Branding Settings" table in the database and an interface in the Admin UI to control:

&#x20; - System Name and Logos (Header, Footer, Favicon).

&#x20; - Primary and Secondary UI Colors.

&#x20; - Slogans (Arabic and English translations).

&#x20; - Automated Message Footer (A dynamic text block appended to all automated WhatsApp/Email messages, e.g., for collaborations or team credits).

\- Both `/admin-ui` and `/user-ui` must fetch these branding settings from the backend via an API on initial load and apply them globally.



\## 3. Backend (Node.js + Turso)

\- \*\*Database:\*\* Use `@libsql/client` to connect to Turso. Design relations for: Users, Roles, Courses, Groups, Orders, Receipts, and SystemSettings.

\- \*\*API \& CORS:\*\* Enable `cors` for all routes. Return only JSON.

\- \*\*WhatsApp Integration:\*\* Implement `whatsapp-web.js` for 100% free automated WhatsApp notifications. Notify students automatically on: Order Status Change, Group Assignment, and Course Updates. Append the dynamic "Automated Message Footer" to all messages.

\- \*\*PDF \& Excel:\*\* Implement `exceljs` and `pdfkit` endpoints to export Students per Course, Orders, and Financials dynamically.

\- \*\*Auto-Grouping Logic:\*\* Create a trigger/cron job that automatically creates a new Group and assigns a schedule when a specific course reaches a predefined student limit set by the Admin.

\- \*\*AI Keys Fallback System:\*\* Create a utility to manage AI API keys. The system must accept an array of keys and automatically switch to the next key if a `429 Too Many Requests` or quota limit error occurs.



\## 4. Admin UI (/admin-ui)

\- Define a global `API\_URL` variable.

\- Implement Role-Based Access Control (RBAC): Admin (Full Access), Employee (Customized View/Edit permissions per section).

\- \*\*Settings Module:\*\* A comprehensive settings page to manage the Dynamic Branding (Logos, Colors, Slogans, Footers) and the AI Assistant API Keys.

\- \*\*Core Features:\*\* Approve manual payment receipts (E-wallets, InstaPay, Cash), manage courses/categories, view system financials, and download PDF/Excel reports.

\- Design: Clean, card-based, data-heavy tables with sorting and filtering.



## 5. User UI (/user-ui) [STRICT MOBILE-FIRST & STABILITY RULES]
- Define a global `API_URL` variable.
- **Design Strategy:** MUST use a strict **Mobile-First approach**. The UI must feel smooth, fluid, and exactly like a native mobile app. Use TailwindCSS.
- **Error Handling (Zero Crashes):** Implement robust Error Boundaries. The user must NEVER see a blank screen or raw code errors. 
- **Loading States:** Always use Skeleton Loaders or Spinners during data fetching. Use Toast Notifications (Success/Error messages) clearly for every action the user takes (e.g., successful upload, failed login).
- Features: Browsing courses, Checkout with a file upload field for payment receipts, User Authentication, and Certificate Verification by Serial ID.
- **Student Dashboard:** Displays current status of orders, assigned Group details, schedule, Zoom links, and a secure download link for course materials.


\## 6. Smart AI Assistant (Header Chatbot)

\- Build an AI Chatbot UI in the header of BOTH applications.

\- \*\*Function Calling:\*\* The chatbot must use tools to execute actions based on the user's Auth Token.

\- If Admin interacts: Chatbot can fetch reports, update statuses, or summarize database stats.

\- If Student interacts: Chatbot can only fetch their specific order status, course schedule, and basic FAQ.



Start by setting up the folder structure, initializing `package.json` in all directories, and writing the Turso Database Schema in the backend, ensuring the SystemSettings table is included for branding.



و اى رد يكون بلغه عربية 
ابنى السيرفر 
و شغل اختبار playwright بعد كل تعديل و اختبر تطبيق التعديل بنفسك على المتصفح

