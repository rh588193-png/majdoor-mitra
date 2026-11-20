import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getDb, type DbMode } from './db.ts';

const SECRET = process.env.SESSION_SECRET || 'majdoor-mitra-hmac-secret-2026';

export type ServerUserRole = 'WORKER' | 'OWNER' | 'SUPER_ADMIN';
export type ServerAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type ServerSubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface SessionPayload {
  userId: number;
  mobile: string;
  role: ServerUserRole;
  mode: DbMode;
  exp: number;
}

export interface AuthedRequest extends Request {
  session?: SessionPayload;
  dbMode?: DbMode;
  currentUser?: {
    id: number;
    mobile: string;
    name: string;
    role: ServerUserRole;
    language: 'hi' | 'en';
    theme: 'light' | 'dark';
    avatar_url: string;
    email: string;
    account_status: ServerAccountStatus;
    status_reason: string;
    is_founder: number;
  };
  employer?: {
    id: number;
    user_id: number;
    business_name: string;
    owner_name: string;
    mobile: string;
    address: string;
    account_status: ServerAccountStatus;
    subscription_plan: ServerSubscriptionPlan;
    subscription_expires_at: string;
    max_workers: number;
  };
}

export function hashOtp(otp: string, mobile: string): string {
  return crypto.createHmac('sha256', SECRET).update(`${mobile}:${otp}`).digest('hex');
}

export function hashPasskey(passkey: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passkey, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasskey(passkey: string, storedHash: string): boolean {
  if (!passkey || !storedHash || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(passkey, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr, 'utf8');
  const b = Buffer.from(bStr, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signSession(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expected = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed || !parsed.userId || !parsed.role || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies['mm_session'] || '';
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  // Super Admin sessions are strictly only allowed on production DB
  if (session.role === 'SUPER_ADMIN' && session.mode !== 'prod') {
    res.status(403).json({ error: 'Forbidden: Super Admin is unavailable in demo mode.' });
    return;
  }

  const db = getDb(session.mode);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as
    | AuthedRequest['currentUser']
    | undefined;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized: Account not found' });
    return;
  }

  if (user.role !== session.role) {
    res.status(403).json({ error: 'Forbidden: Session role mismatch' });
    return;
  }

  if (user.role === 'SUPER_ADMIN' && user.is_founder !== 1) {
    res.status(403).json({ error: 'Forbidden: Founder verification required' });
    return;
  }

  if (user.role !== 'SUPER_ADMIN' && user.account_status && user.account_status !== 'ACTIVE') {
    res.status(403).json({
      error: `Account ${user.account_status.toLowerCase()}${user.status_reason ? `: ${user.status_reason}` : '. Contact Super Admin.'}`,
      code: `ACCOUNT_${user.account_status}`,
    });
    return;
  }

  req.session = session;
  req.dbMode = session.mode;
  req.currentUser = user;

  if (user.role === 'OWNER') {
    const employer = db.prepare('SELECT * FROM employers WHERE user_id = ?').get(user.id) as
      | AuthedRequest['employer']
      | undefined;
    if (!employer) {
      res.status(403).json({ error: 'Employer profile missing' });
      return;
    }
    if (employer.account_status && employer.account_status !== 'ACTIVE') {
      res.status(403).json({
        error: `Employer account ${employer.account_status.toLowerCase()}. Contact Super Admin.`,
        code: `ACCOUNT_${employer.account_status}`,
      });
      return;
    }
    req.employer = employer;
  }

  next();
}

export function requireRole(...roles: ServerUserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.currentUser || !roles.includes(req.currentUser.role)) {
      res.status(403).json({ error: `Forbidden: Requires ${roles.join(' or ')} role` });
      return;
    }
    if (roles.includes('SUPER_ADMIN') && req.currentUser.role === 'SUPER_ADMIN' && req.currentUser.is_founder !== 1) {
      res.status(403).json({ error: 'Forbidden: Strictly restricted to Founder' });
      return;
    }
    next();
  };
}
