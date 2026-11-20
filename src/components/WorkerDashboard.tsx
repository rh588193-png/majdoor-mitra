import {
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Copy,
  FileDown,
  IndianRupee,
  Languages,
  LogOut,
  MapPin,
  Moon,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sun,
  UserCheck,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatINR, t } from '../i18n';
import type {
  AllTimeBalance,
  AppSettings,
  AttendanceRecord,
  DbMode,
  Language,
  LeaveRequestItem,
  NotificationItem,
  SalarySummary,
  ThemeMode,
  TransactionItem,
  UserProfile,
  WorkerWithStats,
} from '../types';
import { apiFetch, enqueueOfflineItem, getOfflineQueue } from '../utils/api';
import {
  buildWhatsAppShareUrl,
  buildWhatsAppStatementText,
  downloadSalarySlipPDF,
} from '../utils/exportUtils';
import { AboutAppCard } from './AboutAppCard';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface Props {
  user: UserProfile;
  mode: DbMode;
  lang: Language;
  theme: ThemeMode;
  appSettings?: AppSettings | null;
  isOnline: boolean;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  onSyncOffline: () => void;
  pendingSyncCount: number;
}

type WorkerTab = 'HOME' | 'CALENDAR' | 'LEDGER' | 'LEAVE';

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const WorkerDashboard: React.FC<Props> = ({
  user,
  mode,
  lang,
  theme,
  appSettings,
  isOnline,
  onToggleLang,
  onToggleTheme,
  onLogout,
  onSyncOffline,
  pendingSyncCount,
}) => {
  const [activeTab, setActiveTab] = useState<WorkerTab>('HOME');
  const [month, setMonth] = useState(currentYm());
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [profiles, setProfiles] = useState<WorkerWithStats[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<WorkerWithStats | null>(null);
  const [salary, setSalary] = useState<SalarySummary | null>(null);
  const [allTimeBalance, setAllTimeBalance] = useState<AllTimeBalance | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Interactive day detail drawer
  const [selectedDayRecord, setSelectedDayRecord] = useState<AttendanceRecord | null>(null);

  // Leave request form
  const [leaveFrom, setLeaveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveTo, setLeaveTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // GPS Check-in state
  const [gpsLoading, setGpsLoading] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ month });
      if (selectedWorkerId) qs.set('workerId', String(selectedWorkerId));
      const data = await apiFetch<{
        profiles: WorkerWithStats[];
        selectedProfile: WorkerWithStats | null;
        salary: SalarySummary | null;
        allTimeBalance: AllTimeBalance | null;
        attendance: AttendanceRecord[];
        transactions: TransactionItem[];
        leaveRequests: LeaveRequestItem[];
        notifications: NotificationItem[];
      }>(`/api/worker/dashboard?${qs.toString()}`);

      setProfiles(data.profiles);
      setSelectedProfile(data.selectedProfile);
      if (data.selectedProfile && !selectedWorkerId) {
        setSelectedWorkerId(data.selectedProfile.id);
      }
      setSalary(data.salary);
      setAllTimeBalance(data.allTimeBalance);
      setAttendance(data.attendance);
      setTransactions(data.transactions);
      setLeaveRequests(data.leaveRequests);
      setNotifications(data.notifications);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [month, selectedWorkerId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecord = useMemo(
    () => attendance.find((a) => a.date === todayStr) || null,
    [attendance, todayStr]
  );

  const calendarDays = useMemo(() => {
    const [yr, mo] = month.split('-').map(Number);
    const totalDays = new Date(yr, mo, 0).getDate();
    const firstWeekday = new Date(yr, mo - 1, 1).getDay(); // 0=Sun
    const map = new Map<string, AttendanceRecord>();
    for (const r of attendance) map.set(r.date, r);
    const cells: Array<{ day: number | null; dateStr: string; record: AttendanceRecord | null }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dateStr: '', record: null });
    for (let d = 1; d <= totalDays; d++) {
      const ds = `${month}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, dateStr: ds, record: map.get(ds) || null });
    }
    return cells;
  }, [month, attendance]);

  const handleGpsCheckIn = () => {
    if (!selectedProfile) return;
    if (!navigator.geolocation) {
      showToast(lang === 'hi' ? 'इस डिवाइस में GPS उपलब्ध नहीं है।' : 'GPS is not supported on this device.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiFetch<{ success: boolean; distanceMeters: number | null }>(
            '/api/worker/gps-checkin',
            {
              method: 'POST',
              body: JSON.stringify({
                workerId: selectedProfile.id,
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            }
          );
          showToast(
            lang === 'hi'
              ? `GPS हाज़िरी सफलतापूर्वक दर्ज हुई${res.distanceMeters != null ? ` (${res.distanceMeters}m)` : ''}।`
              : `GPS Check-in verified${res.distanceMeters != null ? ` (${res.distanceMeters}m from site)` : ''}.`
          );
          loadDashboard();
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'GPS check-in failed');
        } finally {
          setGpsLoading(false);
        }
      },
      (geoErr) => {
        setGpsLoading(false);
        showToast(
          lang === 'hi'
            ? `GPS अनुमति आवश्यक है: ${geoErr.message}`
            : `Location permission required: ${geoErr.message}`
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !leaveReason.trim()) return;
    setSubmittingLeave(true);
    try {
      if (!isOnline) {
        enqueueOfflineItem({
          type: 'LEAVE_REQUEST',
          payload: {
            workerId: selectedProfile.id,
            fromDate: leaveFrom,
            toDate: leaveTo,
            reason: leaveReason.trim(),
          },
        });
        setLeaveReason('');
        showToast(lang === 'hi' ? 'ऑफलाइन सेव हुआ। इंटरनेट आने पर सिंक होगा।' : 'Saved offline; will sync when online.');
      } else {
        await apiFetch('/api/worker/leave-requests', {
          method: 'POST',
          body: JSON.stringify({
            workerId: selectedProfile.id,
            fromDate: leaveFrom,
            toDate: leaveTo,
            reason: leaveReason.trim(),
          }),
        });
        setLeaveReason('');
        showToast(lang === 'hi' ? 'छुट्टी का आवेदन मालिक को भेजा गया।' : 'Leave request sent to employer.');
        loadDashboard();
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to submit leave request');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await apiFetch('/api/worker/notifications/read', { method: 'POST' });
      loadDashboard();
    } catch {
      // ignore
    }
  };

  const whatsappMessage = useMemo(() => {
    if (!selectedProfile || !salary) return '';
    return buildWhatsAppStatementText({
      workerName: selectedProfile.name,
      uniqueId: selectedProfile.unique_worker_id,
      employerName: selectedProfile.business_name || 'Employer',
      month,
      salary,
      lang,
    });
  }, [selectedProfile, salary, month, lang]);

  const handleCopyWhatsApp = async () => {
    if (!whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      showToast(lang === 'hi' ? 'WhatsApp स्टेटमेंट कॉपी हो गया!' : 'Statement copied for WhatsApp!');
    } catch {
      showToast(lang === 'hi' ? 'WhatsApp लिंक तैयार है।' : 'WhatsApp share link ready.');
    }
  };

  const whatsappUrl = useMemo(() => {
    if (!whatsappMessage) return '#';
    return buildWhatsAppShareUrl(whatsappMessage);
  }, [whatsappMessage]);

  const statusLabel = (st: AttendanceRecord['status']) => {
    if (st === 'PRESENT') return lang === 'hi' ? 'उपस्थित' : 'Present';
    if (st === 'HALF_DAY') return lang === 'hi' ? 'आधा दिन' : 'Half Day';
    if (st === 'PAID_LEAVE') return lang === 'hi' ? 'सवेतन छुट्टी' : 'Paid Leave';
    return lang === 'hi' ? 'अनुपस्थित' : 'Absent';
  };

  const statusColorClass = (st: AttendanceRecord['status']) => {
    if (st === 'PRESENT') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800';
    if (st === 'HALF_DAY') return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800';
    if (st === 'PAID_LEAVE') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800';
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800';
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:pb-8">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" />
            <span className="truncate text-base font-extrabold tracking-tight text-blue-700 dark:text-blue-400">
              MAJDOOR MITRA
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold">
            {(
              [
                ['HOME', t(lang, 'navOverview')],
                ['CALENDAR', t(lang, 'navCalendar')],
                ['LEDGER', t(lang, 'navLedger')],
                ['LEAVE', t(lang, 'navLeave')],
              ] as Array<[WorkerTab, string]>
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 py-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-700 text-blue-700 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {label}
                {tab === 'LEAVE' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton lang={lang} />
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
            >
              <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>{lang === 'hi' ? 'EN' : 'हि'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-orange-400" /> : <Moon className="h-4 w-4 text-blue-700" />}
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-red-950/40 whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t(lang, 'logout')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Toast & Offline Sync Bar */}
      {toast && (
        <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
            {toast}
          </div>
        </div>
      )}

      {(!isOnline || pendingSyncCount > 0) && (
        <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-200">
            <span>{!isOnline ? t(lang, 'offlineBanner') : `${pendingSyncCount} ${t(lang, 'pendingSync')}`}</span>
            {isOnline && pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={onSyncOffline}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t(lang, 'syncNow')}
              </button>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Account & Employer Switcher Strip */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={selectedProfile?.photo_url || user.avatar_url || '/src/assets/images/avatar_worker_portrait_1795110250643.jpg'}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="h-16 w-16 rounded-2xl border border-slate-200 object-cover dark:border-slate-700 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{mode === 'demo' ? t(lang, 'demoBadge') : t(lang, 'prodModeLabel')}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
                  {selectedProfile?.unique_worker_id || `MM-MOB-${user.mobile.slice(-4)}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">+91 {user.mobile}</span>
              </div>
              <h1 className="mt-1 truncate text-xl font-extrabold text-slate-900 dark:text-white">
                {selectedProfile?.name || user.name}
              </h1>
              {selectedProfile && (
                <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
                  {selectedProfile.skill_role} · {selectedProfile.business_name}
                  {selectedProfile.site_name ? ` (${selectedProfile.site_name})` : ''}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {profiles.length > 1 && (
              <select
                value={selectedProfile?.id || ''}
                onChange={(e) => setSelectedWorkerId(Number(e.target.value))}
                aria-label="Select Employer"
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.business_name} ({p.site_name || 'Site'})
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Select Month"
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
            ))}
          </div>
        ) : !selectedProfile ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <UserCheck className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              {lang === 'hi' ? 'मालिक से जुड़ने की प्रतीक्षा' : 'Awaiting Employer Link'}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t(lang, 'noWorkerProfileYet')}
            </p>
            <p className="mt-4 font-mono text-base font-bold text-blue-700 dark:text-blue-400">
              +91 {user.mobile}
            </p>
          </div>
        ) : (
          <>
            {/* TAB 1: HOME OVERVIEW */}
            {activeTab === 'HOME' && salary && (
              <div className="space-y-6">
                {/* 4 Primary KPI Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t(lang, 'totalSalary')} ({month})
                    </p>
                    <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-blue-700 dark:text-blue-400">
                      {formatINR(salary.total_salary)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {salary.total_working_days} {lang === 'hi' ? 'दिन' : 'days'} · {salary.overtime_hours}h OT
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t(lang, 'advanceTaken')}
                    </p>
                    <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                      {formatINR(salary.advance_total)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {lang === 'hi' ? 'कुल मिलाकर:' : 'All-time:'} {formatINR(allTimeBalance?.total_advances || 0)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {t(lang, 'paidReceived')}
                    </p>
                    <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatINR(salary.paid_total)}
                    </p>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {lang === 'hi' ? 'कुल प्राप्त:' : 'All-time:'} {formatINR(allTimeBalance?.total_paid || 0)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-5 dark:border-orange-900/60 dark:bg-orange-950/30">
                    <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                      {t(lang, 'remainingBalance')}
                    </p>
                    <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-400">
                      {formatINR(salary.remaining_balance)}
                    </p>
                    <p className="mt-1.5 text-xs text-orange-700/90 dark:text-orange-300/80 tabular-nums">
                      {lang === 'hi' ? 'कुल बकाया:' : 'All-time Due:'} {formatINR(allTimeBalance?.remaining_balance || 0)}
                    </p>
                  </div>
                </div>

                {/* Today Status + GPS Check-in + Quick Exports */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? 'आज की स्थिति व GPS हाज़िरी' : "Today's Status & GPS Check-In"}
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                          {todayStr} · {selectedProfile.wage_type === 'MONTHLY'
                            ? `${formatINR(selectedProfile.monthly_salary)}/mo (${formatINR(selectedProfile.effective_daily_wage)}/day)`
                            : `${formatINR(selectedProfile.daily_wage)}/day`}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        {lang === 'hi' ? 'सुरक्षित रीड-ओनली रिकॉर्ड' : 'Employer-Verified Records'}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                      <div>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {lang === 'hi' ? 'आज की हाज़िरी' : "Today's Attendance"}
                        </p>
                        {todayRecord ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                            <span className={`inline-block rounded-lg border px-2.5 py-1 text-sm font-bold ${statusColorClass(todayRecord.status)}`}>
                              {statusLabel(todayRecord.status)}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {todayRecord.hours_worked}h {todayRecord.overtime_hours > 0 ? `(+${todayRecord.overtime_hours}h OT)` : ''}
                            </span>
                          </div>
                        ) : (
                          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {lang === 'hi' ? 'अभी तक दर्ज नहीं हुई' : 'Not marked yet today'}
                          </p>
                        )}
                      </div>

                      {!todayRecord && (
                        <button
                          type="button"
                          onClick={handleGpsCheckIn}
                          disabled={gpsLoading || !isOnline}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
                        >
                          <MapPin className="h-4 w-4" />
                          <span>{gpsLoading ? (lang === 'hi' ? 'लोकेशन जांच...' : 'Checking GPS...') : t(lang, 'gpsCheckIn')}</span>
                        </button>
                      )}
                    </div>

                    {/* Smart Salary Formula Breakdown */}
                    <div className="mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? 'पारदर्शी वेतन गणना (Salary Formula)' : 'Transparent Salary Breakdown'}
                        </h3>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 whitespace-nowrap"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          <span>{t(lang, 'shareWhatsapp')}</span>
                        </a>
                      </div>
                      <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">
                            {t(lang, 'attendanceEarnings')} ({salary.present_days}P, {salary.half_days}H, {salary.paid_leave_days}L)
                          </span>
                          <span className="font-mono font-semibold tabular-nums">{formatINR(salary.attendance_earnings)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">
                            {t(lang, 'overtimeEarnings')} ({salary.overtime_hours} hrs)
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                            + {formatINR(salary.overtime_earnings)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{t(lang, 'bonus')}</span>
                          <span className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            + {formatINR(salary.bonus_total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{t(lang, 'deduction')}</span>
                          <span className="font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">
                            - {formatINR(salary.deduction_total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-blue-50/60 px-4 py-3 text-sm font-bold dark:bg-blue-950/30">
                          <span>{t(lang, 'totalSalary')}</span>
                          <span className="font-mono text-base tabular-nums text-blue-700 dark:text-blue-400">
                            {formatINR(salary.total_salary)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-600 dark:text-slate-300">
                            {t(lang, 'advanceTaken')} + {t(lang, 'paidReceived')}
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            - {formatINR(salary.advance_total + salary.paid_total)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-orange-50/80 px-4 py-3 text-sm font-extrabold dark:bg-orange-950/30">
                          <span className="text-orange-900 dark:text-orange-200">{t(lang, 'remainingBalance')}</span>
                          <span className="font-mono text-base tabular-nums text-orange-700 dark:text-orange-400">
                            {formatINR(salary.remaining_balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Statements & Recent Alerts */}
                  <div className="space-y-6 lg:col-span-5">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {lang === 'hi' ? 'मासिक स्टेटमेंट व शेयर' : 'Salary Statement & Share'}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {lang === 'hi'
                          ? 'अपनी पूरी मासिक पर्ची PDF में डाउनलोड करें या WhatsApp पर भेजें।'
                          : 'Download your itemized monthly salary slip as PDF or share on WhatsApp.'}
                      </p>
                      <div className="mt-4 space-y-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            downloadSalarySlipPDF({
                              worker: selectedProfile,
                              employerName: selectedProfile.business_name || 'Employer',
                              month,
                              salary,
                              attendance,
                              transactions,
                            })
                          }
                          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
                        >
                          <FileDown className="h-4 w-4" />
                          <span>{t(lang, 'downloadPdf')}</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2.5">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>{t(lang, 'shareWhatsapp')}</span>
                          </a>
                          <button
                            type="button"
                            onClick={handleCopyWhatsApp}
                            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <Copy className="h-4 w-4" />
                            <span>{lang === 'hi' ? 'कॉपी करें' : 'Copy Text'}</span>
                          </button>
                        </div>

                        {whatsappMessage && (
                          <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                            <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                              {lang === 'hi' ? 'WhatsApp संदेश पूर्वावलोकन देखें' : 'Preview WhatsApp Message'}
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-slate-600 dark:text-slate-300">
                              {whatsappMessage}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? 'ताज़ा सूचनाएं' : 'Recent Notifications'}
                        </h2>
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkNotificationsRead}
                            className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {lang === 'hi' ? 'सभी पढ़ा मानें' : 'Mark all read'}
                          </button>
                        )}
                      </div>
                      <div className="mt-4 space-y-3">
                        {notifications.slice(0, 4).map((n) => (
                          <div
                            key={n.id}
                            className={`rounded-xl border p-3.5 text-sm ${
                              n.is_read
                                ? 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/30'
                                : 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/40'
                            }`}
                          >
                            <p className="font-bold text-slate-900 dark:text-white">
                              {lang === 'hi' ? n.title_hi : n.title_en}
                            </p>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                              {lang === 'hi' ? n.message_hi : n.message_en}
                            </p>
                          </div>
                        ))}
                        {notifications.length === 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {lang === 'hi' ? 'कोई नई सूचना नहीं है।' : 'No notifications yet.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MONTHLY ATTENDANCE CALENDAR */}
            {activeTab === 'CALENDAR' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? `मासिक हाज़िरी कैलेंडर (${month})` : `Monthly Attendance Calendar (${month})`}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> P</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> H</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" /> L</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> A</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d} className="py-1.5">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((cell, idx) => {
                      if (!cell.day) return <div key={`empty-${idx}`} className="h-16 sm:h-20" />;
                      const rec = cell.record;
                      const badge =
                        rec?.status === 'PRESENT'
                          ? 'P'
                          : rec?.status === 'HALF_DAY'
                          ? 'H'
                          : rec?.status === 'PAID_LEAVE'
                          ? 'L'
                          : rec?.status === 'ABSENT'
                          ? 'A'
                          : '';

                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => rec && setSelectedDayRecord(rec)}
                          className={`flex h-16 flex-col items-center justify-between rounded-xl border p-1.5 text-left transition-colors sm:h-20 ${
                            rec
                              ? `${statusColorClass(rec.status)} hover:opacity-90`
                              : 'border-slate-200 bg-slate-50/50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/30'
                          }`}
                        >
                          <span className="self-start font-mono text-xs font-bold tabular-nums">{cell.day}</span>
                          {rec && (
                            <div className="text-center">
                              <span className="block text-sm font-extrabold">{badge}</span>
                              {rec.overtime_hours > 0 && (
                                <span className="block font-mono text-[10px] font-semibold">+{rec.overtime_hours}h</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Day Detail & Edit History Panel */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:col-span-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {lang === 'hi' ? 'चयनित दिन का विवरण' : 'Day Attendance Details'}
                  </h3>
                  {selectedDayRecord ? (
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'दिनांक' : 'Date'}</span>
                        <span className="font-mono font-bold">{selectedDayRecord.date}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'स्थिति' : 'Status'}</span>
                        <span className="font-bold">{statusLabel(selectedDayRecord.status)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'कार्य घंटे' : 'Hours Worked'}</span>
                        <span className="font-mono font-bold">{selectedDayRecord.hours_worked}h</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'ओवरटाइम' : 'Overtime'}</span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          {selectedDayRecord.overtime_hours}h
                        </span>
                      </div>
                      {selectedDayRecord.edit_reason && (
                        <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          <strong>{lang === 'hi' ? 'सुधार कारण:' : 'Correction Reason:'}</strong> {selectedDayRecord.edit_reason}
                        </div>
                      )}
                      {(() => {
                        try {
                          const hist = JSON.parse(selectedDayRecord.edit_history_json || '[]') as Array<{
                            editedAt: string;
                            editedBy: string;
                            oldStatus: string;
                            newStatus: string;
                            reason: string;
                          }>;
                          if (hist.length === 0) return null;
                          return (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                {lang === 'hi' ? 'संशोधन इतिहास' : 'Edit History'}
                              </p>
                              {hist.map((h, i) => (
                                <div key={i} className="rounded-lg border border-slate-200 p-2.5 text-xs dark:border-slate-700">
                                  <p className="font-semibold">{h.oldStatus} → {h.newStatus}</p>
                                  <p className="text-slate-500 dark:text-slate-400">{h.reason}</p>
                                </div>
                              ))}
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                      {lang === 'hi'
                        ? 'किसी भी तारीख पर टैप करके उसके घंटे, ओवरटाइम और संशोधन इतिहास देखें।'
                        : 'Tap any marked date on the calendar to inspect working hours, overtime, and correction history.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: COMPLETE TRANSACTION LEDGER */}
            {activeTab === 'LEDGER' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? `पूरा लेन-देन इतिहास (${month})` : `Complete Transaction History (${month})`}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {lang === 'hi'
                        ? 'अग्रिम, वेतन भुगतान, बोनस और कटौती का स्थायी रिकॉर्ड'
                        : 'Permanent audit-verified record of advances, payments, bonuses, and deductions'}
                    </p>
                  </div>
                  {salary && (
                    <button
                      type="button"
                      onClick={() =>
                        downloadSalarySlipPDF({
                          worker: selectedProfile,
                          employerName: selectedProfile.business_name || 'Employer',
                          month,
                          salary,
                          attendance,
                          transactions,
                        })
                      }
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>PDF</span>
                    </button>
                  )}
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <th className="py-3 pr-4">{lang === 'hi' ? 'दिनांक व समय' : 'Date & Time'}</th>
                        <th className="py-3 pr-4">{lang === 'hi' ? 'श्रेणी' : 'Category'}</th>
                        <th className="py-3 pr-4">{lang === 'hi' ? 'माध्यम' : 'Mode'}</th>
                        <th className="py-3 pr-4">{lang === 'hi' ? 'विवरण' : 'Description'}</th>
                        <th className="py-3 text-right">{lang === 'hi' ? 'राशि' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {transactions.map((tx) => (
                        <tr key={`${tx.category}-${tx.id}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-3.5 pr-4 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-300">
                            {tx.date} · {tx.time}
                          </td>
                          <td className="py-3.5 pr-4 font-semibold">
                            <span
                              className={
                                tx.category === 'PAYMENT'
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : tx.category === 'ADVANCE'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : tx.category === 'BONUS'
                                  ? 'text-blue-700 dark:text-blue-400'
                                  : 'text-red-700 dark:text-red-400'
                              }
                            >
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-slate-600 dark:text-slate-300">{tx.mode}</td>
                          <td className="py-3.5 pr-4 text-slate-700 dark:text-slate-200">
                            {tx.description}
                            {tx.reference_no ? ` (${tx.reference_no})` : ''}
                          </td>
                          <td className="py-3.5 text-right font-mono font-bold tabular-nums">
                            {formatINR(tx.amount)}
                          </td>
                        </tr>
                      ))}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                            {lang === 'hi' ? 'इस महीने कोई लेन-देन दर्ज नहीं है।' : 'No transactions recorded for this month.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: LEAVE REQUESTS & NOTIFICATIONS */}
            {activeTab === 'LEAVE' && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {t(lang, 'submitLeave')}
                  </h2>
                  <form onSubmit={handleLeaveSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {lang === 'hi' ? 'कब से' : 'From Date'}
                        </label>
                        <input
                          type="date"
                          required
                          value={leaveFrom}
                          onChange={(e) => setLeaveFrom(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {lang === 'hi' ? 'कब तक' : 'To Date'}
                        </label>
                        <input
                          type="date"
                          required
                          value={leaveTo}
                          onChange={(e) => setLeaveTo(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {lang === 'hi' ? 'छुट्टी का कारण' : 'Reason for Leave'}
                      </label>
                      <textarea
                        rows={3}
                        required
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        placeholder={lang === 'hi' ? 'जैसे: घर में जरूरी काम / तबीयत खराब' : 'e.g. Family function or medical checkup'}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submittingLeave}
                      className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      <span>{t(lang, 'submitLeave')}</span>
                    </button>
                  </form>

                  <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'मेरे छुट्टी आवेदन' : 'My Leave Requests'}
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {leaveRequests.map((lr) => (
                        <div key={lr.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold">{lr.from_date} → {lr.to_date}</span>
                            <span
                              className={`text-xs font-bold ${
                                lr.status === 'APPROVED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : lr.status === 'REJECTED'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {lr.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{lr.reason}</p>
                        </div>
                      ))}
                      {leaveRequests.length === 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lang === 'hi' ? 'अभी कोई छुट्टी आवेदन नहीं भेजा गया है।' : 'No leave requests submitted yet.'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'मालिक की ओर से सूचनाएं' : 'Employer Notifications'}
                    </h2>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkNotificationsRead}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                      >
                        {lang === 'hi' ? 'सभी पढ़ा चिह्नित करें' : 'Mark all read'}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-xl border p-4 ${
                          n.is_read
                            ? 'border-slate-200 bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/30'
                            : 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-slate-900 dark:text-white">
                            {lang === 'hi' ? n.title_hi : n.title_en}
                          </p>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {n.created_at.slice(0, 16)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {lang === 'hi' ? n.message_hi : n.message_en}
                        </p>
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                        {lang === 'hi' ? 'कोई सूचना नहीं है।' : 'No notifications yet.'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="mt-6">
          <AboutAppCard
            lang={lang}
            founderName={appSettings?.founderName || 'Raja'}
            supportContact={appSettings?.supportContact}
          />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar (Thumb Zone) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden pb-safe">
        <div className="grid h-16 grid-cols-4 items-center">
          {(
            [
              ['HOME', IndianRupee, lang === 'hi' ? 'होम' : 'Home'],
              ['CALENDAR', CalendarIcon, lang === 'hi' ? 'कैलेंडर' : 'Calendar'],
              ['LEDGER', Wallet, lang === 'hi' ? 'हिसाब' : 'Ledger'],
              ['LEAVE', Bell, lang === 'hi' ? 'सूचना' : 'Alerts'],
            ] as Array<[WorkerTab, React.FC<{ className?: string }>, string]>
          ).map(([tab, Icon, label]) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
                {tab === 'LEAVE' && unreadCount > 0 && (
                  <span className="absolute right-4 top-2 rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
