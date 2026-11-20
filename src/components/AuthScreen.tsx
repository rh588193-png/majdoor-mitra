import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  HardHat,
  KeyRound,
  Languages,
  Lock,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { t } from '../i18n';
import type { AppSettings, DbMode, Language, ThemeMode, UserProfile } from '../types';
import { apiFetch, setAuthToken } from '../utils/api';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  lang: Language;
  theme: ThemeMode;
  appSettings: AppSettings | null;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile, mode: DbMode) => void;
}

export const AuthScreen: React.FC<Props> = ({
  lang,
  theme,
  appSettings,
  onToggleLang,
  onToggleTheme,
  onAuthenticated,
}) => {
  const [role, setRole] = useState<'WORKER' | 'OWNER'>('WORKER');
  const [step, setStep] = useState<'MOBILE' | 'OTP'>('MOBILE');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [isRegistered, setIsRegistered] = useState(true);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Founder Portal Modal State
  const [founderOpen, setFounderOpen] = useState(false);
  const [founderStatus, setFounderStatus] = useState<{
    configured: boolean;
    requiresSetupSecret: boolean;
    founderName: string;
    founderEmail: string;
  } | null>(null);
  const [founderStep, setFounderStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [founderMobile, setFounderMobile] = useState('');
  const [founderPasskey, setFounderPasskey] = useState('');
  const [founderEmail, setFounderEmail] = useState('rh588193@gmail.com');
  const [founderSetupSecret, setFounderSetupSecret] = useState('');
  const [founderOtp, setFounderOtp] = useState('');
  const [founderOtpHint, setFounderOtpHint] = useState('');
  const [founderError, setFounderError] = useState('');
  const [founderLoading, setFounderLoading] = useState(false);

  useEffect(() => {
    if (!founderOpen) return;
    let active = true;
    (async () => {
      try {
        const res = await apiFetch<{
          configured: boolean;
          requiresSetupSecret: boolean;
          founderName: string;
          founderEmail: string;
        }>('/api/auth/founder/status');
        if (!active) return;
        setFounderStatus(res);
        if (res.founderEmail) setFounderEmail(res.founderEmail);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [founderOpen]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        isRegistered: boolean;
        existingName: string;
        verificationOtp?: string;
      }>('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile, role }),
      });
      setIsRegistered(res.isRegistered);
      if (res.existingName) setName(res.existingName);
      setDevOtpHint(res.verificationOtp || '');
      setStep('OTP');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        token: string;
        user: UserProfile;
        mode: DbMode;
      }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          mobile,
          role,
          otp,
          name,
          businessName,
          address,
          language: lang,
        }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.mode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoRole: 'WORKER' | 'OWNER') => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        token: string;
        user: UserProfile;
        mode: DbMode;
      }>('/api/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role: demoRole }),
      });
      setAuthToken(res.token);
      onAuthenticated(res.user, res.mode);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFounderCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFounderError('');
    setFounderLoading(true);
    try {
      const endpoint = founderStatus?.configured
        ? '/api/auth/founder/request-otp'
        : '/api/auth/founder/setup';

      const payload = founderStatus?.configured
        ? { mobile: founderMobile, passkey: founderPasskey }
        : {
            mobile: founderMobile,
            passkey: founderPasskey,
            email: founderEmail,
            setupSecret: founderSetupSecret,
          };

      const res = await apiFetch<{ success: boolean; verificationOtp?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setFounderOtpHint(res.verificationOtp || '');
      setFounderStep('OTP');
    } catch (err: unknown) {
      setFounderError(err instanceof Error ? err.message : 'Founder verification failed');
    } finally {
      setFounderLoading(false);
    }
  };

  const handleFounderOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setFounderError('');
    setFounderLoading(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        token: string;
        user: UserProfile;
        mode: DbMode;
      }>('/api/auth/founder/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ mobile: founderMobile, otp: founderOtp }),
      });
      setAuthToken(res.token);
      setFounderOpen(false);
      onAuthenticated(res.user, res.mode);
    } catch (err: unknown) {
      setFounderError(err instanceof Error ? err.message : 'Invalid Founder OTP');
    } finally {
      setFounderLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Clean 3-zone Top Navigation */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <BrandLogo size="md" />
            <div>
              <span className="block text-lg font-extrabold tracking-tight text-blue-700 dark:text-blue-400 leading-none">
                MAJDOOR MITRA
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Founded by {appSettings?.founderName || 'Raja'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton lang={lang} />
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
            >
              <Languages className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shrink-0"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-orange-400" /> : <Moon className="h-4 w-4 text-blue-700" />}
            </button>
          </div>
        </div>
      </header>

      {/* Global Announcement or Maintenance Notice */}
      {appSettings?.maintenanceMode && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            {lang === 'hi'
              ? 'रखरखाव मोड सक्रिय है: सामान्य लॉगिन अस्थायी रूप से रुके हुए हैं। केवल संस्थापक लॉगिन कर सकते हैं।'
              : 'Scheduled Maintenance Active: Standard user logins are temporarily paused. Founder access remains active.'}
          </div>
        </div>
      )}

      {appSettings?.announcementBanner && !appSettings.maintenanceMode && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            {appSettings.announcementBanner}
          </div>
        </div>
      )}

      {/* Main Split Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left Hero Visual & Value Proposition */}
          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-blue-900 dark:border-slate-800 lg:col-span-7">
            <img
              src="/src/assets/images/hero_worksite_india_1795110250754.jpg"
              alt="Indian construction team at morning shift"
              referrerPolicy="no-referrer"
              className="h-64 w-full object-cover sm:h-80 lg:h-full lg:min-h-[540px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/20" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="text-sm font-semibold text-orange-400">
                {t(lang, 'tagline')}
              </p>
              <h1 className="mt-2 max-w-xl text-2xl font-extrabold leading-tight text-white sm:text-4xl [text-wrap:balance]">
                {lang === 'hi'
                  ? 'रोज़ की हाज़िरी, ओवरटाइम और वेतन का पूरा पारदर्शी हिसाब।'
                  : 'Transparent daily attendance, overtime, and payroll accounting.'}
              </h1>
              <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-200 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
                  <span>{lang === 'hi' ? 'सटीक वेतन गणना' : 'Exact Payroll Math'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-400" />
                  <span>{lang === 'hi' ? 'OTP व रोल सुरक्षा' : 'OTP & Role Access'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-400" />
                  <span>{lang === 'hi' ? 'PDF, Excel व WhatsApp' : 'PDF, Excel & WhatsApp'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Right Auth & Role Card */}
          <section className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:col-span-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {lang === 'hi' ? 'अपना खाता चुनें और लॉगिन करें' : 'Sign In or Register'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {lang === 'hi'
                  ? 'मोबाइल नंबर और OTP से सुरक्षित लॉगिन करें।'
                  : 'Secure verification using your 10-digit mobile number and OTP.'}
              </p>

              {/* Role Segmented Selector */}
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setRole('WORKER');
                    setStep('MOBILE');
                    setError('');
                  }}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    role === 'WORKER'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <HardHat className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(lang, 'workerRole')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('OWNER');
                    setStep('MOBILE');
                    setError('');
                  }}
                  className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    role === 'OWNER'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(lang, 'ownerRole')}</span>
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                  {error}
                </div>
              )}

              {step === 'MOBILE' ? (
                <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t(lang, 'mobileLabel')}
                    </label>
                    <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800">
                      <span className="flex items-center gap-1.5 border-r border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        +91
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder={t(lang, 'mobilePlaceholder')}
                        className="w-full bg-transparent px-3.5 py-3 text-base font-medium tabular-nums text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || mobile.length !== 10}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{loading ? (lang === 'hi' ? 'भेज रहे हैं...' : 'Sending...') : t(lang, 'sendOtp')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/40">
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-200">+91 {mobile}</p>
                      {devOtpHint && (
                        <p className="mt-0.5 text-xs font-mono text-blue-700 dark:text-blue-300">
                          {lang === 'hi' ? 'सत्यापन कोड (OTP):' : 'Verification OTP:'}{' '}
                          <strong className="text-sm">{devOtpHint}</strong>
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep('MOBILE');
                        setOtp('');
                      }}
                      className="text-xs font-semibold text-blue-700 underline dark:text-blue-400"
                    >
                      {lang === 'hi' ? 'बदलें' : 'Change'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {t(lang, 'otpLabel')}
                    </label>
                    <div className="mt-1.5 flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800">
                      <span className="px-3.5 text-slate-400">
                        <KeyRound className="h-4 w-4" />
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit OTP"
                        className="w-full bg-transparent py-3 pr-4 font-mono text-lg font-bold tracking-widest text-slate-900 outline-none dark:text-white"
                      />
                    </div>
                  </div>

                  {!isRegistered && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {lang === 'hi' ? 'नया खाता पंजीकरण विवरण' : 'New Account Registration Details'}
                      </p>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t(lang, 'fullName')}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      {role === 'OWNER' && (
                        <>
                          <input
                            type="text"
                            required
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder={t(lang, 'businessName')}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={t(lang, 'addressLabel')}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>{loading ? (lang === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying...') : t(lang, 'verifyOtp')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Isolated Demo Mode & Founder Portal Trigger */}
            <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {lang === 'hi'
                  ? 'प्रोडक्शन डेटा पूरी तरह सुरक्षित और खाली है। नमूना डेटा देखने के लिए डेमो मोड चलाएं:'
                  : 'Production database starts clean with zero fake data. Explore sample data in isolated Demo Mode:'}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin('OWNER')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-semibold text-orange-800 transition-colors hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/70"
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(lang, 'demoOwner')}</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDemoLogin('WORKER')}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-950/70"
                >
                  <HardHat className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t(lang, 'demoWorker')}</span>
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                <span className="font-semibold text-slate-500 dark:text-slate-400">
                  MAJDOOR MITRA · Founded by {appSettings?.founderName || 'Raja'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFounderStep('CREDENTIALS');
                    setFounderError('');
                    setFounderOtp('');
                    setFounderOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:underline dark:text-blue-400"
                >
                  <Crown className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                  <span>{t(lang, 'founderPortal')}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOUNDER / SUPER ADMIN AUTH MODAL */}
      {founderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo size="sm" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {founderStatus?.configured
                      ? 'Founder Sign In (Raja)'
                      : 'Configure Founder Super Admin'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    SUPER ADMIN / APP OWNER · 2FA Protected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFounderOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {founderError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
                {founderError}
              </div>
            )}

            {founderStep === 'CREDENTIALS' ? (
              <form onSubmit={handleFounderCredentialsSubmit} className="mt-4 space-y-3.5">
                {!founderStatus?.configured && (
                  <p className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
                    One-time founder setup: bind your personal 10-digit mobile number and passkey. Once claimed, this
                    setup locks permanently.
                  </p>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Founder Mobile Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={founderMobile}
                    onChange={(e) => setFounderMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98XXXXXXXX"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                {!founderStatus?.configured && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Founder Email
                    </label>
                    <input
                      type="email"
                      required
                      value={founderEmail}
                      onChange={(e) => setFounderEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {founderStatus?.configured ? 'Personal Founder Passkey' : 'Create Strong Passkey (min 8 chars)'}
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={founderPasskey}
                      onChange={(e) => setFounderPasskey(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent px-2.5 py-2.5 text-sm outline-none"
                    />
                  </div>
                </div>

                {!founderStatus?.configured && founderStatus?.requiresSetupSecret && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Deployment Setup Secret
                    </label>
                    <input
                      type="password"
                      required
                      value={founderSetupSecret}
                      onChange={(e) => setFounderSetupSecret(e.target.value)}
                      placeholder="FOUNDER_BOOTSTRAP_SECRET"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={founderLoading || founderMobile.length !== 10 || founderPasskey.length < 8}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  <span>
                    {founderLoading
                      ? 'Verifying...'
                      : founderStatus?.configured
                      ? 'Verify Passkey & Send OTP'
                      : 'Claim Founder Account & Send OTP'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleFounderOtpVerify} className="mt-4 space-y-4">
                {founderOtpHint && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-mono text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                    2FA Verification OTP: <strong className="text-sm">{founderOtpHint}</strong>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Enter 6-Digit 2FA OTP
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={founderOtp}
                    onChange={(e) => setFounderOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit OTP"
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-lg font-bold tracking-widest dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  disabled={founderLoading || founderOtp.length !== 6}
                  className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  <span>{founderLoading ? 'Authenticating...' : 'Enter Super Admin Console'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
