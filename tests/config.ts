// Central test configuration — override with environment variables so the
// suite can run against local servers or a deployed environment.
export const API_URL = process.env.API_URL || 'http://localhost:3001';
export const USER_UI_URL = process.env.USER_UI_URL || 'http://localhost:3000';
export const ADMIN_UI_URL = process.env.ADMIN_UI_URL || 'http://localhost:3002';

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@lms.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/** Unique-ish test data so repeated runs never collide on unique constraints. */
export function uniqueEmail(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@test.com`;
}

export function uniquePhone() {
  return `010${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
}
