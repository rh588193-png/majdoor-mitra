import {
  Activity,
  Ban,
  Building2,
  CheckCircle2,
  Crown,
  HardHat,
  History,
  Languages,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatINR, t } from '../i18n';
import type {
  AccountStatus,
  AppSettings,
  Language,
  PremiumFeatures,
  SubscriptionPlan,
  SuperAdminAuditLog,
  SuperAdminStats,
  SuperAdminUserRow,
  SuperAdminWorkerRow,
  ThemeMode,
  UserProfile,
} from '../types';
import { apiFetch } from '../utils/api';
import { AboutAppCard } from './AboutAppCard';
import { BrandLogo } from './BrandLogo';

interface Props {
  user: UserProfile;
  lang: Language;
  theme: ThemeMode;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onSettingsUpdated: (settings: AppSettings) => void;
}

type SuperTab = 'OVERVIEW' | 'EMPLOYERS' | 'WORKERS' | 'SETTINGS' | 'ABOUT';

const FEATURE_META: Array<{ key: keyof PremiumFeatures; en: string; hi: string; descEn: string; descHi: string }> = [
  {
    key: 'gpsGeofencing',
    en: 'GPS Geofencing Attendance',
    hi: 'GPS लोकेशन हाज़िरी',
    descEn: 'Verify worker check-ins inside site radius',
    descHi: 'साइट सीमा के अंदर GPS से हाज़िरी सत्यापन',
  },
  {
    key: 'pdfExcelExports',
    en: 'PDF & Excel Statements',
    hi: 'PDF व Excel रिपोर्ट',
    descEn: 'Salary slips and multi-sheet financial exports',
    descHi: 'वेतन पर्ची और मासिक लेजर निर्यात',
  },
  {
    key: 'whatsappIntegration',
    en: 'WhatsApp Slip Sharing',
    hi: 'WhatsApp स्टेटमेंट शेयर',
    descEn: 'One-tap salary breakdown sharing',
    descHi: 'एक क्लिक में वेतन विवरण साझा करें',
  },
  {
    key: 'multiSiteManagement',
    en: 'Multi-Site Workspaces',
    hi: 'मल्टी-साइट प्रबंधन',
    descEn: 'Track multiple active construction/work sites',
    descHi: 'एक साथ कई कार्य साइट्स का प्रबंधन',
  },
  {
    key: 'cloudBackupRestore',
    en: 'Backup & Restore JSON',
    hi: 'बैकअप व रीस्टोर',
    descEn: 'Organization archive export and recovery',
    descHi: 'संगठन डेटा का बैकअप और रीस्टोर',
  },
  {
    key: 'customBranding',
    en: 'Custom Organization Branding',
    hi: 'कस्टम कंपनी ब्रांडिंग',
    descEn: 'White-label header on exported statements',
    descHi: 'स्टेटमेंट पर कंपनी का विशेष नाम व ब्रांडिंग',
  },
];

