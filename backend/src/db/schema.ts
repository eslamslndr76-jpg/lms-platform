import { DEFAULT_LOGO_DATA_URL } from '../config/brandLogo';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  avatar TEXT,
  role_id INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  category_id INTEGER,
  image_url TEXT,
  max_students INTEGER NOT NULL DEFAULT 30,
  lecture_count INTEGER NOT NULL DEFAULT 0,
  lecture_duration REAL NOT NULL DEFAULT 0,
  instructor TEXT DEFAULT '',
  materials_url TEXT,
  course_mode TEXT NOT NULL DEFAULT 'online',
  featured INTEGER NOT NULL DEFAULT 0,
  enable_direct_purchase INTEGER NOT NULL DEFAULT 1,
  auto_assign INTEGER NOT NULL DEFAULT 1,
  prevent_overlap INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  objectives TEXT DEFAULT '[]',
  daily_content TEXT DEFAULT '[]',
  introduction TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  proposal_id INTEGER,
  announcement_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  zoom_link TEXT,
  start_date TEXT,
  end_date TEXT,
  instructor_name TEXT DEFAULT '',
  instructor_user_id INTEGER,
  instructor_eval_opened_at DATETIME,
  location TEXT DEFAULT '',
  place_id INTEGER,
  max_students INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_complete INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at DATETIME,
  completed_by INTEGER,
  survey_closes_at DATETIME,
  survey_reminder1_at DATETIME,
  survey_reminder2_at DATETIME,
  activity_type TEXT DEFAULT '',
  report_notes TEXT DEFAULT '',
  report_recommendations TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS group_student_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  moved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- An order is now a header (one total, one receipt) with N items. The legacy
-- course_id column is kept for old clients and is NOT the source of truth.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  notes_team TEXT,
  notes_student TEXT,
  cancel_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- One row per course inside an order. price is the course price at the time
-- of booking, so later price changes never rewrite old order totals.
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  serial_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  revoked_at DATETIME,
  revoke_reason TEXT,
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lectures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  date TEXT,
  time_from TEXT DEFAULT '',
  time_to TEXT DEFAULT '',
  topic TEXT DEFAULT '',
  location TEXT DEFAULT '',
  zoom_link TEXT DEFAULT '',
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at DATETIME,
  sort_order INTEGER NOT NULL DEFAULT 0,
  attendance_active INTEGER NOT NULL DEFAULT 0,
  attendance_seed TEXT,
  attendance_started_at DATETIME,
  attendance_expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lecture_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lecture_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  attended INTEGER NOT NULL DEFAULT 0,
  attended_at DATETIME,
  verification_method TEXT DEFAULT 'qr',
  code_used TEXT,
  ip_address TEXT,
  FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(lecture_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  verified_by INTEGER,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (verified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

-- Payment methods configured by the admin. orders.payment_method stores the
-- key, so rows used by an order are only ever disabled, never deleted.
CREATE TABLE IF NOT EXISTS payment_methods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'digital',
  account_number TEXT DEFAULT '',
  account_name TEXT DEFAULT '',
  instructions TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Post-course student survey (edit-plan.md §4.4). One row per student per
-- group: a draft that is auto-saved, then a single submitted response.
CREATE TABLE IF NOT EXISTS group_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_anonymous INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  answers TEXT NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  UNIQUE(group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Instructor evaluation of the group's students (edit-plan.md §5). One record
-- per group holding a draft, then a final submission that only an admin reopens.
CREATE TABLE IF NOT EXISTS group_instructor_evals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL UNIQUE,
  instructor_user_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS group_instructor_eval_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  scores TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  UNIQUE(eval_id, student_id),
  FOREIGN KEY (eval_id) REFERENCES group_instructor_evals(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Course proposals submitted by instructors before a course exists (edit-plan.md §6).
CREATE TABLE IF NOT EXISTS course_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instructor_user_id INTEGER NOT NULL,
  course_title TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '[]',
  daily_content TEXT NOT NULL DEFAULT '[]',
  materials_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  admin_note TEXT DEFAULT '',
  course_id INTEGER,
  submitted_at DATETIME,
  reviewed_at DATETIME,
  reviewed_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
`;

export const DEFAULT_SETTINGS = {
  branding: {
    systemName: 'وحدة التدريب و التطوير',
    logoHeader: DEFAULT_LOGO_DATA_URL,
    logoFooter: DEFAULT_LOGO_DATA_URL,
    favicon: '',
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    sloganAr: 'نحو تعليم أفضل',
    sloganEn: 'Towards Better Learning',
    messageFooter:
      'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
  },
  aiKeys: [],
};

export const SEED_SQL = `
INSERT OR IGNORE INTO roles (id, name, permissions) VALUES
(1, 'admin', '{"all": true}'),
(2, 'employee', '{"courses": "read,write", "orders": "read,write", "students": "read", "financials": "read"}'),
(3, 'student', '{"courses": "read", "orders": "read"}');

INSERT OR IGNORE INTO system_settings (key, value) VALUES
('branding', '${JSON.stringify(JSON.stringify(DEFAULT_SETTINGS.branding))}'),
('aiKeys', '${JSON.stringify(JSON.stringify(DEFAULT_SETTINGS.aiKeys))}');
`;
