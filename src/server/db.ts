import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export type DbMode = 'prod' | 'demo';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

const prodDbPath = path.join(dataDir, 'majdoor_mitra.db');
const demoDbPath = path.join(dataDir, 'majdoor_mitra_demo.db');

let prodDb: Database.Database | null = null;
let demoDb: Database.Database | null = null;

export const DEFAULT_PREMIUM_FEATURES = {
  gpsGeofencing: true,
  pdfExcelExports: true,
  whatsappIntegration: true,
  multiSiteManagement: true,
  cloudBackupRestore: true,
  customBranding: false,
};

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function getTableSql(db: Database.Database, table: string): string {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql?: string } | undefined;
  return row?.sql || '';
}

function migrateLegacyConstraints(db: Database.Database) {
  const usersSql = getTableSql(db, 'users');
  if (usersSql && !usersSql.includes("'SUPER_ADMIN'")) {
    db.pragma('foreign_keys = OFF');
    const tx = db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mobile TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('WORKER', 'OWNER', 'SUPER_ADMIN')),
          language TEXT NOT NULL DEFAULT 'hi' CHECK(language IN ('hi', 'en')),
          theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light', 'dark')),
          avatar_url TEXT DEFAULT '',
          email TEXT DEFAULT '',
          account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
          status_reason TEXT DEFAULT '',
          is_founder INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(mobile, role)
        );
        INSERT INTO users_new (id, mobile, name, role, language, theme, avatar_url, created_at)
        SELECT id, mobile, name, role, language, theme, COALESCE(avatar_url, ''), created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `);
    });
    tx();
    db.pragma('foreign_keys = ON');
  } else {
    if (!hasColumn(db, 'users', 'email')) {
      db.exec("ALTER TABLE users ADD COLUMN email TEXT DEFAULT ''");
    }
    if (!hasColumn(db, 'users', 'account_status')) {
      db.exec("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'ACTIVE'");
    }
    if (!hasColumn(db, 'users', 'status_reason')) {
      db.exec("ALTER TABLE users ADD COLUMN status_reason TEXT DEFAULT ''");
    }
    if (!hasColumn(db, 'users', 'is_founder')) {
      db.exec('ALTER TABLE users ADD COLUMN is_founder INTEGER NOT NULL DEFAULT 0');
    }
  }

  const otpSql = getTableSql(db, 'otp_codes');
  if (otpSql && !otpSql.includes("'SUPER_ADMIN'")) {
    db.exec(`
      CREATE TABLE otp_codes_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mobile TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('WORKER', 'OWNER', 'SUPER_ADMIN')),
        otp_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO otp_codes_new (id, mobile, role, otp_hash, expires_at, attempts, verified, created_at)
      SELECT id, mobile, role, otp_hash, expires_at, attempts, verified, created_at FROM otp_codes;
      DROP TABLE otp_codes;
      ALTER TABLE otp_codes_new RENAME TO otp_codes;
    `);
  }

  if (!hasColumn(db, 'employers', 'account_status')) {
    db.exec("ALTER TABLE employers ADD COLUMN account_status TEXT NOT NULL DEFAULT 'ACTIVE'");
  }
  if (!hasColumn(db, 'employers', 'subscription_plan')) {
    db.exec("ALTER TABLE employers ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'FREE'");
  }
  if (!hasColumn(db, 'employers', 'subscription_expires_at')) {
    db.exec("ALTER TABLE employers ADD COLUMN subscription_expires_at TEXT DEFAULT ''");
  }
  if (!hasColumn(db, 'employers', 'max_workers')) {
    db.exec('ALTER TABLE employers ADD COLUMN max_workers INTEGER NOT NULL DEFAULT 25');
  }
}

function initSchema(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('WORKER', 'OWNER', 'SUPER_ADMIN')),
      language TEXT NOT NULL DEFAULT 'hi' CHECK(language IN ('hi', 'en')),
      theme TEXT NOT NULL DEFAULT 'light' CHECK(theme IN ('light', 'dark')),
      avatar_url TEXT DEFAULT '',
      email TEXT DEFAULT '',
      account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
      status_reason TEXT DEFAULT '',
      is_founder INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(mobile, role)
    );

    CREATE TABLE IF NOT EXISTS employers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      address TEXT DEFAULT '',
      account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),
      subscription_plan TEXT NOT NULL DEFAULT 'FREE' CHECK(subscription_plan IN ('FREE', 'PRO', 'ENTERPRISE')),
      subscription_expires_at TEXT DEFAULT '',
      max_workers INTEGER NOT NULL DEFAULT 25,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS work_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      radius_meters INTEGER NOT NULL DEFAULT 500,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'COMPLETED', 'PAUSED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unique_worker_id TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      photo_url TEXT DEFAULT '',
      skill_role TEXT NOT NULL DEFAULT 'General Worker',
      wage_type TEXT NOT NULL DEFAULT 'DAILY' CHECK(wage_type IN ('DAILY', 'MONTHLY')),
      daily_wage REAL NOT NULL DEFAULT 500,
      monthly_salary REAL NOT NULL DEFAULT 0,
      overtime_rate REAL NOT NULL DEFAULT 75,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'INACTIVE')),
      joined_at TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(employer_id, mobile)
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE')),
      hours_worked REAL NOT NULL DEFAULT 8,
      overtime_hours REAL NOT NULL DEFAULT 0,
      gps_lat REAL,
      gps_lng REAL,
      gps_verified INTEGER NOT NULL DEFAULT 0,
      marked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      edit_reason TEXT DEFAULT '',
      edit_history_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(worker_id, date)
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      present_days REAL NOT NULL DEFAULT 0,
      half_days INTEGER NOT NULL DEFAULT 0,
      paid_leave_days INTEGER NOT NULL DEFAULT 0,
      absent_days INTEGER NOT NULL DEFAULT 0,
      total_hours REAL NOT NULL DEFAULT 0,
      overtime_hours REAL NOT NULL DEFAULT 0,
      attendance_earnings REAL NOT NULL DEFAULT 0,
      overtime_earnings REAL NOT NULL DEFAULT 0,
      bonus_total REAL NOT NULL DEFAULT 0,
      deduction_total REAL NOT NULL DEFAULT 0,
      total_salary REAL NOT NULL DEFAULT 0,
      advance_total REAL NOT NULL DEFAULT 0,
      paid_total REAL NOT NULL DEFAULT 0,
      remaining_balance REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(worker_id, month)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'UPI', 'BANK')),
      reference_no TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      description TEXT DEFAULT '',
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS advances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_mode IN ('CASH', 'UPI', 'BANK')),
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      reason TEXT DEFAULT '',
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      description TEXT DEFAULT '',
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER REFERENCES employers(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title_en TEXT NOT NULL,
      title_hi TEXT NOT NULL,
      message_en TEXT NOT NULL,
      message_hi TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name TEXT NOT NULL DEFAULT '',
      actor_role TEXT NOT NULL,
      employer_id INTEGER REFERENCES employers(id) ON DELETE CASCADE,
      worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_value_json TEXT DEFAULT '{}',
      new_value_json TEXT DEFAULT '{}',
      reason TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      employer_id INTEGER NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      owner_note TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mobile TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('WORKER', 'OWNER', 'SUPER_ADMIN')),
      otp_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS founder_credentials (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mobile TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      passkey_hash TEXT NOT NULL,
      configured_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      app_name TEXT NOT NULL DEFAULT 'MAJDOOR MITRA',
      founder_name TEXT NOT NULL DEFAULT 'Raja',
      founder_role_title TEXT NOT NULL DEFAULT 'SUPER ADMIN / APP OWNER',
      maintenance_mode INTEGER NOT NULL DEFAULT 0,
      registration_enabled INTEGER NOT NULL DEFAULT 1,
      free_plan_worker_limit INTEGER NOT NULL DEFAULT 25,
      pro_plan_worker_limit INTEGER NOT NULL DEFAULT 250,
      pro_plan_price_inr INTEGER NOT NULL DEFAULT 499,
      enterprise_plan_price_inr INTEGER NOT NULL DEFAULT 1999,
      premium_features_json TEXT NOT NULL DEFAULT '{}',
      support_contact TEXT NOT NULL DEFAULT '',
      announcement_banner TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS super_admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_name TEXT NOT NULL DEFAULT 'Raja',
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      details_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance(worker_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_employer_date ON attendance(employer_id, date);
    CREATE INDEX IF NOT EXISTS idx_payments_worker_date ON payments(worker_id, date);
    CREATE INDEX IF NOT EXISTS idx_advances_worker_date ON advances(worker_id, date);
    CREATE INDEX IF NOT EXISTS idx_salaries_worker_month ON salaries(worker_id, month);
    CREATE INDEX IF NOT EXISTS idx_notifications_worker ON notifications(worker_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_audit_employer ON audit_logs(employer_id, created_at);
  `);

  migrateLegacyConstraints(db);

  db.prepare(
    `INSERT OR IGNORE INTO app_settings (
      id, app_name, founder_name, founder_role_title, maintenance_mode, registration_enabled,
      free_plan_worker_limit, pro_plan_worker_limit, pro_plan_price_inr, enterprise_plan_price_inr,
      premium_features_json, support_contact, announcement_banner
    ) VALUES (1, 'MAJDOOR MITRA', 'Raja', 'SUPER ADMIN / APP OWNER', 0, 1, 25, 250, 499, 1999, ?, ?, '')`
  ).run(
    JSON.stringify(DEFAULT_PREMIUM_FEATURES),
    process.env.FOUNDER_EMAIL || 'rh588193@gmail.com'
  );
}

export function getDb(mode: DbMode = 'prod'): Database.Database {
  if (mode === 'demo') {
    if (!demoDb) {
      demoDb = new Database(demoDbPath);
      initSchema(demoDb);
    }
    return demoDb;
  }
  if (!prodDb) {
    prodDb = new Database(prodDbPath);
    initSchema(prodDb);
  }
  return prodDb;
}

export function resetDemoDbFile() {
  if (demoDb) {
    demoDb.close();
    demoDb = null;
  }
  if (fs.existsSync(demoDbPath)) {
    fs.unlinkSync(demoDbPath);
  }
  return getDb('demo');
}
