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

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title_ar TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  category_id INTEGER,
  max_students INTEGER NOT NULL DEFAULT 30,
  materials_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT '{}',
  zoom_link TEXT,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS group_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  receipt_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
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

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  serial_id TEXT UNIQUE NOT NULL,
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
`;

export const DEFAULT_SETTINGS = {
  branding: {
    systemName: 'LMS نظام إدارة التعلم',
    logoHeader: '',
    logoFooter: '',
    favicon: '',
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    sloganAr: 'نحو تعليم أفضل',
    sloganEn: 'Towards Better Learning',
    messageFooter: '',
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