export const SuperAdminDashboard: React.FC<Props> = ({
  user,
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
  onLogout,
  onSettingsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<SuperTab>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<SuperAdminAuditLog[]>([]);
  const [users, setUsers] = useState<SuperAdminUserRow[]>([]);
  const [workerProfiles, setWorkerProfiles] = useState<SuperAdminWorkerRow[]>([]);

  // Settings draft state
  const [draftSettings, setDraftSettings] = useState<AppSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modals
  const [statusModal, setStatusModal] = useState<{
    user: SuperAdminUserRow;
    nextStatus: AccountStatus;
    reason: string;
  } | null>(null);

  const [subModal, setSubModal] = useState<{
    employerId: number;
    businessName: string;
    plan: SubscriptionPlan;
    maxWorkers: string;
    expiresAt: string;
  } | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SuperAdminUserRow | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewRes, usersRes, workersRes] = await Promise.all([
        apiFetch<{
          stats: SuperAdminStats;
          appSettings: AppSettings;
          recentAuditLogs: SuperAdminAuditLog[];
        }>('/api/super-admin/overview'),
        apiFetch<{ users: SuperAdminUserRow[] }>('/api/super-admin/users'),
        apiFetch<{ workers: SuperAdminWorkerRow[] }>('/api/super-admin/workers'),
      ]);
      setStats(overviewRes.stats);
      setAppSettings(overviewRes.appSettings);
      setDraftSettings(overviewRes.appSettings);
      setAuditLogs(overviewRes.recentAuditLogs);
      setUsers(usersRes.users);
      setWorkerProfiles(workersRes.workers);
      onSettingsUpdated(overviewRes.appSettings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load Super Admin console');
    } finally {
      setLoading(false);
    }
  }, [onSettingsUpdated]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const ownerUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => u.role === 'OWNER')
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          (u.business_name || '').toLowerCase().includes(q) ||
          u.mobile.includes(q)
      );
  }, [users, searchQuery]);

  const workerUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => u.role === 'WORKER')
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.mobile.includes(q));
  }, [users, searchQuery]);

  const filteredWorkerProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workerProfiles.filter(
      (w) =>
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.unique_worker_id.toLowerCase().includes(q) ||
        w.mobile.includes(q) ||
        w.business_name.toLowerCase().includes(q)
    );
  }, [workerProfiles, searchQuery]);

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;
    try {
      await apiFetch(`/api/super-admin/users/${statusModal.user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: statusModal.nextStatus,
          reason: statusModal.reason,
        }),
      });
      showToast(`Account ${statusModal.user.name} updated to ${statusModal.nextStatus}.`);
      setStatusModal(null);
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const handleConfirmSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subModal) return;
    try {
      await apiFetch(`/api/super-admin/employers/${subModal.employerId}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify({
          subscriptionPlan: subModal.plan,
          maxWorkers: Number(subModal.maxWorkers) || undefined,
          expiresAt: subModal.expiresAt,
        }),
      });
      showToast(`Subscription updated to ${subModal.plan} for ${subModal.businessName}.`);
      setSubModal(null);
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Subscription update failed');
    }
  };

  const handleToggleWorkerProfile = async (w: SuperAdminWorkerRow) => {
    const next = w.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiFetch(`/api/super-admin/workers/${w.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      showToast(`${w.name} marked ${next}.`);
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/super-admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      showToast(`Removed account ${deleteTarget.name}.`);
      setDeleteTarget(null);
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftSettings) return;
    setSavingSettings(true);
    try {
      const res = await apiFetch<{ success: boolean; settings: AppSettings }>('/api/super-admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(draftSettings),
      });
      setAppSettings(res.settings);
      setDraftSettings(res.settings);
      onSettingsUpdated(res.settings);
      showToast(lang === 'hi' ? 'ऐप सेटिंग्स सफलतापूर्वक सेव हो गईं।' : 'App settings and feature flags saved.');
      loadAll();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const statusTone = (st?: AccountStatus | null) => {
    if (st === 'SUSPENDED') return 'text-amber-700 dark:text-amber-400';
    if (st === 'DEACTIVATED') return 'text-red-700 dark:text-red-400';
    return 'text-emerald-700 dark:text-emerald-400';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:pb-8">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-base font-extrabold tracking-tight text-blue-700 dark:text-blue-400">
                  MAJDOOR MITRA
                </span>
                <span className="hidden sm:inline text-xs font-semibold text-slate-400">·</span>
                <span className="hidden sm:inline text-xs font-bold text-orange-600 dark:text-orange-400">
                  SUPER ADMIN
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Founder: {user.name} · +91 {user.mobile}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadAll}
              aria-label="Refresh"
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
            >
              <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'hi' ? 'EN' : 'हि'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-orange-400" /> : <Moon className="h-4 w-4 text-blue-700" />}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
            {toast}
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 space-y-2 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                {lang === 'hi' ? 'संस्थापक नियंत्रण कक्ष' : 'Founder Command Center'}
              </p>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">
                {user.name} · SUPER ADMIN
              </p>
            </div>
            {(
              [
                ['OVERVIEW', Activity, lang === 'hi' ? 'अवलोकन व आंकड़े' : 'Overview & Stats'],
                ['EMPLOYERS', Building2, lang === 'hi' ? 'मालिक व सब्सक्रिप्शन' : 'Employers & Plans'],
                ['WORKERS', HardHat, lang === 'hi' ? 'सभी मजदूर खाते' : 'Workers Directory'],
                ['SETTINGS', SlidersHorizontal, lang === 'hi' ? 'ऐप सेटिंग्स व फीचर्स' : 'App Settings & Features'],
                ['ABOUT', ShieldCheck, lang === 'hi' ? 'ऑडिट व ऐप विवरण' : 'Audit & About App'],
              ] as Array<[SuperTab, React.FC<{ className?: string }>, string]>
            ).map(([tab, Icon, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="min-w-0 flex-1 space-y-6">
          {/* OVERVIEW */}
          {activeTab === 'OVERVIEW' && stats && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'hi' ? 'कुल पंजीकृत उपयोगकर्ता' : 'Total Registered Users'}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-blue-700 dark:text-blue-400">
                    {stats.totalUsers}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {stats.totalOwners} Owners · {stats.totalWorkersUsers} Workers
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'hi' ? 'खाता स्थिति' : 'Account Health'}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {stats.activeUsers}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Active · {stats.suspendedUsers} Suspended · {stats.deactivatedUsers} Deactivated
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {lang === 'hi' ? 'मजदूर प्रोफाइल व साइट्स' : 'Worker Profiles & Sites'}
                  </p>
                  <p className="mt-2 font-mono text-3xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                    {stats.totalWorkerProfiles}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {stats.totalSites} Sites · {stats.totalAttendance} Attendance Logs
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 dark:border-orange-900/60 dark:bg-orange-950/30">
                  <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                    {lang === 'hi' ? 'प्लेटफॉर्म वेतन लेन-देन' : 'Platform Payroll Volume'}
                  </p>
                  <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-400">
                    {formatINR(stats.totalPaid)}
                  </p>
                  <p className="mt-1.5 text-xs text-orange-800/80 dark:text-orange-300/80 tabular-nums">
                    Advances: {formatINR(stats.totalAdvances)}
                  </p>
                </div>
              </div>

              {/* Subscription Breakdown + Platform Controls Snapshot */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'hi' ? 'नियोक्ता सब्सक्रिप्शन वितरण' : 'Employer Subscription Breakdown'}
                  </h2>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">FREE</p>
                      <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">
                        {stats.subscriptionBreakdown.FREE}
                      </p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">PRO</p>
                      <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-blue-700 dark:text-blue-400">
                        {stats.subscriptionBreakdown.PRO}
                      </p>
                    </div>
                    <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/50 dark:bg-orange-950/30">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">ENTERPRISE</p>
                      <p className="mt-1 font-mono text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-400">
                        {stats.subscriptionBreakdown.ENTERPRISE}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'लाइव ऐप नियंत्रण' : 'Live Platform Controls'}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('SETTINGS')}
                      className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {lang === 'hi' ? 'सेटिंग्स बदलें' : 'Manage Settings'}
                    </button>
                  </div>
                  {appSettings && (
                    <div className="mt-4 divide-y divide-slate-100 text-sm dark:divide-slate-800">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-600 dark:text-slate-300">Maintenance Mode</span>
                        <span className={`font-bold ${appSettings.maintenanceMode ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {appSettings.maintenanceMode ? 'ENABLED' : 'OFF (Live)'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-600 dark:text-slate-300">New Registrations</span>
                        <span className={`font-bold ${appSettings.registrationEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {appSettings.registrationEnabled ? 'OPEN' : 'PAUSED'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-slate-600 dark:text-slate-300">Free Worker Quota</span>
                        <span className="font-mono font-bold tabular-nums">{appSettings.freePlanWorkerLimit} workers</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Audit Logs */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'hi' ? 'सुपर एडमिन ऑडिट लॉग' : 'Super Admin Security & Action Logs'}
                  </h2>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {' '}· {log.actor_name} · {log.target_type}
                          {log.target_id ? ` #${log.target_id}` : ''}
                          {log.reason ? ` · ${log.reason}` : ''}
                        </span>
                      </div>
                      <span className="font-mono text-slate-500 dark:text-slate-400">{log.created_at}</span>
                    </div>
                  ))}
                  {auditLogs.length === 0 && (
                    <p className="py-4 text-center text-slate-500 dark:text-slate-400">No actions logged yet.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* EMPLOYERS & SUBSCRIPTIONS */}
          {activeTab === 'EMPLOYERS' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {lang === 'hi' ? 'पंजीकृत मालिक व सब्सक्रिप्शन प्रबंधन' : 'Registered Employers & Subscriptions'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ownerUsers.length} {lang === 'hi' ? 'नियोक्ता खाते' : 'employer accounts'}
                  </p>
                </div>
                <div className="flex w-full sm:w-72 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'hi' ? 'नाम, कंपनी या मोबाइल खोजें...' : 'Search name, business, mobile...'}
                    className="w-full bg-transparent text-xs outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {ownerUsers.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-bold ${statusTone(emp.account_status)}`}>{emp.account_status}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          {emp.subscription_plan || 'FREE'} PLAN
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">+91 {emp.mobile}</span>
                      </div>
                      <h3 className="truncate text-base font-extrabold text-slate-900 dark:text-white">
                        {emp.business_name || emp.name}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        Owner: {emp.name} · Workers: {emp.managed_workers_count}/{emp.max_workers || 25} · Sites: {emp.sites_count}
                        {emp.status_reason ? ` · Note: ${emp.status_reason}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {emp.employer_id && (
                        <button
                          type="button"
                          onClick={() =>
                            setSubModal({
                              employerId: emp.employer_id!,
                              businessName: emp.business_name || emp.name,
                              plan: emp.subscription_plan || 'FREE',
                              maxWorkers: String(emp.max_workers || 25),
                              expiresAt: emp.subscription_expires_at || '',
                            })
                          }
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                        >
                          <Crown className="h-3.5 w-3.5" />
                          <span>{lang === 'hi' ? 'प्लान बदलें' : 'Plan'}</span>
                        </button>
                      )}

                      {emp.account_status !== 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => setStatusModal({ user: emp, nextStatus: 'ACTIVE', reason: '' })}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Activate</span>
                        </button>
                      )}

                      {emp.account_status !== 'SUSPENDED' && (
                        <button
                          type="button"
                          onClick={() => setStatusModal({ user: emp, nextStatus: 'SUSPENDED', reason: '' })}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Suspend</span>
                        </button>
                      )}

                      {emp.account_status !== 'DEACTIVATED' && (
                        <button
                          type="button"
                          onClick={() => setStatusModal({ user: emp, nextStatus: 'DEACTIVATED', reason: '' })}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Deactivate</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(emp)}
                        aria-label="Delete user"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:text-slate-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {ownerUsers.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {lang === 'hi' ? 'कोई पंजीकृत मालिक खाता नहीं मिला।' : 'No registered employer accounts found.'}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* WORKERS DIRECTORY */}
          {activeTab === 'WORKERS' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'पंजीकृत मजदूर लॉगिन खाते' : 'Registered Worker Login Accounts'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {workerUsers.length} worker user accounts
                    </p>
                  </div>
                  <div className="flex w-full sm:w-72 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={lang === 'hi' ? 'नाम या मोबाइल से खोजें...' : 'Search workers...'}
                      className="w-full bg-transparent text-xs outline-none dark:text-white"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {workerUsers.map((wu) => (
                    <div
                      key={wu.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center"
                    >
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`font-bold ${statusTone(wu.account_status)}`}>{wu.account_status}</span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-500 dark:text-slate-400">+91 {wu.mobile}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 dark:text-slate-400">Linked Jobs: {wu.linked_jobs_count}</span>
                        </div>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">{wu.name}</p>
                        {wu.status_reason && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {wu.status_reason}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {wu.account_status !== 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => setStatusModal({ user: wu, nextStatus: 'ACTIVE', reason: '' })}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Activate
                          </button>
                        )}
                        {wu.account_status !== 'SUSPENDED' && (
                          <button
                            type="button"
                            onClick={() => setStatusModal({ user: wu, nextStatus: 'SUSPENDED', reason: '' })}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            Suspend
                          </button>
                        )}
                        {wu.account_status !== 'DEACTIVATED' && (
                          <button
                            type="button"
                            onClick={() => setStatusModal({ user: wu, nextStatus: 'DEACTIVATED', reason: '' })}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                          >
                            Deactivate
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(wu)}
                          aria-label="Delete worker account"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 dark:border-slate-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {workerUsers.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      No registered worker login accounts yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'सभी संगठनों के मजदूर प्रोफाइल' : 'All Employer Worker Profiles'} ({filteredWorkerProfiles.length})
                </h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <th className="py-2.5 pr-3">Worker</th>
                        <th className="py-2.5 pr-3">Employer</th>
                        <th className="py-2.5 pr-3">Wage</th>
                        <th className="py-2.5 pr-3">Status</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredWorkerProfiles.map((w) => (
                        <tr key={w.id}>
                          <td className="py-2.5 pr-3">
                            <p className="font-bold text-slate-900 dark:text-white">{w.name}</p>
                            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {w.unique_worker_id} · +91 {w.mobile}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{w.business_name}</p>
                            <p className="text-slate-500 dark:text-slate-400">{w.site_name || 'No site'}</p>
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-xs tabular-nums">
                            {w.wage_type === 'MONTHLY' ? `${formatINR(w.monthly_salary)}/mo` : `${formatINR(w.daily_wage)}/day`}
                          </td>
                          <td className="py-2.5 pr-3 text-xs font-bold">
                            <span className={w.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                              {w.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleWorkerProfile(w)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              {w.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredWorkerProfiles.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400">
                            No worker profiles added by employers yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* APP SETTINGS, SUBSCRIPTIONS & PREMIUM FEATURES */}
          {activeTab === 'SETTINGS' && draftSettings && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'ग्लोबल ऐप नियंत्रण व प्लान नियम' : 'Global App Settings & Plan Quotas'}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Maintenance Mode</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pause standard logins while maintaining Super Admin access
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftSettings.maintenanceMode}
                      onChange={(e) => setDraftSettings({ ...draftSettings, maintenanceMode: e.target.checked })}
                      className="h-5 w-5 accent-orange-600"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">New User Registrations</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Allow new Workers and Employers to sign up via OTP
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={draftSettings.registrationEnabled}
                      onChange={(e) => setDraftSettings({ ...draftSettings, registrationEnabled: e.target.checked })}
                      className="h-5 w-5 accent-blue-700"
                    />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Free Plan Worker Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draftSettings.freePlanWorkerLimit}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, freePlanWorkerLimit: Number(e.target.value) || 25 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Pro Plan Worker Limit
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={draftSettings.proPlanWorkerLimit}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, proPlanWorkerLimit: Number(e.target.value) || 250 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Pro Plan Price (₹/mo)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={draftSettings.proPlanPriceInr}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, proPlanPriceInr: Number(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Enterprise Price (₹/mo)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={draftSettings.enterprisePlanPriceInr}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, enterprisePlanPriceInr: Number(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Support Contact (Email / Phone)
                    </label>
                    <input
                      type="text"
                      value={draftSettings.supportContact}
                      onChange={(e) => setDraftSettings({ ...draftSettings, supportContact: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Global Announcement Banner
                    </label>
                    <input
                      type="text"
                      value={draftSettings.announcementBanner}
                      onChange={(e) => setDraftSettings({ ...draftSettings, announcementBanner: e.target.value })}
                      placeholder="Optional message shown on login & dashboards"
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Premium Feature Flags */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'प्रीमियम फीचर नियंत्रण' : 'Premium Feature Flags'}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {FEATURE_META.map((feat) => (
                    <label
                      key={feat.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? feat.hi : feat.en}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lang === 'hi' ? feat.descHi : feat.descEn}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(draftSettings.premiumFeatures[feat.key])}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            premiumFeatures: {
                              ...draftSettings.premiumFeatures,
                              [feat.key]: e.target.checked,
                            },
                          })
                        }
                        className="h-5 w-5 accent-blue-700 shrink-0"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="min-h-[46px] rounded-xl bg-blue-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : lang === 'hi' ? 'सेटिंग्स सेव करें' : 'Save Global Settings'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ABOUT APP & FULL AUDIT */}
          {activeTab === 'ABOUT' && (
            <div className="space-y-6">
              <AboutAppCard
                lang={lang}
                founderName={appSettings?.founderName || 'Raja'}
                supportContact={appSettings?.supportContact}
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'hi' ? 'सुरक्षा और स्वामित्व सुरक्षा नियम' : 'Founder & Role Security Architecture'}
                </h2>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
                  <li>Only Founder Raja ({user.email || 'rh588193@gmail.com'}) holds the verified SUPER_ADMIN role.</li>
                  <li>Standard OTP login, Demo Mode, and Profile Preferences APIs reject any SUPER_ADMIN escalation with HTTP 403.</li>
                  <li>Founder credentials use scrypt cryptographic hashing with random salts and 6-digit OTP 2FA.</li>
                  <li>Suspended or deactivated accounts are immediately blocked server-side across all API endpoints.</li>
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        <div className="grid h-16 grid-cols-5 items-center">
          {(
            [
              ['OVERVIEW', Activity, 'Stats'],
              ['EMPLOYERS', Building2, 'Owners'],
              ['WORKERS', Users, 'Workers'],
              ['SETTINGS', Settings, 'Settings'],
              ['ABOUT', ShieldCheck, 'About'],
            ] as Array<[SuperTab, React.FC<{ className?: string }>, string]>
          ).map(([tab, Icon, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                activeTab === tab ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* MODAL: ACCOUNT STATUS CHANGE */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Set Account {statusModal.nextStatus}
              </h3>
              <button type="button" onClick={() => setStatusModal(null)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {statusModal.user.name} (+91 {statusModal.user.mobile})
            </p>
            <form onSubmit={handleConfirmStatusChange} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Reason / Admin Note (Optional)
                </label>
                <input
                  type="text"
                  value={statusModal.reason}
                  onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
                  placeholder="e.g. Policy violation / Plan verification / Re-activated"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Confirm {statusModal.nextStatus}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMPLOYER SUBSCRIPTION */}
      {subModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Subscription: {subModal.businessName}
              </h3>
              <button type="button" onClick={() => setSubModal(null)} className="rounded-lg p-1 text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmSubscription} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Plan Tier</label>
                <select
                  value={subModal.plan}
                  onChange={(e) => {
                    const p = e.target.value as SubscriptionPlan;
                    const defaultCap =
                      p === 'ENTERPRISE'
                        ? '5000'
                        : p === 'PRO'
                        ? String(appSettings?.proPlanWorkerLimit || 250)
                        : String(appSettings?.freePlanWorkerLimit || 25);
                    setSubModal({ ...subModal, plan: p, maxWorkers: defaultCap });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="FREE">FREE</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Max Allowed Workers
                </label>
                <input
                  type="number"
                  min={1}
                  value={subModal.maxWorkers}
                  onChange={(e) => setSubModal({ ...subModal, maxWorkers: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={subModal.expiresAt}
                  onChange={(e) => setSubModal({ ...subModal, expiresAt: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <button
                type="submit"
                className="min-h-[44px] w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"
              >
                Update Subscription Plan
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Delete Account Permanently?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong> (+91 {deleteTarget.mobile})? This
              cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
