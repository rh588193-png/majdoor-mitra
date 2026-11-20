import crypto from 'crypto';
import 'dotenv/config';
import express, { type Response } from 'express';
import http from 'http';
import path from 'path';
import {
  calculateAndPersistSalary,
  getEffectiveDailyWage,
  getWorkerAllTimeBalance,
  notifyWorker,
  roundRupees,
  writeAuditLog,
  type WorkerRow,
} from './src/server/accounting.ts';
import {
  hashOtp,
  hashPasskey,
  requireAuth,
  requireRole,
  signSession,
  timingSafeStringEqual,
  verifyPasskey,
  type AuthedRequest,
  type ServerAccountStatus,
  type ServerSubscriptionPlan,
} from './src/server/auth.ts';
import { DEFAULT_PREMIUM_FEATURES, getDb, type DbMode } from './src/server/db.ts';
import { ensureDemoSeeded } from './src/server/demoSeed.ts';

const PORT = 3000;

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthYm(): string {
  return todayYmd().slice(0, 7);
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeMobile(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie('mm_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function parseAppSettings(db: ReturnType<typeof getDb>) {
  const row = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as Record<string, any> | undefined;
  let premiumFeatures = { ...DEFAULT_PREMIUM_FEATURES };
  try {
    if (row?.premium_features_json) {
      premiumFeatures = { ...DEFAULT_PREMIUM_FEATURES, ...JSON.parse(String(row.premium_features_json)) };
    }
  } catch {
    // ignore invalid json
  }
  return {
    appName: String(row?.app_name || 'MAJDOOR MITRA'),
    founderName: String(row?.founder_name || 'Raja'),
    founderRoleTitle: String(row?.founder_role_title || 'SUPER ADMIN / APP OWNER'),
    maintenanceMode: Boolean(row?.maintenance_mode),
    registrationEnabled: row?.registration_enabled === undefined ? true : Boolean(row?.registration_enabled),
    freePlanWorkerLimit: Number(row?.free_plan_worker_limit || 25),
    proPlanWorkerLimit: Number(row?.pro_plan_worker_limit || 250),
    proPlanPriceInr: Number(row?.pro_plan_price_inr || 499),
    enterprisePlanPriceInr: Number(row?.enterprise_plan_price_inr || 1999),
    premiumFeatures,
    supportContact: String(row?.support_contact || process.env.FOUNDER_EMAIL || 'rh588193@gmail.com'),
    announcementBanner: String(row?.announcement_banner || ''),
    updatedAt: String(row?.updated_at || ''),
  };
}

function getFounderEnvConfig() {
  const mobile = normalizeMobile(process.env.FOUNDER_MOBILE || '');
  const passkeyHash = String(process.env.FOUNDER_PASSKEY_HASH || '').trim();
  const email = String(process.env.FOUNDER_EMAIL || 'rh588193@gmail.com').trim();
  const name = String(process.env.FOUNDER_NAME || 'Raja').trim() || 'Raja';
  const bootstrapSecret = String(process.env.FOUNDER_BOOTSTRAP_SECRET || '').trim();
  const isEnvConfigured = /^[6-9]\d{9}$/.test(mobile) && passkeyHash.includes(':');
  return { mobile, passkeyHash, email, name, bootstrapSecret, isEnvConfigured };
}

function ensureEnvFounderProvisioned(db: ReturnType<typeof getDb>) {
  const envCfg = getFounderEnvConfig();
  if (!envCfg.isEnvConfigured) return null;

  let user = db
    .prepare("SELECT * FROM users WHERE mobile = ? AND role = 'SUPER_ADMIN'")
    .get(envCfg.mobile) as AuthedRequest['currentUser'] | undefined;

  if (!user) {
    const ins = db
      .prepare(
        `INSERT INTO users (mobile, name, role, language, theme, avatar_url, email, account_status, is_founder)
         VALUES (?, ?, 'SUPER_ADMIN', 'en', 'light', ?, ?, 'ACTIVE', 1)`
      )
      .run(
        envCfg.mobile,
        envCfg.name,
        '/src/assets/images/avatar_owner_portrait_1795110250453.jpg',
        envCfg.email
      );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(ins.lastInsertRowid)) as AuthedRequest['currentUser'];
  } else if (user.is_founder !== 1 || user.account_status !== 'ACTIVE') {
    db.prepare("UPDATE users SET is_founder = 1, account_status = 'ACTIVE', email = ? WHERE id = ?").run(
      envCfg.email,
      user.id
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as AuthedRequest['currentUser'];
  }

  return {
    userId: user.id,
    mobile: envCfg.mobile,
    email: envCfg.email,
    passkeyHash: envCfg.passkeyHash,
    source: 'env' as const,
  };
}

function getActiveFounderCredential(db: ReturnType<typeof getDb>) {
  const envFounder = ensureEnvFounderProvisioned(db);
  if (envFounder) return envFounder;

  const row = db.prepare('SELECT * FROM founder_credentials WHERE id = 1').get() as
    | { id: number; user_id: number; mobile: string; email: string; passkey_hash: string }
    | undefined;
  if (!row) return null;

  return {
    userId: row.user_id,
    mobile: row.mobile,
    email: row.email,
    passkeyHash: row.passkey_hash,
    source: 'db' as const,
  };
}

function writeSuperAdminAudit(
  db: ReturnType<typeof getDb>,
  params: {
    actorUserId: number;
    actorName: string;
    action: string;
    targetType: string;
    targetId?: number | null;
    details?: unknown;
    reason?: string;
  }
) {
  db.prepare(
    `INSERT INTO super_admin_audit_logs (actor_user_id, actor_name, action, target_type, target_id, details_json, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.actorUserId,
    params.actorName,
    params.action,
    params.targetType,
    params.targetId ?? null,
    JSON.stringify(params.details ?? {}),
    params.reason || ''
  );
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Ensure production DB is initialized (zero fake data!) and provision env founder if set
  const initProdDb = getDb('prod');
  ensureEnvFounderProvisioned(initProdDb);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'majdoor-mitra' });
  });

  // Public App Config & About App (Available pre-login)
  app.get('/api/app/public-config', (_req, res) => {
    const db = getDb('prod');
    res.json(parseAppSettings(db));
  });

  // --------------------------------------------------------------------------
  // FOUNDER / SUPER ADMIN AUTHENTICATION ROUTES
  // --------------------------------------------------------------------------
  app.get('/api/auth/founder/status', (_req, res) => {
    const db = getDb('prod');
    const envCfg = getFounderEnvConfig();
    const active = getActiveFounderCredential(db);
    res.json({
      configured: Boolean(active),
      source: active?.source || 'unconfigured',
      requiresSetupSecret: !active && Boolean(envCfg.bootstrapSecret),
      founderName: envCfg.name,
      founderEmail: active?.email || envCfg.email,
    });
  });

  // One-time interactive setup when FOUNDER_MOBILE / FOUNDER_PASSKEY_HASH are not pre-set in env
  app.post('/api/auth/founder/setup', (req, res) => {
    const db = getDb('prod');
    const envCfg = getFounderEnvConfig();
    const existing = getActiveFounderCredential(db);
    if (existing) {
      res.status(403).json({
        error: 'Founder account is already configured and permanently locked. Please sign in with your credentials.',
      });
      return;
    }

    const existingSuperAdmin = db.prepare("SELECT id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1").get();
    if (existingSuperAdmin) {
      res.status(403).json({ error: 'A Super Admin account already exists.' });
      return;
    }

    if (envCfg.bootstrapSecret) {
      const providedSecret = String(req.body?.setupSecret || '').trim();
      if (!providedSecret || !timingSafeStringEqual(providedSecret, envCfg.bootstrapSecret)) {
        res.status(403).json({ error: 'Invalid deployment setup secret.' });
        return;
      }
    }

    const mobile = normalizeMobile(req.body?.mobile);
    const email = String(req.body?.email || envCfg.email).trim();
    const passkey = String(req.body?.passkey || '');

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      return;
    }
    if (passkey.length < 8) {
      res.status(400).json({ error: 'Founder passkey must be at least 8 characters long.' });
      return;
    }

    const passkeyHash = hashPasskey(passkey);
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashOtp(otp, mobile);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    const tx = db.transaction(() => {
      const insUser = db
        .prepare(
          `INSERT INTO users (mobile, name, role, language, theme, avatar_url, email, account_status, is_founder)
           VALUES (?, ?, 'SUPER_ADMIN', 'en', 'light', ?, ?, 'ACTIVE', 1)`
        )
        .run(
          mobile,
          envCfg.name,
          '/src/assets/images/avatar_owner_portrait_1795110250453.jpg',
          email
        );
      const userId = Number(insUser.lastInsertRowid);

      db.prepare(
        `INSERT INTO founder_credentials (id, user_id, mobile, email, passkey_hash)
         VALUES (1, ?, ?, ?, ?)`
      ).run(userId, mobile, email, passkeyHash);

      db.prepare("DELETE FROM otp_codes WHERE mobile = ? AND role = 'SUPER_ADMIN'").run(mobile);
      db.prepare(
        "INSERT INTO otp_codes (mobile, role, otp_hash, expires_at) VALUES (?, 'SUPER_ADMIN', ?, ?)"
      ).run(mobile, otpHash, expiresAt);

      writeSuperAdminAudit(db, {
        actorUserId: userId,
        actorName: envCfg.name,
        action: 'FOUNDER_ACCOUNT_CONFIGURED',
        targetType: 'users',
        targetId: userId,
        details: { mobileMasked: `******${mobile.slice(-4)}`, email },
      });
    });

    tx();

    res.json({
      success: true,
      expiresInSeconds: 300,
      verificationOtp: otp,
    });
  });

  app.post('/api/auth/founder/request-otp', (req, res) => {
    const db = getDb('prod');
    const cred = getActiveFounderCredential(db);
    if (!cred) {
      res.status(404).json({ error: 'Founder account is not configured yet.' });
      return;
    }

    const mobile = normalizeMobile(req.body?.mobile);
    const passkey = String(req.body?.passkey || '');

    if (!/^[6-9]\d{9}$/.test(mobile) || !passkey) {
      res.status(400).json({ error: 'Registered founder mobile number and passkey are required.' });
      return;
    }

    const mobileOk = timingSafeStringEqual(mobile, cred.mobile);
    const passkeyOk = verifyPasskey(passkey, cred.passkeyHash);

    if (!mobileOk || !passkeyOk) {
      res.status(401).json({ error: 'Invalid founder credentials. Access denied.' });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashOtp(otp, mobile);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.prepare("DELETE FROM otp_codes WHERE mobile = ? AND role = 'SUPER_ADMIN'").run(mobile);
    db.prepare(
      "INSERT INTO otp_codes (mobile, role, otp_hash, expires_at) VALUES (?, 'SUPER_ADMIN', ?, ?)"
    ).run(mobile, otpHash, expiresAt);

    res.json({
      success: true,
      expiresInSeconds: 300,
      verificationOtp: otp,
    });
  });

  app.post('/api/auth/founder/verify-otp', (req, res) => {
    const db = getDb('prod');
    const cred = getActiveFounderCredential(db);
    if (!cred) {
      res.status(404).json({ error: 'Founder account is not configured yet.' });
      return;
    }

    const mobile = normalizeMobile(req.body?.mobile);
    const otp = String(req.body?.otp || '').trim();

    if (!timingSafeStringEqual(mobile, cred.mobile) || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Invalid founder mobile number or 6-digit OTP.' });
      return;
    }

    const otpRecord = db
      .prepare(
        `SELECT * FROM otp_codes
         WHERE mobile = ? AND role = 'SUPER_ADMIN' AND verified = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get(mobile) as
      | { id: number; otp_hash: string; expires_at: number; attempts: number }
      | undefined;

    if (!otpRecord) {
      res.status(400).json({ error: 'No active OTP found. Please request a new OTP.' });
      return;
    }
    if (Date.now() > otpRecord.expires_at) {
      res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      return;
    }
    if (otpRecord.attempts >= 5) {
      res.status(429).json({ error: 'Too many invalid attempts. Please request a new OTP.' });
      return;
    }

    const incomingHash = hashOtp(otp, mobile);
    if (!timingSafeStringEqual(incomingHash, otpRecord.otp_hash)) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
      return;
    }

    db.prepare('UPDATE otp_codes SET verified = 1 WHERE id = ?').run(otpRecord.id);

    const user = db
      .prepare("SELECT * FROM users WHERE id = ? AND role = 'SUPER_ADMIN' AND is_founder = 1")
      .get(cred.userId) as AuthedRequest['currentUser'] | undefined;

    if (!user) {
      res.status(403).json({ error: 'Founder profile verification failed.' });
      return;
    }

    writeSuperAdminAudit(db, {
      actorUserId: user.id,
      actorName: user.name,
      action: 'SUPER_ADMIN_LOGIN',
      targetType: 'users',
      targetId: user.id,
      details: { method: 'PASSKEY_OTP' },
    });

    const token = signSession({
      userId: user.id,
      mobile: user.mobile,
      role: 'SUPER_ADMIN',
      mode: 'prod',
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });

    setSessionCookie(res, token);
    res.json({ success: true, token, user, mode: 'prod' });
  });

  // --------------------------------------------------------------------------
  // STANDARD AUTHENTICATION & OTP ROUTES (WORKER & OWNER ONLY)
  // --------------------------------------------------------------------------
  app.post('/api/auth/request-otp', (req, res) => {
    if (req.body?.role === 'SUPER_ADMIN') {
      res.status(403).json({
        error: 'Forbidden: Super Admin access is strictly restricted to the Founder Portal.',
      });
      return;
    }

    const mobile = normalizeMobile(req.body?.mobile);
    const role: 'WORKER' | 'OWNER' = req.body?.role === 'OWNER' ? 'OWNER' : 'WORKER';

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
      return;
    }

    const db = getDb('prod');
    const settings = parseAppSettings(db);
    if (settings.maintenanceMode) {
      res.status(503).json({
        error: 'MAJDOOR MITRA is currently undergoing scheduled maintenance. Please try again shortly.',
      });
      return;
    }

    const existingUser = db
      .prepare('SELECT id, name, account_status, status_reason FROM users WHERE mobile = ? AND role = ?')
      .get(mobile, role) as
      | { id: number; name: string; account_status: ServerAccountStatus; status_reason: string }
      | undefined;

    if (!existingUser && !settings.registrationEnabled) {
      res.status(403).json({
        error: 'New user registrations are temporarily paused by the App Owner.',
      });
      return;
    }

    if (existingUser && existingUser.account_status && existingUser.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: `Account ${existingUser.account_status.toLowerCase()}${existingUser.status_reason ? `: ${existingUser.status_reason}` : '. Contact Super Admin.'}`,
      });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = hashOtp(otp, mobile);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.prepare('DELETE FROM otp_codes WHERE mobile = ? AND role = ?').run(mobile, role);
    db.prepare('INSERT INTO otp_codes (mobile, role, otp_hash, expires_at) VALUES (?, ?, ?, ?)').run(
      mobile,
      role,
      otpHash,
      expiresAt
    );

    res.json({
      success: true,
      isRegistered: Boolean(existingUser),
      existingName: existingUser?.name || '',
      expiresInSeconds: 300,
      // Returned in preview/sandbox mode so OTP verification is immediately testable without paid SMS gateway
      verificationOtp: otp,
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    if (req.body?.role === 'SUPER_ADMIN') {
      res.status(403).json({
        error: 'Forbidden: Ordinary login cannot authenticate or register as Super Admin.',
      });
      return;
    }

    const mobile = normalizeMobile(req.body?.mobile);
    const role: 'WORKER' | 'OWNER' = req.body?.role === 'OWNER' ? 'OWNER' : 'WORKER';
    const otp = String(req.body?.otp || '').trim();
    const name = String(req.body?.name || '').trim();
    const businessName = String(req.body?.businessName || '').trim();
    const address = String(req.body?.address || '').trim();
    const language = req.body?.language === 'en' ? 'en' : 'hi';

    if (!/^[6-9]\d{9}$/.test(mobile) || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Invalid mobile number or 6-digit OTP.' });
      return;
    }

    const db = getDb('prod');
    const settings = parseAppSettings(db);
    if (settings.maintenanceMode) {
      res.status(503).json({
        error: 'MAJDOOR MITRA is currently in maintenance mode.',
      });
      return;
    }

    const otpRecord = db
      .prepare(
        `SELECT * FROM otp_codes
         WHERE mobile = ? AND role = ? AND verified = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get(mobile, role) as
      | { id: number; otp_hash: string; expires_at: number; attempts: number }
      | undefined;

    if (!otpRecord) {
      res.status(400).json({ error: 'No active OTP found. Please request a new OTP.' });
      return;
    }

    if (Date.now() > otpRecord.expires_at) {
      res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
      return;
    }

    if (otpRecord.attempts >= 5) {
      res.status(429).json({ error: 'Too many invalid attempts. Please request a new OTP.' });
      return;
    }

    const incomingHash = hashOtp(otp, mobile);
    if (!timingSafeStringEqual(incomingHash, otpRecord.otp_hash)) {
      db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?').run(otpRecord.id);
      res.status(400).json({ error: 'Incorrect OTP. Please try again.' });
      return;
    }

    db.prepare('UPDATE otp_codes SET verified = 1 WHERE id = ?').run(otpRecord.id);

    let user = db.prepare('SELECT * FROM users WHERE mobile = ? AND role = ?').get(mobile, role) as
      | AuthedRequest['currentUser']
      | undefined;

    if (!user) {
      if (!settings.registrationEnabled) {
        res.status(403).json({ error: 'New registrations are currently disabled by Super Admin.' });
        return;
      }

      const displayName = name || (role === 'OWNER' ? `Owner ${mobile.slice(-4)}` : `Worker ${mobile.slice(-4)}`);
      const defaultAvatar =
        role === 'OWNER'
          ? '/src/assets/images/avatar_owner_portrait_1795110250453.jpg'
          : '/src/assets/images/avatar_worker_portrait_1795110250643.jpg';
      const insertUser = db
        .prepare(
          `INSERT INTO users (mobile, name, role, language, theme, avatar_url, account_status, is_founder)
           VALUES (?, ?, ?, ?, 'light', ?, 'ACTIVE', 0)`
        )
        .run(mobile, displayName, role, language, defaultAvatar);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(insertUser.lastInsertRowid)) as
        | AuthedRequest['currentUser']
        | undefined;
    }

    if (!user) {
      res.status(500).json({ error: 'Failed to initialize account.' });
      return;
    }

    if (user.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: `Account ${user.account_status.toLowerCase()}${user.status_reason ? `: ${user.status_reason}` : '. Contact Super Admin.'}`,
      });
      return;
    }

    if (role === 'OWNER') {
      const emp = db.prepare('SELECT * FROM employers WHERE user_id = ?').get(user.id) as
        | AuthedRequest['employer']
        | undefined;
      if (!emp) {
        const orgName = businessName || `${user.name} Enterprises`;
        const empRes = db
          .prepare(
            `INSERT INTO employers (user_id, business_name, owner_name, mobile, address, account_status, subscription_plan, max_workers)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'FREE', ?)`
          )
          .run(user.id, orgName, user.name, mobile, address, settings.freePlanWorkerLimit);
        // Create a primary default work site so owner can start immediately
        db.prepare(
          `INSERT INTO work_sites (employer_id, name, location, status)
           VALUES (?, ?, ?, 'ACTIVE')`
        ).run(Number(empRes.lastInsertRowid), 'Main Work Site', address || 'Primary Location');
      } else if (emp.account_status !== 'ACTIVE') {
        res.status(403).json({
          error: `Employer account ${emp.account_status.toLowerCase()}. Contact Super Admin.`,
        });
        return;
      }
    } else {
      // Link any existing worker rows matching this mobile to this worker user ID
      db.prepare('UPDATE workers SET user_id = ? WHERE mobile = ? AND (user_id IS NULL OR user_id != ?)').run(
        user.id,
        mobile,
        user.id
      );
    }

    const token = signSession({
      userId: user.id,
      mobile: user.mobile,
      role: user.role,
      mode: 'prod',
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    setSessionCookie(res, token);
    res.json({ success: true, token, user, mode: 'prod' });
  });

  app.post('/api/auth/demo-login', (req, res) => {
    if (req.body?.role === 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden: Super Admin cannot be accessed in Demo Mode.' });
      return;
    }

    const role: 'WORKER' | 'OWNER' = req.body?.role === 'OWNER' ? 'OWNER' : 'WORKER';
    const reset = Boolean(req.body?.reset);
    const db = ensureDemoSeeded(reset);

    const user = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY id ASC LIMIT 1').get(role) as
      | AuthedRequest['currentUser']
      | undefined;

    if (!user) {
      res.status(500).json({ error: 'Demo user initialization failed.' });
      return;
    }

    const token = signSession({
      userId: user.id,
      mobile: user.mobile,
      role: user.role,
      mode: 'demo',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    setSessionCookie(res, token);
    res.json({ success: true, token, user, mode: 'demo' });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('mm_session', { path: '/' });
    res.json({ success: true });
  });

  app.get('/api/auth/me', requireAuth as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const appSettings = parseAppSettings(getDb('prod'));

    if (areq.currentUser?.role === 'SUPER_ADMIN') {
      res.json({
        user: areq.currentUser,
        mode: areq.dbMode,
        appSettings,
      });
      return;
    }

    if (areq.currentUser?.role === 'OWNER') {
      res.json({
        user: areq.currentUser,
        employer: areq.employer,
        mode: areq.dbMode,
        appSettings,
      });
      return;
    }

    const linkedWorkers = db
      .prepare(
        `SELECT w.*, e.business_name, e.owner_name, e.mobile as employer_mobile, s.name as site_name
         FROM workers w
         JOIN employers e ON w.employer_id = e.id
         LEFT JOIN work_sites s ON w.site_id = s.id
         WHERE w.user_id = ? OR w.mobile = ?
         ORDER BY w.id ASC`
      )
      .all(areq.currentUser!.id, areq.currentUser!.mobile);

    res.json({
      user: areq.currentUser,
      linkedWorkers,
      mode: areq.dbMode,
      appSettings,
    });
  });

  app.patch('/api/auth/preferences', requireAuth as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);

    // Explicitly reject any attempt to escalate role or alter status/subscription via preferences
    if (
      req.body?.role !== undefined ||
      req.body?.account_status !== undefined ||
      req.body?.is_founder !== undefined ||
      req.body?.subscription_plan !== undefined
    ) {
      res.status(403).json({
        error: 'Forbidden: Role, account status, and subscription properties cannot be modified by user profile updates.',
      });
      return;
    }

    const language = req.body?.language === 'en' ? 'en' : req.body?.language === 'hi' ? 'hi' : areq.currentUser!.language;
    const theme = req.body?.theme === 'dark' ? 'dark' : req.body?.theme === 'light' ? 'light' : areq.currentUser!.theme;
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : areq.currentUser!.name;

    db.prepare('UPDATE users SET language = ?, theme = ?, name = ? WHERE id = ?').run(
      language,
      theme,
      name,
      areq.currentUser!.id
    );

    if (areq.currentUser!.role === 'OWNER' && areq.employer && typeof req.body?.businessName === 'string') {
      const bname = req.body.businessName.trim();
      if (bname) {
        db.prepare('UPDATE employers SET business_name = ?, owner_name = ? WHERE id = ?').run(
          bname,
          name,
          areq.employer.id
        );
      }
    }

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(areq.currentUser!.id);
    res.json({ success: true, user: updated });
  });

  // --------------------------------------------------------------------------
  // OWNER ROUTES (Strictly scoped to req.employer.id)
  // --------------------------------------------------------------------------
  app.get('/api/owner/dashboard', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentMonthYm();
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : todayYmd();

    const sites = db.prepare('SELECT * FROM work_sites WHERE employer_id = ? ORDER BY id ASC').all(employerId);
    const workersRaw = db
      .prepare(
        `SELECT w.*, s.name as site_name
         FROM workers w
         LEFT JOIN work_sites s ON w.site_id = s.id
         WHERE w.employer_id = ?
         ORDER BY w.status ASC, w.name ASC`
      )
      .all(employerId) as Array<WorkerRow & { site_name: string | null }>;

    const workers = workersRaw.map((w) => {
      const monthSalary = calculateAndPersistSalary(db, w.id, month);
      const allTime = getWorkerAllTimeBalance(db, w.id);
      const todayAtt = db
        .prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?')
        .get(w.id, date);
      return {
        ...w,
        effective_daily_wage: getEffectiveDailyWage(w),
        month_salary: monthSalary,
        all_time_balance: allTime,
        today_attendance: todayAtt || null,
      };
    });

    const todayAttendance = db
      .prepare(
        `SELECT a.*, w.name as worker_name, w.unique_worker_id
         FROM attendance a
         JOIN workers w ON a.worker_id = w.id
         WHERE a.employer_id = ? AND a.date = ?`
      )
      .all(employerId, date);

    const monthAttendance = db
      .prepare(
        `SELECT a.*, w.name as worker_name, w.unique_worker_id
         FROM attendance a
         JOIN workers w ON a.worker_id = w.id
         WHERE a.employer_id = ? AND a.date LIKE ?
         ORDER BY a.date DESC, w.name ASC`
      )
      .all(employerId, `${month}%`);

    const expenses = db
      .prepare(
        `SELECT e.*, s.name as site_name
         FROM expenses e
         LEFT JOIN work_sites s ON e.site_id = s.id
         WHERE e.employer_id = ? AND e.date LIKE ?
         ORDER BY e.date DESC, e.id DESC`
      )
      .all(employerId, `${month}%`);

    const leaveRequests = db
      .prepare(
        `SELECT lr.*, w.name as worker_name, w.unique_worker_id, w.mobile as worker_mobile
         FROM leave_requests lr
         JOIN workers w ON lr.worker_id = w.id
         WHERE lr.employer_id = ?
         ORDER BY CASE WHEN lr.status = 'PENDING' THEN 0 ELSE 1 END, lr.id DESC`
      )
      .all(employerId);

    const auditLogs = db
      .prepare('SELECT * FROM audit_logs WHERE employer_id = ? ORDER BY id DESC LIMIT 100')
      .all(employerId);

    res.json({
      employer: areq.employer,
      month,
      date,
      sites,
      workers,
      todayAttendance,
      monthAttendance,
      expenses,
      leaveRequests,
      auditLogs,
    });
  });

  // Work Sites CRUD
  app.post('/api/owner/sites', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const name = String(req.body?.name || '').trim();
    const location = String(req.body?.location || '').trim();
    const latitude = req.body?.latitude !== undefined && req.body?.latitude !== '' ? Number(req.body.latitude) : null;
    const longitude = req.body?.longitude !== undefined && req.body?.longitude !== '' ? Number(req.body.longitude) : null;
    const radiusMeters = Number(req.body?.radiusMeters) > 0 ? Number(req.body.radiusMeters) : 500;

    if (!name) {
      res.status(400).json({ error: 'Work site name is required.' });
      return;
    }

    const r = db
      .prepare(
        `INSERT INTO work_sites (employer_id, name, location, latitude, longitude, radius_meters)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(areq.employer!.id, name, location, latitude, longitude, radiusMeters);

    const site = db.prepare('SELECT * FROM work_sites WHERE id = ?').get(Number(r.lastInsertRowid));
    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId: areq.employer!.id,
      action: 'CREATE_SITE',
      entityType: 'work_sites',
      entityId: Number(r.lastInsertRowid),
      newValue: site,
    });

    res.json({ success: true, site });
  });

  app.patch('/api/owner/sites/:id', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const siteId = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM work_sites WHERE id = ? AND employer_id = ?')
      .get(siteId, areq.employer!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Work site not found.' });
      return;
    }

    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : existing.name;
    const location = typeof req.body?.location === 'string' ? req.body.location.trim() : existing.location;
    const status = ['ACTIVE', 'COMPLETED', 'PAUSED'].includes(req.body?.status) ? req.body.status : existing.status;
    const latitude = req.body?.latitude !== undefined ? (req.body.latitude === '' || req.body.latitude === null ? null : Number(req.body.latitude)) : existing.latitude;
    const longitude = req.body?.longitude !== undefined ? (req.body.longitude === '' || req.body.longitude === null ? null : Number(req.body.longitude)) : existing.longitude;
    const radiusMeters = Number(req.body?.radiusMeters) > 0 ? Number(req.body.radiusMeters) : existing.radius_meters;

    db.prepare(
      `UPDATE work_sites SET name = ?, location = ?, status = ?, latitude = ?, longitude = ?, radius_meters = ?
       WHERE id = ? AND employer_id = ?`
    ).run(name, location, status, latitude, longitude, radiusMeters, siteId, areq.employer!.id);

    const updated = db.prepare('SELECT * FROM work_sites WHERE id = ?').get(siteId);
    res.json({ success: true, site: updated });
  });

  app.delete('/api/owner/sites/:id', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const siteId = Number(req.params.id);
    db.prepare('UPDATE workers SET site_id = NULL WHERE site_id = ? AND employer_id = ?').run(siteId, areq.employer!.id);
    db.prepare('DELETE FROM work_sites WHERE id = ? AND employer_id = ?').run(siteId, areq.employer!.id);
    res.json({ success: true });
  });

  // Workers CRUD
  app.post('/api/owner/workers', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const name = String(req.body?.name || '').trim();
    const mobile = normalizeMobile(req.body?.mobile);
    const skillRole = String(req.body?.skillRole || 'General Worker').trim();
    const wageType = req.body?.wageType === 'MONTHLY' ? 'MONTHLY' : 'DAILY';
    const dailyWage = Number(req.body?.dailyWage) || 0;
    const monthlySalary = Number(req.body?.monthlySalary) || 0;
    const overtimeRate = Number(req.body?.overtimeRate) || 0;
    const siteId = req.body?.siteId ? Number(req.body.siteId) : null;
    const photoUrl = typeof req.body?.photoUrl === 'string' ? req.body.photoUrl : '';

    if (!name || !/^[6-9]\d{9}$/.test(mobile)) {
      res.status(400).json({ error: 'Worker name and valid 10-digit mobile number are required.' });
      return;
    }

    if (wageType === 'DAILY' && dailyWage <= 0) {
      res.status(400).json({ error: 'Daily wage must be greater than 0.' });
      return;
    }
    if (wageType === 'MONTHLY' && monthlySalary <= 0) {
      res.status(400).json({ error: 'Monthly salary must be greater than 0.' });
      return;
    }

    const dup = db
      .prepare('SELECT id FROM workers WHERE employer_id = ? AND mobile = ?')
      .get(employerId, mobile);
    if (dup) {
      res.status(409).json({ error: 'A worker with this mobile number already exists in your organization.' });
      return;
    }

    if (areq.dbMode === 'prod') {
      const empWorkerCount = db
        .prepare('SELECT COUNT(*) as cnt FROM workers WHERE employer_id = ?')
        .get(employerId) as { cnt: number };
      const limit = Number(areq.employer!.max_workers || 25);
      if (empWorkerCount.cnt >= limit) {
        res.status(403).json({
          error: `Worker limit reached (${limit} workers on ${areq.employer!.subscription_plan} plan). Contact Super Admin Raja to upgrade your plan.`,
        });
        return;
      }
    }

    const existingWorkerUser = db
      .prepare("SELECT id FROM users WHERE mobile = ? AND role = 'WORKER'")
      .get(mobile) as { id: number } | undefined;

    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM workers').get() as { cnt: number };
    const uniqueWorkerId = `MM-${new Date().getFullYear()}-${String(1001 + countRow.cnt).padStart(4, '0')}`;

    const computedOtRate =
      overtimeRate > 0
        ? overtimeRate
        : roundRupees((wageType === 'MONTHLY' ? monthlySalary / 30 : dailyWage) / 8);

    const ins = db
      .prepare(
        `INSERT INTO workers (
          unique_worker_id, user_id, employer_id, site_id, name, mobile, photo_url,
          skill_role, wage_type, daily_wage, monthly_salary, overtime_rate, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        uniqueWorkerId,
        existingWorkerUser?.id ?? null,
        employerId,
        siteId,
        name,
        mobile,
        photoUrl || '/src/assets/images/avatar_worker_portrait_1795110250643.jpg',
        skillRole,
        wageType,
        dailyWage,
        monthlySalary,
        computedOtRate,
        todayYmd()
      );

    const workerId = Number(ins.lastInsertRowid);
    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId);

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'ADD_WORKER',
      entityType: 'workers',
      entityId: workerId,
      newValue: worker,
    });

    notifyWorker(db, {
      workerId,
      employerId,
      type: 'PROFILE',
      titleEn: `Added to ${areq.employer!.business_name}`,
      titleHi: `${areq.employer!.business_name} में आपका खाता जुड़ गया`,
      messageEn: `Your Worker ID is ${uniqueWorkerId}.`,
      messageHi: `आपकी वर्कर आईडी ${uniqueWorkerId} है।`,
    });

    res.json({ success: true, worker });
  });

  app.patch('/api/owner/workers/:id', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const workerId = Number(req.params.id);

    const existing = db
      .prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?')
      .get(workerId, employerId) as WorkerRow | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Worker not found.' });
      return;
    }

    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : existing.name;
    const mobile = req.body?.mobile ? normalizeMobile(req.body.mobile) : existing.mobile;
    const skillRole = typeof req.body?.skillRole === 'string' && req.body.skillRole.trim() ? req.body.skillRole.trim() : existing.skill_role;
    const wageType = req.body?.wageType === 'MONTHLY' ? 'MONTHLY' : req.body?.wageType === 'DAILY' ? 'DAILY' : existing.wage_type;
    const dailyWage = req.body?.dailyWage !== undefined ? Number(req.body.dailyWage) : existing.daily_wage;
    const monthlySalary = req.body?.monthlySalary !== undefined ? Number(req.body.monthlySalary) : existing.monthly_salary;
    const overtimeRate = req.body?.overtimeRate !== undefined ? Number(req.body.overtimeRate) : existing.overtime_rate;
    const siteId = req.body?.siteId !== undefined ? (req.body.siteId ? Number(req.body.siteId) : null) : existing.site_id;
    const status = req.body?.status === 'INACTIVE' ? 'INACTIVE' : req.body?.status === 'ACTIVE' ? 'ACTIVE' : existing.status;
    const photoUrl = typeof req.body?.photoUrl === 'string' ? req.body.photoUrl : existing.photo_url;

    const existingWorkerUser = db
      .prepare("SELECT id FROM users WHERE mobile = ? AND role = 'WORKER'")
      .get(mobile) as { id: number } | undefined;

    db.prepare(
      `UPDATE workers
       SET name = ?, mobile = ?, user_id = ?, skill_role = ?, wage_type = ?, daily_wage = ?,
           monthly_salary = ?, overtime_rate = ?, site_id = ?, status = ?, photo_url = ?
       WHERE id = ? AND employer_id = ?`
    ).run(
      name,
      mobile,
      existingWorkerUser?.id ?? existing.user_id,
      skillRole,
      wageType,
      dailyWage,
      monthlySalary,
      overtimeRate,
      siteId,
      status,
      photoUrl,
      workerId,
      employerId
    );

    const updated = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId);
    calculateAndPersistSalary(db, workerId, currentMonthYm());

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'UPDATE_WORKER',
      entityType: 'workers',
      entityId: workerId,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, worker: updated });
  });

  app.delete('/api/owner/workers/:id', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const workerId = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?')
      .get(workerId, areq.employer!.id);
    if (!existing) {
      res.status(404).json({ error: 'Worker not found.' });
      return;
    }
    db.prepare('DELETE FROM workers WHERE id = ? AND employer_id = ?').run(workerId, areq.employer!.id);
    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId: areq.employer!.id,
      workerId,
      action: 'DELETE_WORKER',
      entityType: 'workers',
      entityId: workerId,
      oldValue: existing,
    });
    res.json({ success: true });
  });

  // Attendance Mark & Correction with Reason + Edit History + Notifications
  function upsertAttendanceRecord(
    areq: AuthedRequest,
    body: {
      workerId: number;
      date: string;
      status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE';
      hoursWorked?: number;
      overtimeHours?: number;
      siteId?: number | null;
      gpsLat?: number | null;
      gpsLng?: number | null;
      editReason?: string;
      notes?: string;
    }
  ) {
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const worker = db
      .prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?')
      .get(body.workerId, employerId) as WorkerRow | undefined;

    if (!worker) {
      throw new Error('Worker not found in your organization.');
    }

    const existing = db
      .prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?')
      .get(body.workerId, body.date) as
      | {
          id: number;
          status: string;
          hours_worked: number;
          overtime_hours: number;
          edit_history_json: string;
        }
      | undefined;

    const otHours = Number(body.overtimeHours || 0);
    const defaultHours =
      body.status === 'PRESENT' ? 8 + otHours : body.status === 'HALF_DAY' ? 4 + otHours : body.status === 'PAID_LEAVE' ? 8 : 0;
    const hoursWorked = body.hoursWorked !== undefined ? Number(body.hoursWorked) : defaultHours;
    const siteId = body.siteId !== undefined ? body.siteId : worker.site_id;

    let gpsVerified = 0;
    if (body.gpsLat != null && body.gpsLng != null && siteId) {
      const site = db.prepare('SELECT latitude, longitude, radius_meters FROM work_sites WHERE id = ?').get(siteId) as
        | { latitude: number | null; longitude: number | null; radius_meters: number }
        | undefined;
      if (site?.latitude != null && site?.longitude != null) {
        const dist = haversineMeters(body.gpsLat, body.gpsLng, site.latitude, site.longitude);
        gpsVerified = dist <= (site.radius_meters || 500) ? 1 : 0;
      } else {
        gpsVerified = 1;
      }
    }

    if (existing) {
      if (
        (existing.status !== body.status ||
          Number(existing.overtime_hours) !== otHours ||
          Number(existing.hours_worked) !== hoursWorked) &&
        !String(body.editReason || '').trim()
      ) {
        throw new Error('Please provide a reason for correcting existing attendance.');
      }

      const history = JSON.parse(existing.edit_history_json || '[]') as unknown[];
      history.push({
        editedAt: new Date().toISOString(),
        editedBy: areq.currentUser!.name,
        oldStatus: existing.status,
        newStatus: body.status,
        oldOvertime: existing.overtime_hours,
        newOvertime: otHours,
        reason: String(body.editReason || '').trim(),
      });

      db.prepare(
        `UPDATE attendance
         SET status = ?, hours_worked = ?, overtime_hours = ?, site_id = ?,
             gps_lat = COALESCE(?, gps_lat), gps_lng = COALESCE(?, gps_lng),
             gps_verified = CASE WHEN ? IS NOT NULL THEN ? ELSE gps_verified END,
             edit_reason = ?, edit_history_json = ?, notes = ?, marked_by_user_id = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        body.status,
        hoursWorked,
        otHours,
        siteId,
        body.gpsLat ?? null,
        body.gpsLng ?? null,
        body.gpsLat ?? null,
        gpsVerified,
        String(body.editReason || '').trim(),
        JSON.stringify(history),
        String(body.notes || ''),
        areq.currentUser!.id,
        existing.id
      );

      writeAuditLog(db, {
        actorUserId: areq.currentUser!.id,
        actorName: areq.currentUser!.name,
        actorRole: 'OWNER',
        employerId,
        workerId: body.workerId,
        action: 'UPDATE_ATTENDANCE',
        entityType: 'attendance',
        entityId: existing.id,
        oldValue: existing,
        newValue: { status: body.status, hoursWorked, overtimeHours: otHours },
        reason: String(body.editReason || '').trim(),
      });

      notifyWorker(db, {
        workerId: body.workerId,
        employerId,
        type: 'ATTENDANCE_UPDATE',
        titleEn: `Attendance Updated (${body.date})`,
        titleHi: `हाज़िरी अपडेट हुई (${body.date})`,
        messageEn: `Updated to ${body.status}${otHours > 0 ? ` + ${otHours}h OT` : ''}. Reason: ${body.editReason || 'Corrected'}`,
        messageHi: `हाज़िरी ${body.status}${otHours > 0 ? ` + ${otHours} घंटे OT` : ''} की गई। कारण: ${body.editReason || 'सुधार'}`,
      });
    } else {
      const ins = db
        .prepare(
          `INSERT INTO attendance (
            worker_id, employer_id, site_id, date, status, hours_worked, overtime_hours,
            gps_lat, gps_lng, gps_verified, marked_by_user_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          body.workerId,
          employerId,
          siteId,
          body.date,
          body.status,
          hoursWorked,
          otHours,
          body.gpsLat ?? null,
          body.gpsLng ?? null,
          gpsVerified,
          areq.currentUser!.id,
          String(body.notes || '')
        );

      writeAuditLog(db, {
        actorUserId: areq.currentUser!.id,
        actorName: areq.currentUser!.name,
        actorRole: 'OWNER',
        employerId,
        workerId: body.workerId,
        action: 'MARK_ATTENDANCE',
        entityType: 'attendance',
        entityId: Number(ins.lastInsertRowid),
        newValue: { date: body.date, status: body.status, hoursWorked, overtimeHours: otHours },
      });

      notifyWorker(db, {
        workerId: body.workerId,
        employerId,
        type: 'ATTENDANCE',
        titleEn: `Attendance Marked (${body.date})`,
        titleHi: `आज की हाज़िरी दर्ज (${body.date})`,
        messageEn: `Marked ${body.status}${otHours > 0 ? ` with ${otHours}h overtime` : ''}.`,
        messageHi: `आपकी हाज़िरी ${body.status}${otHours > 0 ? ` (${otHours} घंटे ओवरटाइम)` : ''} दर्ज हुई।`,
      });
    }

    const salary = calculateAndPersistSalary(db, body.workerId, body.date.slice(0, 7));
    return salary;
  }

  app.post('/api/owner/attendance', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const workerId = Number(req.body?.workerId);
    const date = String(req.body?.date || todayYmd());
    const status = req.body?.status;

    if (!workerId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE'].includes(status)) {
      res.status(400).json({ error: 'Valid workerId, date (YYYY-MM-DD), and status are required.' });
      return;
    }

    try {
      const salary = upsertAttendanceRecord(areq, {
        workerId,
        date,
        status,
        hoursWorked: req.body?.hoursWorked !== undefined ? Number(req.body.hoursWorked) : undefined,
        overtimeHours: Number(req.body?.overtimeHours || 0),
        siteId: req.body?.siteId ? Number(req.body.siteId) : undefined,
        gpsLat: req.body?.gpsLat !== undefined && req.body?.gpsLat !== null ? Number(req.body.gpsLat) : null,
        gpsLng: req.body?.gpsLng !== undefined && req.body?.gpsLng !== null ? Number(req.body.gpsLng) : null,
        editReason: req.body?.editReason,
        notes: req.body?.notes,
      });
      res.json({ success: true, salary });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save attendance' });
    }
  });

  app.post('/api/owner/attendance/bulk', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const results = [];
    for (const item of entries) {
      try {
        upsertAttendanceRecord(areq, {
          workerId: Number(item.workerId),
          date: String(item.date || todayYmd()),
          status: item.status,
          overtimeHours: Number(item.overtimeHours || 0),
          editReason: item.editReason || 'Bulk attendance update',
          gpsLat: item.gpsLat ?? null,
          gpsLng: item.gpsLng ?? null,
        });
        results.push({ workerId: item.workerId, ok: true });
      } catch (err: unknown) {
        results.push({ workerId: item.workerId, ok: false, error: err instanceof Error ? err.message : 'Error' });
      }
    }
    res.json({ success: true, results });
  });

  // Payments, Advances, Bonuses, Deductions, Expenses
  app.post('/api/owner/payments', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const workerId = Number(req.body?.workerId);
    const amount = Number(req.body?.amount);
    const paymentMode = ['CASH', 'UPI', 'BANK'].includes(req.body?.paymentMode) ? req.body.paymentMode : 'CASH';
    const referenceNo = String(req.body?.referenceNo || '').trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : todayYmd();
    const time = String(req.body?.time || nowTimeStr());
    const description = String(req.body?.description || 'Salary Payment').trim();

    const worker = db
      .prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?')
      .get(workerId, employerId) as WorkerRow | undefined;
    if (!worker || !(amount > 0)) {
      res.status(400).json({ error: 'Valid worker and positive payment amount are required.' });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO payments (worker_id, employer_id, site_id, amount, payment_mode, reference_no, date, time, description, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(workerId, employerId, worker.site_id, amount, paymentMode, referenceNo, date, time, description, areq.currentUser!.id);

    const salary = calculateAndPersistSalary(db, workerId, date.slice(0, 7));

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'RECORD_PAYMENT',
      entityType: 'payments',
      entityId: Number(ins.lastInsertRowid),
      newValue: { amount, paymentMode, date, description },
    });

    notifyWorker(db, {
      workerId,
      employerId,
      type: 'PAYMENT',
      titleEn: `Payment Received: ₹${amount}`,
      titleHi: `भुगतान प्राप्त: ₹${amount}`,
      messageEn: `₹${amount} paid via ${paymentMode} on ${date}. ${description}`,
      messageHi: `दिनांक ${date} को ${paymentMode} के माध्यम से ₹${amount} भुगतान प्राप्त हुआ। ${description}`,
    });

    res.json({ success: true, salary });
  });

  app.post('/api/owner/advances', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const workerId = Number(req.body?.workerId);
    const amount = Number(req.body?.amount);
    const paymentMode = ['CASH', 'UPI', 'BANK'].includes(req.body?.paymentMode) ? req.body.paymentMode : 'CASH';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : todayYmd();
    const time = String(req.body?.time || nowTimeStr());
    const reason = String(req.body?.reason || 'Advance Payment').trim();

    const worker = db
      .prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?')
      .get(workerId, employerId) as WorkerRow | undefined;
    if (!worker || !(amount > 0)) {
      res.status(400).json({ error: 'Valid worker and positive advance amount are required.' });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO advances (worker_id, employer_id, site_id, amount, payment_mode, date, time, reason, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(workerId, employerId, worker.site_id, amount, paymentMode, date, time, reason, areq.currentUser!.id);

    const salary = calculateAndPersistSalary(db, workerId, date.slice(0, 7));

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'RECORD_ADVANCE',
      entityType: 'advances',
      entityId: Number(ins.lastInsertRowid),
      newValue: { amount, paymentMode, date, reason },
      reason,
    });

    notifyWorker(db, {
      workerId,
      employerId,
      type: 'ADVANCE',
      titleEn: `Advance Recorded: ₹${amount}`,
      titleHi: `अग्रिम दर्ज: ₹${amount}`,
      messageEn: `Advance of ₹${amount} via ${paymentMode} on ${date}. Reason: ${reason}`,
      messageHi: `${date} को ${paymentMode} से ₹${amount} अग्रिम (पेशगी) दर्ज हुआ। कारण: ${reason}`,
    });

    res.json({ success: true, salary });
  });

  app.post('/api/owner/bonuses', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const workerId = Number(req.body?.workerId);
    const amount = Number(req.body?.amount);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : todayYmd();
    const time = String(req.body?.time || nowTimeStr());
    const reason = String(req.body?.reason || '').trim();

    const worker = db.prepare('SELECT id FROM workers WHERE id = ? AND employer_id = ?').get(workerId, employerId);
    if (!worker || !(amount > 0) || !reason) {
      res.status(400).json({ error: 'Worker, positive bonus amount, and reason are required.' });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO bonuses (worker_id, employer_id, amount, date, time, reason, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(workerId, employerId, amount, date, time, reason, areq.currentUser!.id);

    const salary = calculateAndPersistSalary(db, workerId, date.slice(0, 7));

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'ADD_BONUS',
      entityType: 'bonuses',
      entityId: Number(ins.lastInsertRowid),
      newValue: { amount, date, reason },
      reason,
    });

    notifyWorker(db, {
      workerId,
      employerId,
      type: 'BONUS',
      titleEn: `Bonus Added: ₹${amount}`,
      titleHi: `बोनस जुड़ा: ₹${amount}`,
      messageEn: `₹${amount} bonus credited on ${date}. Reason: ${reason}`,
      messageHi: `${date} को ₹${amount} बोनस जोड़ा गया। कारण: ${reason}`,
    });

    res.json({ success: true, salary });
  });

  app.post('/api/owner/deductions', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const workerId = Number(req.body?.workerId);
    const amount = Number(req.body?.amount);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : todayYmd();
    const time = String(req.body?.time || nowTimeStr());
    const reason = String(req.body?.reason || '').trim();

    const worker = db.prepare('SELECT id FROM workers WHERE id = ? AND employer_id = ?').get(workerId, employerId);
    if (!worker || !(amount > 0) || !reason) {
      res.status(400).json({ error: 'Worker, positive deduction amount, and reason are required.' });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO deductions (worker_id, employer_id, amount, date, time, reason, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(workerId, employerId, amount, date, time, reason, areq.currentUser!.id);

    const salary = calculateAndPersistSalary(db, workerId, date.slice(0, 7));

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      workerId,
      action: 'ADD_DEDUCTION',
      entityType: 'deductions',
      entityId: Number(ins.lastInsertRowid),
      newValue: { amount, date, reason },
      reason,
    });

    notifyWorker(db, {
      workerId,
      employerId,
      type: 'DEDUCTION',
      titleEn: `Deduction Recorded: ₹${amount}`,
      titleHi: `कटौती दर्ज: ₹${amount}`,
      messageEn: `₹${amount} deducted on ${date}. Reason: ${reason}`,
      messageHi: `${date} को ₹${amount} कटौती दर्ज हुई। कारण: ${reason}`,
    });

    res.json({ success: true, salary });
  });

  app.post('/api/owner/expenses', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const siteId = req.body?.siteId ? Number(req.body.siteId) : null;
    const category = String(req.body?.category || 'Site Expense').trim();
    const amount = Number(req.body?.amount);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : todayYmd();
    const time = String(req.body?.time || nowTimeStr());
    const description = String(req.body?.description || '').trim();

    if (!(amount > 0) || !category) {
      res.status(400).json({ error: 'Category and positive amount are required.' });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO expenses (employer_id, site_id, category, amount, date, time, description, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(employerId, siteId, category, amount, date, time, description, areq.currentUser!.id);

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'OWNER',
      employerId,
      action: 'ADD_EXPENSE',
      entityType: 'expenses',
      entityId: Number(ins.lastInsertRowid),
      newValue: { category, amount, date, description },
    });

    res.json({ success: true });
  });

  // Approve / Reject Leave Request
  app.patch('/api/owner/leave-requests/:id', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const leaveId = Number(req.params.id);
    const status = req.body?.status === 'APPROVED' ? 'APPROVED' : req.body?.status === 'REJECTED' ? 'REJECTED' : null;
    const ownerNote = String(req.body?.ownerNote || '').trim();
    const markPaidLeave = Boolean(req.body?.markPaidLeave);

    if (!status) {
      res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
      return;
    }

    const leave = db
      .prepare('SELECT * FROM leave_requests WHERE id = ? AND employer_id = ?')
      .get(leaveId, employerId) as
      | { id: number; worker_id: number; from_date: string; to_date: string; reason: string }
      | undefined;

    if (!leave) {
      res.status(404).json({ error: 'Leave request not found.' });
      return;
    }

    db.prepare(
      "UPDATE leave_requests SET status = ?, owner_note = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, ownerNote, leaveId);

    if (status === 'APPROVED' && markPaidLeave) {
      const start = new Date(`${leave.from_date}T00:00:00Z`);
      const end = new Date(`${leave.to_date}T00:00:00Z`);
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const ymd = d.toISOString().slice(0, 10);
        try {
          upsertAttendanceRecord(areq, {
            workerId: leave.worker_id,
            date: ymd,
            status: 'PAID_LEAVE',
            editReason: 'Approved Paid Leave',
          });
        } catch {
          // Ignore individual day error
        }
      }
    }

    notifyWorker(db, {
      workerId: leave.worker_id,
      employerId,
      type: 'LEAVE',
      titleEn: `Leave Request ${status}`,
      titleHi: status === 'APPROVED' ? 'छुट्टी मंजूर हुई' : 'छुट्टी अस्वीकृत हुई',
      messageEn: `Your leave (${leave.from_date} to ${leave.to_date}) was ${status.toLowerCase()}. ${ownerNote}`,
      messageHi: `${leave.from_date} से ${leave.to_date} की छुट्टी ${status === 'APPROVED' ? 'मंजूर' : 'अस्वीकृत'} हुई। ${ownerNote}`,
    });

    res.json({ success: true });
  });

  // Unified Transaction History for Owner
  app.get('/api/owner/transactions', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : '';
    const workerId = req.query.workerId ? Number(req.query.workerId) : null;

    const likePattern = month ? `${month}%` : '%';
    const workerFilter = workerId ? ' AND t.worker_id = ? ' : '';
    const argsBase = workerId ? [employerId, likePattern, workerId] : [employerId, likePattern];

    const payments = db
      .prepare(
        `SELECT 'PAYMENT' as category, t.id, t.worker_id, w.name as worker_name, w.unique_worker_id,
                t.amount, t.payment_mode as mode, t.reference_no, t.date, t.time, t.description, t.created_at
         FROM payments t JOIN workers w ON t.worker_id = w.id
         WHERE t.employer_id = ? AND t.date LIKE ? ${workerFilter}`
      )
      .all(...argsBase);

    const advances = db
      .prepare(
        `SELECT 'ADVANCE' as category, t.id, t.worker_id, w.name as worker_name, w.unique_worker_id,
                t.amount, t.payment_mode as mode, '' as reference_no, t.date, t.time, t.reason as description, t.created_at
         FROM advances t JOIN workers w ON t.worker_id = w.id
         WHERE t.employer_id = ? AND t.date LIKE ? ${workerFilter}`
      )
      .all(...argsBase);

    const bonuses = db
      .prepare(
        `SELECT 'BONUS' as category, t.id, t.worker_id, w.name as worker_name, w.unique_worker_id,
                t.amount, 'ADJUSTMENT' as mode, '' as reference_no, t.date, t.time, t.reason as description, t.created_at
         FROM bonuses t JOIN workers w ON t.worker_id = w.id
         WHERE t.employer_id = ? AND t.date LIKE ? ${workerFilter}`
      )
      .all(...argsBase);

    const deductions = db
      .prepare(
        `SELECT 'DEDUCTION' as category, t.id, t.worker_id, w.name as worker_name, w.unique_worker_id,
                t.amount, 'ADJUSTMENT' as mode, '' as reference_no, t.date, t.time, t.reason as description, t.created_at
         FROM deductions t JOIN workers w ON t.worker_id = w.id
         WHERE t.employer_id = ? AND t.date LIKE ? ${workerFilter}`
      )
      .all(...argsBase);

    const expenses = workerId
      ? []
      : db
          .prepare(
            `SELECT 'EXPENSE' as category, t.id, NULL as worker_id, COALESCE(s.name, 'General Site') as worker_name,
                    t.category as unique_worker_id, t.amount, 'SITE' as mode, '' as reference_no,
                    t.date, t.time, t.description, t.created_at
             FROM expenses t LEFT JOIN work_sites s ON t.site_id = s.id
             WHERE t.employer_id = ? AND t.date LIKE ?`
          )
          .all(employerId, likePattern);

    const combined = [...payments, ...advances, ...bonuses, ...deductions, ...expenses].sort((a: any, b: any) => {
      const cmp = `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`);
      return cmp !== 0 ? cmp : b.id - a.id;
    });

    res.json({ transactions: combined });
  });

  // Daily / Weekly / Monthly Reports
  app.get('/api/owner/reports', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const period = ['daily', 'weekly', 'monthly'].includes(String(req.query.type)) ? String(req.query.type) : 'monthly';
    const refDate = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : todayYmd();
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : refDate.slice(0, 7);
    const siteId = req.query.siteId ? Number(req.query.siteId) : null;

    let startDate = `${month}-01`;
    let endDate = `${month}-31`;
    if (period === 'daily') {
      startDate = refDate;
      endDate = refDate;
    } else if (period === 'weekly') {
      const d = new Date(`${refDate}T00:00:00Z`);
      const s = new Date(d);
      s.setUTCDate(d.getUTCDate() - 6);
      startDate = s.toISOString().slice(0, 10);
      endDate = refDate;
    }

    const workers = db
      .prepare(
        `SELECT w.*, s.name as site_name
         FROM workers w LEFT JOIN work_sites s ON w.site_id = s.id
         WHERE w.employer_id = ? ${siteId ? 'AND w.site_id = ?' : ''}
         ORDER BY w.name ASC`
      )
      .all(...(siteId ? [employerId, siteId] : [employerId])) as Array<WorkerRow & { site_name: string | null }>;

    const rows = workers.map((w) => {
      const att = db
        .prepare(
          `SELECT status, hours_worked, overtime_hours FROM attendance
           WHERE worker_id = ? AND date >= ? AND date <= ?`
        )
        .all(w.id, startDate, endDate) as Array<{
        status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE';
        hours_worked: number;
        overtime_hours: number;
      }>;

      let present = 0;
      let half = 0;
      let paidLeave = 0;
      let absent = 0;
      let otHours = 0;
      let totalHours = 0;

      for (const a of att) {
        if (a.status === 'PRESENT') present++;
        else if (a.status === 'HALF_DAY') half++;
        else if (a.status === 'PAID_LEAVE') paidLeave++;
        else if (a.status === 'ABSENT') absent++;
        otHours += Number(a.overtime_hours || 0);
        totalHours += Number(a.hours_worked || 0);
      }

      const dailyRate = getEffectiveDailyWage(w);
      const attendanceEarnings = roundRupees((present + paidLeave + half * 0.5) * dailyRate);
      const otRate = w.overtime_rate > 0 ? w.overtime_rate : roundRupees(dailyRate / 8);
      const overtimeEarnings = roundRupees(otHours * otRate);

      const bonusTotal = Number(
        (
          db
            .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM bonuses WHERE worker_id = ? AND date >= ? AND date <= ?')
            .get(w.id, startDate, endDate) as { s: number }
        ).s
      );
      const deductionTotal = Number(
        (
          db
            .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM deductions WHERE worker_id = ? AND date >= ? AND date <= ?')
            .get(w.id, startDate, endDate) as { s: number }
        ).s
      );
      const advanceTotal = Number(
        (
          db
            .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM advances WHERE worker_id = ? AND date >= ? AND date <= ?')
            .get(w.id, startDate, endDate) as { s: number }
        ).s
      );
      const paidTotal = Number(
        (
          db
            .prepare('SELECT COALESCE(SUM(amount), 0) as s FROM payments WHERE worker_id = ? AND date >= ? AND date <= ?')
            .get(w.id, startDate, endDate) as { s: number }
        ).s
      );

      const totalSalary = roundRupees(attendanceEarnings + overtimeEarnings + bonusTotal - deductionTotal);
      const remainingBalance = roundRupees(totalSalary - advanceTotal - paidTotal);

      return {
        worker_id: w.id,
        unique_worker_id: w.unique_worker_id,
        name: w.name,
        mobile: w.mobile,
        site_name: w.site_name || 'Unassigned',
        skill_role: w.skill_role,
        daily_rate: dailyRate,
        present_days: present,
        half_days: half,
        paid_leave_days: paidLeave,
        absent_days: absent,
        total_hours: roundRupees(totalHours),
        overtime_hours: roundRupees(otHours),
        attendance_earnings: attendanceEarnings,
        overtime_earnings: overtimeEarnings,
        bonus_total: roundRupees(bonusTotal),
        deduction_total: roundRupees(deductionTotal),
        total_salary: totalSalary,
        advance_total: roundRupees(advanceTotal),
        paid_total: roundRupees(paidTotal),
        remaining_balance: remainingBalance,
      };
    });

    const siteExpenses = Number(
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(amount), 0) as s FROM expenses
             WHERE employer_id = ? AND date >= ? AND date <= ? ${siteId ? 'AND site_id = ?' : ''}`
          )
          .get(...(siteId ? [employerId, startDate, endDate, siteId] : [employerId, startDate, endDate])) as { s: number }
      ).s
    );

    res.json({
      period,
      startDate,
      endDate,
      rows,
      siteExpenses: roundRupees(siteExpenses),
    });
  });

  // Backup & Restore (Owner Organization Data)
  app.get('/api/owner/backup/export', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;

    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'MAJDOOR MITRA',
      version: 1,
      employer: areq.employer,
      work_sites: db.prepare('SELECT * FROM work_sites WHERE employer_id = ?').all(employerId),
      workers: db.prepare('SELECT * FROM workers WHERE employer_id = ?').all(employerId),
      attendance: db.prepare('SELECT * FROM attendance WHERE employer_id = ?').all(employerId),
      payments: db.prepare('SELECT * FROM payments WHERE employer_id = ?').all(employerId),
      advances: db.prepare('SELECT * FROM advances WHERE employer_id = ?').all(employerId),
      bonuses: db.prepare('SELECT * FROM bonuses WHERE employer_id = ?').all(employerId),
      deductions: db.prepare('SELECT * FROM deductions WHERE employer_id = ?').all(employerId),
      expenses: db.prepare('SELECT * FROM expenses WHERE employer_id = ?').all(employerId),
      leave_requests: db.prepare('SELECT * FROM leave_requests WHERE employer_id = ?').all(employerId),
    };

    res.json(payload);
  });

  app.post('/api/owner/backup/restore', requireAuth as never, requireRole('OWNER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const employerId = areq.employer!.id;
    const backup = req.body;

    if (!backup || backup.app !== 'MAJDOOR MITRA' || !Array.isArray(backup.workers)) {
      res.status(400).json({ error: 'Invalid MAJDOOR MITRA backup file.' });
      return;
    }

    const tx = db.transaction(() => {
      const siteIdMap = new Map<number, number>();
      const workerIdMap = new Map<number, number>();

      if (Array.isArray(backup.work_sites)) {
        for (const s of backup.work_sites) {
          const existingSite = db
            .prepare('SELECT id FROM work_sites WHERE employer_id = ? AND name = ?')
            .get(employerId, s.name) as { id: number } | undefined;
          if (existingSite) {
            siteIdMap.set(s.id, existingSite.id);
          } else {
            const ins = db
              .prepare(
                'INSERT INTO work_sites (employer_id, name, location, latitude, longitude, radius_meters, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
              )
              .run(employerId, s.name, s.location || '', s.latitude ?? null, s.longitude ?? null, s.radius_meters || 500, s.status || 'ACTIVE');
            siteIdMap.set(s.id, Number(ins.lastInsertRowid));
          }
        }
      }

      for (const w of backup.workers) {
        const existingWorker = db
          .prepare('SELECT id FROM workers WHERE employer_id = ? AND mobile = ?')
          .get(employerId, w.mobile) as { id: number } | undefined;
        const mappedSiteId = w.site_id ? siteIdMap.get(w.site_id) ?? null : null;
        if (existingWorker) {
          workerIdMap.set(w.id, existingWorker.id);
        } else {
          const uniqueId = `${w.unique_worker_id || 'MM'}-${crypto.randomInt(100, 999)}`;
          const ins = db
            .prepare(
              `INSERT INTO workers (unique_worker_id, employer_id, site_id, name, mobile, photo_url, skill_role, wage_type, daily_wage, monthly_salary, overtime_rate, status, joined_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              uniqueId,
              employerId,
              mappedSiteId,
              w.name,
              w.mobile,
              w.photo_url || '',
              w.skill_role || 'General Worker',
              w.wage_type || 'DAILY',
              w.daily_wage || 500,
              w.monthly_salary || 0,
              w.overtime_rate || 75,
              w.status || 'ACTIVE',
              w.joined_at || todayYmd()
            );
          workerIdMap.set(w.id, Number(ins.lastInsertRowid));
        }
      }

      if (Array.isArray(backup.attendance)) {
        for (const a of backup.attendance) {
          const newWid = workerIdMap.get(a.worker_id);
          if (!newWid) continue;
          db.prepare(
            `INSERT OR IGNORE INTO attendance (worker_id, employer_id, site_id, date, status, hours_worked, overtime_hours, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(newWid, employerId, a.site_id ? siteIdMap.get(a.site_id) ?? null : null, a.date, a.status, a.hours_worked, a.overtime_hours || 0, a.notes || '');
        }
      }

      if (Array.isArray(backup.payments)) {
        for (const p of backup.payments) {
          const newWid = workerIdMap.get(p.worker_id);
          if (!newWid) continue;
          db.prepare(
            'INSERT INTO payments (worker_id, employer_id, site_id, amount, payment_mode, reference_no, date, time, description, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(newWid, employerId, null, p.amount, p.payment_mode || 'CASH', p.reference_no || '', p.date, p.time || '12:00', p.description || '', areq.currentUser!.id);
        }
      }

      if (Array.isArray(backup.advances)) {
        for (const adv of backup.advances) {
          const newWid = workerIdMap.get(adv.worker_id);
          if (!newWid) continue;
          db.prepare(
            'INSERT INTO advances (worker_id, employer_id, site_id, amount, payment_mode, date, time, reason, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(newWid, employerId, null, adv.amount, adv.payment_mode || 'CASH', adv.date, adv.time || '12:00', adv.reason || '', areq.currentUser!.id);
        }
      }

      for (const newWid of workerIdMap.values()) {
        calculateAndPersistSalary(db, newWid, currentMonthYm());
      }
    });

    tx();
    res.json({ success: true });
  });

  // --------------------------------------------------------------------------
  // WORKER ROUTES (Strictly read-only on attendance/payments; own records only)
  // --------------------------------------------------------------------------
  app.get('/api/worker/dashboard', requireAuth as never, requireRole('WORKER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : currentMonthYm();
    const requestedWorkerId = req.query.workerId ? Number(req.query.workerId) : null;

    // Auto-link any worker rows matching this user's mobile
    db.prepare('UPDATE workers SET user_id = ? WHERE mobile = ? AND (user_id IS NULL OR user_id != ?)').run(
      areq.currentUser!.id,
      areq.currentUser!.mobile,
      areq.currentUser!.id
    );

    const profiles = db
      .prepare(
        `SELECT w.*, e.business_name, e.owner_name, e.mobile as employer_mobile, e.address as employer_address,
                s.name as site_name, s.location as site_location, s.latitude as site_lat, s.longitude as site_lng, s.radius_meters as site_radius
         FROM workers w
         JOIN employers e ON w.employer_id = e.id
         LEFT JOIN work_sites s ON w.site_id = s.id
         WHERE w.user_id = ? OR w.mobile = ?
         ORDER BY w.id ASC`
      )
      .all(areq.currentUser!.id, areq.currentUser!.mobile) as Array<
      WorkerRow & {
        business_name: string;
        owner_name: string;
        employer_mobile: string;
        employer_address: string;
        site_name: string | null;
        site_location: string | null;
        site_lat: number | null;
        site_lng: number | null;
        site_radius: number | null;
      }
    >;

    if (profiles.length === 0) {
      res.json({
        user: areq.currentUser,
        month,
        profiles: [],
        selectedProfile: null,
        salary: null,
        allTimeBalance: null,
        attendance: [],
        payments: [],
        advances: [],
        bonuses: [],
        deductions: [],
        transactions: [],
        leaveRequests: [],
        notifications: [],
      });
      return;
    }

    const selected = (requestedWorkerId ? profiles.find((p) => p.id === requestedWorkerId) : null) || profiles[0];
    const salary = calculateAndPersistSalary(db, selected.id, month);
    const allTimeBalance = getWorkerAllTimeBalance(db, selected.id);

    const attendance = db
      .prepare('SELECT * FROM attendance WHERE worker_id = ? AND date LIKE ? ORDER BY date DESC')
      .all(selected.id, `${month}%`);

    const payments = db
      .prepare('SELECT * FROM payments WHERE worker_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
      .all(selected.id, `${month}%`);

    const advances = db
      .prepare('SELECT * FROM advances WHERE worker_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
      .all(selected.id, `${month}%`);

    const bonuses = db
      .prepare('SELECT * FROM bonuses WHERE worker_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
      .all(selected.id, `${month}%`);

    const deductions = db
      .prepare('SELECT * FROM deductions WHERE worker_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
      .all(selected.id, `${month}%`);

    const transactions = [
      ...payments.map((p: any) => ({ ...p, category: 'PAYMENT', description: p.description || 'Salary Payment' })),
      ...advances.map((a: any) => ({ ...a, category: 'ADVANCE', description: a.reason || 'Advance' })),
      ...bonuses.map((b: any) => ({ ...b, category: 'BONUS', payment_mode: 'ADJUSTMENT', description: b.reason })),
      ...deductions.map((d: any) => ({ ...d, category: 'DEDUCTION', payment_mode: 'ADJUSTMENT', description: d.reason })),
    ].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

    const leaveRequests = db
      .prepare('SELECT * FROM leave_requests WHERE worker_id = ? ORDER BY id DESC')
      .all(selected.id);

    const notifications = db
      .prepare(
        `SELECT * FROM notifications
         WHERE worker_id IN (${profiles.map(() => '?').join(',')}) OR recipient_user_id = ?
         ORDER BY id DESC LIMIT 50`
      )
      .all(...profiles.map((p) => p.id), areq.currentUser!.id);

    res.json({
      user: areq.currentUser,
      month,
      profiles: profiles.map((p) => ({
        ...p,
        effective_daily_wage: getEffectiveDailyWage(p),
      })),
      selectedProfile: {
        ...selected,
        effective_daily_wage: getEffectiveDailyWage(selected),
      },
      salary,
      allTimeBalance,
      attendance,
      payments,
      advances,
      bonuses,
      deductions,
      transactions,
      leaveRequests,
      notifications,
    });
  });

  app.post('/api/worker/leave-requests', requireAuth as never, requireRole('WORKER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const workerId = Number(req.body?.workerId);
    const fromDate = String(req.body?.fromDate || '').trim();
    const toDate = String(req.body?.toDate || '').trim();
    const reason = String(req.body?.reason || '').trim();

    const worker = db
      .prepare('SELECT * FROM workers WHERE id = ? AND (user_id = ? OR mobile = ?)')
      .get(workerId, areq.currentUser!.id, areq.currentUser!.mobile) as WorkerRow | undefined;

    if (!worker || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || !reason) {
      res.status(400).json({ error: 'Valid worker profile, dates, and reason are required.' });
      return;
    }

    const ins = db
      .prepare(
        'INSERT INTO leave_requests (worker_id, employer_id, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)'
      )
      .run(worker.id, worker.employer_id, fromDate, toDate, reason);

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'WORKER',
      employerId: worker.employer_id,
      workerId: worker.id,
      action: 'SUBMIT_LEAVE_REQUEST',
      entityType: 'leave_requests',
      entityId: Number(ins.lastInsertRowid),
      newValue: { fromDate, toDate, reason },
    });

    res.json({ success: true });
  });

  app.post('/api/worker/notifications/read', requireAuth as never, requireRole('WORKER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const workerIds = db
      .prepare('SELECT id FROM workers WHERE user_id = ? OR mobile = ?')
      .all(areq.currentUser!.id, areq.currentUser!.mobile) as Array<{ id: number }>;

    for (const w of workerIds) {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE worker_id = ?').run(w.id);
    }
    db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_user_id = ?').run(areq.currentUser!.id);
    res.json({ success: true });
  });

  // GPS Check-in for Workers (Cannot overwrite employer-approved records!)
  app.post('/api/worker/gps-checkin', requireAuth as never, requireRole('WORKER') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const workerId = Number(req.body?.workerId);
    const lat = Number(req.body?.latitude);
    const lng = Number(req.body?.longitude);
    const date = todayYmd();

    const worker = db
      .prepare('SELECT * FROM workers WHERE id = ? AND (user_id = ? OR mobile = ?)')
      .get(workerId, areq.currentUser!.id, areq.currentUser!.mobile) as WorkerRow | undefined;

    if (!worker || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: 'Authorized worker profile and GPS coordinates are required.' });
      return;
    }

    // Security rule: Worker cannot modify existing employer-approved attendance!
    const existing = db.prepare('SELECT * FROM attendance WHERE worker_id = ? AND date = ?').get(worker.id, date);
    if (existing) {
      res.status(403).json({
        error: 'Attendance for today is already recorded/approved by your employer and cannot be modified by worker.',
      });
      return;
    }

    let gpsVerified = 1;
    let distanceMeters: number | null = null;
    if (worker.site_id) {
      const site = db.prepare('SELECT latitude, longitude, radius_meters FROM work_sites WHERE id = ?').get(worker.site_id) as
        | { latitude: number | null; longitude: number | null; radius_meters: number }
        | undefined;
      if (site?.latitude != null && site?.longitude != null) {
        distanceMeters = Math.round(haversineMeters(lat, lng, site.latitude, site.longitude));
        gpsVerified = distanceMeters <= (site.radius_meters || 500) ? 1 : 0;
      }
    }

    if (!gpsVerified) {
      res.status(400).json({
        error: `You are ${distanceMeters}m away from the work site geofence. Please check in from the work site.`,
      });
      return;
    }

    const ins = db
      .prepare(
        `INSERT INTO attendance (
          worker_id, employer_id, site_id, date, status, hours_worked, overtime_hours,
          gps_lat, gps_lng, gps_verified, marked_by_user_id, notes
        ) VALUES (?, ?, ?, ?, 'PRESENT', 8, 0, ?, ?, 1, ?, ?)`
      )
      .run(worker.id, worker.employer_id, worker.site_id, date, lat, lng, areq.currentUser!.id, `GPS Check-in at ${nowTimeStr()}`);

    const salary = calculateAndPersistSalary(db, worker.id, date.slice(0, 7));

    writeAuditLog(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      actorRole: 'WORKER',
      employerId: worker.employer_id,
      workerId: worker.id,
      action: 'GPS_CHECKIN',
      entityType: 'attendance',
      entityId: Number(ins.lastInsertRowid),
      newValue: { date, lat, lng, distanceMeters },
    });

    res.json({ success: true, distanceMeters, salary });
  });

  // --------------------------------------------------------------------------
  // OFFLINE SYNC BATCH ENDPOINT
  // --------------------------------------------------------------------------
  app.post('/api/sync/batch', requireAuth as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb(areq.dbMode);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const results: Array<{ clientId: string; ok: boolean; error?: string }> = [];

    for (const item of items) {
      try {
        if (areq.currentUser!.role === 'OWNER' && areq.employer) {
          if (item.type === 'ATTENDANCE') {
            upsertAttendanceRecord(areq, item.payload);
          } else if (item.type === 'PAYMENT') {
            const p = item.payload;
            const w = db.prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?').get(Number(p.workerId), areq.employer.id) as WorkerRow | undefined;
            if (!w) throw new Error('Worker not found');
            db.prepare(
              'INSERT INTO payments (worker_id, employer_id, site_id, amount, payment_mode, reference_no, date, time, description, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(w.id, areq.employer.id, w.site_id, Number(p.amount), p.paymentMode || 'CASH', p.referenceNo || '', p.date || todayYmd(), p.time || nowTimeStr(), p.description || 'Offline Payment', areq.currentUser!.id);
            calculateAndPersistSalary(db, w.id, String(p.date || todayYmd()).slice(0, 7));
          } else if (item.type === 'ADVANCE') {
            const a = item.payload;
            const w = db.prepare('SELECT * FROM workers WHERE id = ? AND employer_id = ?').get(Number(a.workerId), areq.employer.id) as WorkerRow | undefined;
            if (!w) throw new Error('Worker not found');
            db.prepare(
              'INSERT INTO advances (worker_id, employer_id, site_id, amount, payment_mode, date, time, reason, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(w.id, areq.employer.id, w.site_id, Number(a.amount), a.paymentMode || 'CASH', a.date || todayYmd(), a.time || nowTimeStr(), a.reason || 'Offline Advance', areq.currentUser!.id);
            calculateAndPersistSalary(db, w.id, String(a.date || todayYmd()).slice(0, 7));
          } else if (item.type === 'EXPENSE') {
            const ex = item.payload;
            db.prepare(
              'INSERT INTO expenses (employer_id, site_id, category, amount, date, time, description, recorded_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            ).run(areq.employer.id, ex.siteId ? Number(ex.siteId) : null, ex.category || 'Site Expense', Number(ex.amount), ex.date || todayYmd(), ex.time || nowTimeStr(), ex.description || '', areq.currentUser!.id);
          }
          results.push({ clientId: item.clientId, ok: true });
        } else if (areq.currentUser!.role === 'WORKER' && item.type === 'LEAVE_REQUEST') {
          const lr = item.payload;
          const w = db.prepare('SELECT * FROM workers WHERE id = ? AND (user_id = ? OR mobile = ?)').get(Number(lr.workerId), areq.currentUser!.id, areq.currentUser!.mobile) as WorkerRow | undefined;
          if (!w) throw new Error('Unauthorized worker');
          db.prepare('INSERT INTO leave_requests (worker_id, employer_id, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)').run(w.id, w.employer_id, lr.fromDate, lr.toDate, lr.reason);
          results.push({ clientId: item.clientId, ok: true });
        } else {
          results.push({ clientId: item.clientId, ok: false, error: 'Forbidden action for role' });
        }
      } catch (err: unknown) {
        results.push({ clientId: item.clientId, ok: false, error: err instanceof Error ? err.message : 'Sync failed' });
      }
    }

    res.json({ success: true, results });
  });

  // --------------------------------------------------------------------------
  // SUPER ADMIN / FOUNDER CONTROL ROUTES (Strictly guarded for Founder Raja)
  // --------------------------------------------------------------------------
  app.get('/api/super-admin/overview', requireAuth as never, requireRole('SUPER_ADMIN') as never, (_req, res) => {
    const db = getDb('prod');
    const settings = parseAppSettings(db);

    const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'SUPER_ADMIN'").get() as { c: number }).c;
    const totalOwners = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'").get() as { c: number }).c;
    const totalWorkersUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'WORKER'").get() as { c: number }).c;
    const activeUsers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'SUPER_ADMIN' AND account_status = 'ACTIVE'").get() as { c: number }
    ).c;
    const suspendedUsers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'SUPER_ADMIN' AND account_status = 'SUSPENDED'").get() as { c: number }
    ).c;
    const deactivatedUsers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'SUPER_ADMIN' AND account_status = 'DEACTIVATED'").get() as { c: number }
    ).c;

    const totalWorkerProfiles = (db.prepare('SELECT COUNT(*) as c FROM workers').get() as { c: number }).c;
    const activeWorkerProfiles = (db.prepare("SELECT COUNT(*) as c FROM workers WHERE status = 'ACTIVE'").get() as { c: number }).c;
    const totalSites = (db.prepare('SELECT COUNT(*) as c FROM work_sites').get() as { c: number }).c;
    const totalAttendance = (db.prepare('SELECT COUNT(*) as c FROM attendance').get() as { c: number }).c;
    const totalPaid = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM payments').get() as { s: number }).s;
    const totalAdvances = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM advances').get() as { s: number }).s;

    const planCountsRaw = db
      .prepare('SELECT subscription_plan, COUNT(*) as c FROM employers GROUP BY subscription_plan')
      .all() as Array<{ subscription_plan: string; c: number }>;
    const subscriptionBreakdown = { FREE: 0, PRO: 0, ENTERPRISE: 0 };
    for (const row of planCountsRaw) {
      if (row.subscription_plan === 'FREE' || row.subscription_plan === 'PRO' || row.subscription_plan === 'ENTERPRISE') {
        subscriptionBreakdown[row.subscription_plan] = row.c;
      }
    }

    const recentAuditLogs = db
      .prepare('SELECT * FROM super_admin_audit_logs ORDER BY id DESC LIMIT 30')
      .all();

    res.json({
      stats: {
        totalUsers,
        totalOwners,
        totalWorkersUsers,
        activeUsers,
        suspendedUsers,
        deactivatedUsers,
        totalWorkerProfiles,
        activeWorkerProfiles,
        totalSites,
        totalAttendance,
        totalPaid: roundRupees(totalPaid),
        totalAdvances: roundRupees(totalAdvances),
        subscriptionBreakdown,
      },
      appSettings: settings,
      recentAuditLogs,
    });
  });

  app.get('/api/super-admin/users', requireAuth as never, requireRole('SUPER_ADMIN') as never, (_req, res) => {
    const db = getDb('prod');
    const users = db
      .prepare(
        `SELECT u.id, u.mobile, u.name, u.role, u.language, u.email, u.account_status, u.status_reason, u.is_founder, u.created_at,
                e.id as employer_id, e.business_name, e.address as employer_address,
                e.account_status as employer_status, e.subscription_plan, e.subscription_expires_at, e.max_workers,
                (SELECT COUNT(*) FROM workers w WHERE w.employer_id = e.id) as managed_workers_count,
                (SELECT COUNT(*) FROM work_sites s WHERE s.employer_id = e.id) as sites_count,
                (SELECT COUNT(*) FROM workers w2 WHERE w2.user_id = u.id OR (u.role = 'WORKER' AND w2.mobile = u.mobile)) as linked_jobs_count
         FROM users u
         LEFT JOIN employers e ON e.user_id = u.id
         WHERE u.role != 'SUPER_ADMIN'
         ORDER BY u.id DESC`
      )
      .all();
    res.json({ users });
  });

  app.get('/api/super-admin/workers', requireAuth as never, requireRole('SUPER_ADMIN') as never, (_req, res) => {
    const db = getDb('prod');
    const workers = db
      .prepare(
        `SELECT w.*, e.business_name, e.owner_name, e.mobile as employer_mobile, s.name as site_name
         FROM workers w
         JOIN employers e ON w.employer_id = e.id
         LEFT JOIN work_sites s ON w.site_id = s.id
         ORDER BY w.id DESC`
      )
      .all();
    res.json({ workers });
  });

  app.patch('/api/super-admin/users/:id/status', requireAuth as never, requireRole('SUPER_ADMIN') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb('prod');
    const targetId = Number(req.params.id);
    const status = String(req.body?.status || '').toUpperCase() as ServerAccountStatus;
    const reason = String(req.body?.reason || '').trim();

    if (!['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status)) {
      res.status(400).json({ error: 'Invalid account status. Must be ACTIVE, SUSPENDED, or DEACTIVATED.' });
      return;
    }

    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as AuthedRequest['currentUser'] | undefined;
    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }
    if (target.role === 'SUPER_ADMIN' || target.is_founder === 1) {
      res.status(403).json({ error: 'Forbidden: Founder Super Admin account cannot be suspended or deactivated.' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET account_status = ?, status_reason = ? WHERE id = ?').run(status, reason, targetId);
      if (target.role === 'OWNER') {
        db.prepare('UPDATE employers SET account_status = ? WHERE user_id = ?').run(status, targetId);
      }
      writeSuperAdminAudit(db, {
        actorUserId: areq.currentUser!.id,
        actorName: areq.currentUser!.name,
        action: `USER_STATUS_${status}`,
        targetType: 'users',
        targetId,
        details: { previousStatus: target.account_status, newStatus: status, role: target.role, mobile: target.mobile },
        reason,
      });
    });
    tx();

    res.json({ success: true });
  });

  app.delete('/api/super-admin/users/:id', requireAuth as never, requireRole('SUPER_ADMIN') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb('prod');
    const targetId = Number(req.params.id);

    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as AuthedRequest['currentUser'] | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.role === 'SUPER_ADMIN' || target.is_founder === 1) {
      res.status(403).json({ error: 'Forbidden: Founder Super Admin account cannot be deleted.' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    writeSuperAdminAudit(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      action: 'DELETE_USER',
      targetType: 'users',
      targetId,
      details: { name: target.name, mobile: target.mobile, role: target.role },
    });

    res.json({ success: true });
  });

  app.patch('/api/super-admin/employers/:id/subscription', requireAuth as never, requireRole('SUPER_ADMIN') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb('prod');
    const employerId = Number(req.params.id);
    const plan = String(req.body?.subscriptionPlan || '').toUpperCase() as ServerSubscriptionPlan;
    const maxWorkers = Number(req.body?.maxWorkers);
    const expiresAt = typeof req.body?.expiresAt === 'string' ? req.body.expiresAt.trim() : '';

    if (!['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
      res.status(400).json({ error: 'Invalid subscription plan. Must be FREE, PRO, or ENTERPRISE.' });
      return;
    }

    const emp = db.prepare('SELECT * FROM employers WHERE id = ?').get(employerId) as AuthedRequest['employer'] | undefined;
    if (!emp) {
      res.status(404).json({ error: 'Employer not found.' });
      return;
    }

    const settings = parseAppSettings(db);
    const resolvedMaxWorkers =
      Number.isFinite(maxWorkers) && maxWorkers > 0
        ? Math.floor(maxWorkers)
        : plan === 'ENTERPRISE'
        ? 5000
        : plan === 'PRO'
        ? settings.proPlanWorkerLimit
        : settings.freePlanWorkerLimit;

    db.prepare(
      'UPDATE employers SET subscription_plan = ?, max_workers = ?, subscription_expires_at = ? WHERE id = ?'
    ).run(plan, resolvedMaxWorkers, expiresAt, employerId);

    writeSuperAdminAudit(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      action: 'UPDATE_SUBSCRIPTION',
      targetType: 'employers',
      targetId: employerId,
      details: {
        businessName: emp.business_name,
        oldPlan: emp.subscription_plan,
        newPlan: plan,
        maxWorkers: resolvedMaxWorkers,
        expiresAt,
      },
    });

    res.json({ success: true });
  });

  app.patch('/api/super-admin/workers/:id/status', requireAuth as never, requireRole('SUPER_ADMIN') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb('prod');
    const workerId = Number(req.params.id);
    const status = req.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId) as WorkerRow | undefined;
    if (!worker) {
      res.status(404).json({ error: 'Worker profile not found.' });
      return;
    }

    db.prepare('UPDATE workers SET status = ? WHERE id = ?').run(status, workerId);
    writeSuperAdminAudit(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      action: `WORKER_PROFILE_${status}`,
      targetType: 'workers',
      targetId: workerId,
      details: { name: worker.name, mobile: worker.mobile },
    });

    res.json({ success: true });
  });

  app.get('/api/super-admin/settings', requireAuth as never, requireRole('SUPER_ADMIN') as never, (_req, res) => {
    const db = getDb('prod');
    res.json(parseAppSettings(db));
  });

  app.patch('/api/super-admin/settings', requireAuth as never, requireRole('SUPER_ADMIN') as never, (req, res) => {
    const areq = req as AuthedRequest;
    const db = getDb('prod');
    const current = parseAppSettings(db);

    const maintenanceMode = req.body?.maintenanceMode !== undefined ? (req.body.maintenanceMode ? 1 : 0) : current.maintenanceMode ? 1 : 0;
    const registrationEnabled =
      req.body?.registrationEnabled !== undefined ? (req.body.registrationEnabled ? 1 : 0) : current.registrationEnabled ? 1 : 0;
    const freePlanWorkerLimit =
      Number(req.body?.freePlanWorkerLimit) > 0 ? Math.floor(Number(req.body.freePlanWorkerLimit)) : current.freePlanWorkerLimit;
    const proPlanWorkerLimit =
      Number(req.body?.proPlanWorkerLimit) > 0 ? Math.floor(Number(req.body.proPlanWorkerLimit)) : current.proPlanWorkerLimit;
    const proPlanPriceInr =
      Number(req.body?.proPlanPriceInr) >= 0 ? Math.floor(Number(req.body.proPlanPriceInr)) : current.proPlanPriceInr;
    const enterprisePlanPriceInr =
      Number(req.body?.enterprisePlanPriceInr) >= 0
        ? Math.floor(Number(req.body.enterprisePlanPriceInr))
        : current.enterprisePlanPriceInr;
    const supportContact =
      typeof req.body?.supportContact === 'string' ? req.body.supportContact.trim() : current.supportContact;
    const announcementBanner =
      typeof req.body?.announcementBanner === 'string' ? req.body.announcementBanner.trim() : current.announcementBanner;

    const incomingFeatures = req.body?.premiumFeatures && typeof req.body.premiumFeatures === 'object'
      ? { ...current.premiumFeatures, ...req.body.premiumFeatures }
      : current.premiumFeatures;

    db.prepare(
      `UPDATE app_settings
       SET maintenance_mode = ?, registration_enabled = ?, free_plan_worker_limit = ?,
           pro_plan_worker_limit = ?, pro_plan_price_inr = ?, enterprise_plan_price_inr = ?,
           premium_features_json = ?, support_contact = ?, announcement_banner = ?, updated_at = datetime('now')
       WHERE id = 1`
    ).run(
      maintenanceMode,
      registrationEnabled,
      freePlanWorkerLimit,
      proPlanWorkerLimit,
      proPlanPriceInr,
      enterprisePlanPriceInr,
      JSON.stringify(incomingFeatures),
      supportContact,
      announcementBanner
    );

    writeSuperAdminAudit(db, {
      actorUserId: areq.currentUser!.id,
      actorName: areq.currentUser!.name,
      action: 'UPDATE_APP_SETTINGS',
      targetType: 'app_settings',
      targetId: 1,
      details: { maintenanceMode: Boolean(maintenanceMode), registrationEnabled: Boolean(registrationEnabled), freePlanWorkerLimit, proPlanPriceInr },
    });

    res.json({ success: true, settings: parseAppSettings(db) });
  });

  const httpServer = http.createServer(app);

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`MAJDOOR MITRA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
