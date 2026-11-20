import {
  Building2,
  CalendarCheck,
  Check,
  Clock,
  Copy,
  CreditCard,
  DatabaseBackup,
  Edit3,
  FileDown,
  FileSpreadsheet,
  Filter,
  HardHat,
  History,
  IndianRupee,
  Languages,
  LogOut,
  MapPin,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatINR, t } from '../i18n';
import type {
  AppSettings,
  AttendanceRecord,
  AttendanceStatus,
  AuditLogItem,
  DbMode,
  EmployerProfile,
  Language,
  LeaveRequestItem,
  ReportRow,
  SiteExpense,
  ThemeMode,
  TransactionItem,
  UserProfile,
  WorkSite,
  WorkerWithStats,
} from '../types';
import { apiFetch, enqueueOfflineItem } from '../utils/api';
import {
  buildWhatsAppReportRowText,
  buildWhatsAppShareUrl,
  buildWhatsAppStatementText,
  downloadOwnerReportExcel,
  downloadOwnerReportPDF,
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
  onUserUpdated: (user: UserProfile) => void;
}

type OwnerTab = 'ATTENDANCE' | 'WORKERS' | 'ACCOUNTS' | 'REPORTS' | 'SETTINGS';

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const OwnerDashboard: React.FC<Props> = ({
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
  onUserUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<OwnerTab>('ATTENDANCE');
  const [selectedDate, setSelectedDate] = useState(todayYmd());
  const [selectedMonth, setSelectedMonth] = useState(() => todayYmd().slice(0, 7));
  const [siteFilter, setSiteFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [sites, setSites] = useState<WorkSite[]>([]);
  const [workers, setWorkers] = useState<WorkerWithStats[]>([]);
  const [monthAttendance, setMonthAttendance] = useState<AttendanceRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [expenses, setExpenses] = useState<SiteExpense[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Reports State
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportRange, setReportRange] = useState({ startDate: '', endDate: '', siteExpenses: 0 });

  // Modals
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerWithStats | null>(null);
  const [wName, setWName] = useState('');
  const [wMobile, setWMobile] = useState('');
  const [wSkill, setWSkill] = useState('राजमिस्त्री (Mason)');
  const [wSiteId, setWSiteId] = useState<string>('');
  const [wWageType, setWWageType] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [wDailyWage, setWDailyWage] = useState('650');
  const [wMonthlySalary, setWMonthlySalary] = useState('18000');
  const [wOtRate, setWOtRate] = useState('90');
  const [wPhoto, setWPhoto] = useState('');

  // Attendance Edit Reason Modal
  const [attModal, setAttModal] = useState<{
    worker: WorkerWithStats;
    status: AttendanceStatus;
    existing: AttendanceRecord | null;
  } | null>(null);
  const [attOvertime, setAttOvertime] = useState('0');
  const [attEditReason, setAttEditReason] = useState('');
  const [attUseGps, setAttUseGps] = useState(false);

  // Financial Transaction Modal
  const [txModal, setTxModal] = useState<'PAYMENT' | 'ADVANCE' | 'BONUS' | 'DEDUCTION' | 'EXPENSE' | null>(null);
  const [txWorkerId, setTxWorkerId] = useState<string>('');
  const [txSiteId, setTxSiteId] = useState<string>('');
  const [txAmount, setTxAmount] = useState('');
  const [txMode, setTxMode] = useState<'CASH' | 'UPI' | 'BANK'>('UPI');
  const [txRef, setTxRef] = useState('');
  const [txDate, setTxDate] = useState(todayYmd());
  const [txNote, setTxNote] = useState('');
  const [txCategory, setTxCategory] = useState('Material & Tools');

  // Site Modal
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [sName, setSName] = useState('');
  const [sLocation, setSLocation] = useState('');
  const [sLat, setSLat] = useState('');
  const [sLng, setSLng] = useState('');
  const [sRadius, setSRadius] = useState('500');

  // Worker Statement Detail Drawer
  const [inspectWorker, setInspectWorker] = useState<WorkerWithStats | null>(null);

  // Settings Form
  const [orgNameInput, setOrgNameInput] = useState('');
  const [ownerNameInput, setOwnerNameInput] = useState(user.name);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ month: selectedMonth, date: selectedDate });
      const [dash, txRes] = await Promise.all([
        apiFetch<{
          employer: EmployerProfile;
          sites: WorkSite[];
          workers: WorkerWithStats[];
          monthAttendance: AttendanceRecord[];
          expenses: SiteExpense[];
          leaveRequests: LeaveRequestItem[];
          auditLogs: AuditLogItem[];
        }>(`/api/owner/dashboard?${qs.toString()}`),
        apiFetch<{ transactions: TransactionItem[] }>(`/api/owner/transactions?month=${selectedMonth}`),
      ]);

      setEmployer(dash.employer);
      setOrgNameInput(dash.employer.business_name);
      setOwnerNameInput(dash.employer.owner_name);
      setSites(dash.sites);
      setWorkers(dash.workers);
      setMonthAttendance(dash.monthAttendance);
      setExpenses(dash.expenses);
      setLeaveRequests(dash.leaveRequests);
      setAuditLogs(dash.auditLogs);
      setTransactions(txRes.transactions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const loadReport = useCallback(async () => {
    try {
      const qs = new URLSearchParams({
        type: reportPeriod,
        date: selectedDate,
        month: selectedMonth,
      });
      if (siteFilter !== 'ALL') qs.set('siteId', siteFilter);
      const data = await apiFetch<{
        startDate: string;
        endDate: string;
        rows: ReportRow[];
        siteExpenses: number;
      }>(`/api/owner/reports?${qs.toString()}`);
      setReportRows(data.rows);
      setReportRange({ startDate: data.startDate, endDate: data.endDate, siteExpenses: data.siteExpenses });
    } catch {
      // ignore
    }
  }, [reportPeriod, selectedDate, selectedMonth, siteFilter]);

  useEffect(() => {
    if (activeTab === 'REPORTS') {
      loadReport();
    }
  }, [activeTab, loadReport]);

  const filteredWorkers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workers.filter((w) => {
      if (siteFilter !== 'ALL' && String(w.site_id || '') !== siteFilter) return false;
      if (q) {
        return (
          w.name.toLowerCase().includes(q) ||
          w.unique_worker_id.toLowerCase().includes(q) ||
          w.mobile.includes(q) ||
          w.skill_role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workers, siteFilter, searchQuery]);

  const totals = useMemo(() => {
    return workers.reduce(
      (acc, w) => {
        const st = w.today_attendance?.status;
        if (st === 'PRESENT') acc.present++;
        else if (st === 'HALF_DAY') acc.half++;
        else if (st === 'PAID_LEAVE') acc.leave++;
        else if (st === 'ABSENT') acc.absent++;

        acc.monthSalary += w.month_salary?.total_salary || 0;
        acc.monthAdvances += w.month_salary?.advance_total || 0;
        acc.monthPaid += w.month_salary?.paid_total || 0;
        acc.pendingBalance += w.all_time_balance?.remaining_balance || 0;
        return acc;
      },
      { present: 0, half: 0, leave: 0, absent: 0, monthSalary: 0, monthAdvances: 0, monthPaid: 0, pendingBalance: 0 }
    );
  }, [workers]);

  // Worker Add / Edit
  const openAddWorker = () => {
    setEditingWorker(null);
    setWName('');
    setWMobile('');
    setWSkill('राजमिस्त्री (Mason)');
    setWSiteId(sites[0] ? String(sites[0].id) : '');
    setWWageType('DAILY');
    setWDailyWage('650');
    setWMonthlySalary('18000');
    setWOtRate('90');
    setWPhoto('');
    setWorkerModalOpen(true);
  };

  const openEditWorker = (w: WorkerWithStats) => {
    setEditingWorker(w);
    setWName(w.name);
    setWMobile(w.mobile);
    setWSkill(w.skill_role);
    setWSiteId(w.site_id ? String(w.site_id) : '');
    setWWageType(w.wage_type);
    setWDailyWage(String(w.daily_wage));
    setWMonthlySalary(String(w.monthly_salary));
    setWOtRate(String(w.overtime_rate));
    setWPhoto(w.photo_url);
    setWorkerModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setWPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: wName,
        mobile: wMobile,
        skillRole: wSkill,
        siteId: wSiteId ? Number(wSiteId) : null,
        wageType: wWageType,
        dailyWage: Number(wDailyWage),
        monthlySalary: Number(wMonthlySalary),
        overtimeRate: Number(wOtRate),
        photoUrl: wPhoto,
      };
      if (editingWorker) {
        await apiFetch(`/api/owner/workers/${editingWorker.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast(lang === 'hi' ? 'मजदूर प्रोफाइल अपडेट हुई।' : 'Worker profile updated.');
      } else {
        await apiFetch('/api/owner/workers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast(lang === 'hi' ? 'नया मजदूर जोड़ा गया।' : 'New worker added.');
      }
      setWorkerModalOpen(false);
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save worker');
    }
  };

  const handleDeleteWorker = async (w: WorkerWithStats) => {
    try {
      await apiFetch(`/api/owner/workers/${w.id}`, { method: 'DELETE' });
      showToast(lang === 'hi' ? 'मजदूर हटाया गया।' : 'Worker removed.');
      setInspectWorker(null);
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Attendance Actions
  const handleQuickAttendance = async (w: WorkerWithStats, status: AttendanceStatus) => {
    const existing = w.today_attendance;
    if (existing) {
      // Require edit reason & allow OT edit
      setAttModal({ worker: w, status, existing });
      setAttOvertime(String(existing.overtime_hours || 0));
      setAttEditReason('');
      setAttUseGps(false);
      return;
    }
    await submitAttendance(w.id, status, 0, '', false);
  };

  const submitAttendance = async (
    workerId: number,
    status: AttendanceStatus,
    overtimeHours: number,
    editReason: string,
    useGps: boolean
  ) => {
    let gpsLat: number | null = null;
    let gpsLng: number | null = null;

    if (useGps && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
        );
        gpsLat = pos.coords.latitude;
        gpsLng = pos.coords.longitude;
      } catch {
        // Proceed without GPS if denied
      }
    }

    const payload = {
      workerId,
      date: selectedDate,
      status,
      overtimeHours,
      editReason,
      gpsLat,
      gpsLng,
    };

    try {
      if (!isOnline) {
        enqueueOfflineItem({ type: 'ATTENDANCE', payload });
        showToast(lang === 'hi' ? 'ऑफलाइन हाज़िरी सेव हुई।' : 'Attendance saved offline.');
        setAttModal(null);
        return;
      }
      await apiFetch('/api/owner/attendance', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAttModal(null);
      showToast(lang === 'hi' ? 'हाज़िरी दर्ज हुई और मजदूर को सूचना भेजी गई।' : 'Attendance saved & worker notified.');
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Attendance save failed');
    }
  };

  const handleBulkPresent = async () => {
    const entries = filteredWorkers
      .filter((w) => !w.today_attendance)
      .map((w) => ({ workerId: w.id, date: selectedDate, status: 'PRESENT', overtimeHours: 0 }));
    if (entries.length === 0) {
      showToast(lang === 'hi' ? 'सभी मजदूरों की हाज़िरी पहले से दर्ज है।' : 'All filtered workers already marked.');
      return;
    }
    try {
      await apiFetch('/api/owner/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
      showToast(lang === 'hi' ? `${entries.length} मजदूर उपस्थित चिह्नित हुए।` : `${entries.length} workers marked Present.`);
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Bulk mark failed');
    }
  };

  // Financial Transactions Submit
  const openTxModal = (type: 'PAYMENT' | 'ADVANCE' | 'BONUS' | 'DEDUCTION' | 'EXPENSE', preWorkerId?: number) => {
    setTxModal(type);
    setTxWorkerId(preWorkerId ? String(preWorkerId) : workers[0] ? String(workers[0].id) : '');
    setTxSiteId(sites[0] ? String(sites[0].id) : '');
    setTxAmount('');
    setTxMode('UPI');
    setTxRef('');
    setTxDate(todayYmd());
    setTxNote('');
    setTxCategory('Material & Tools');
  };

  const handleTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txModal) return;
    const amt = Number(txAmount);
    if (!(amt > 0)) return;

    try {
      if (txModal === 'PAYMENT') {
        const payload = {
          workerId: Number(txWorkerId),
          amount: amt,
          paymentMode: txMode,
          referenceNo: txRef,
          date: txDate,
          description: txNote || 'Salary Payment',
        };
        if (!isOnline) enqueueOfflineItem({ type: 'PAYMENT', payload });
        else await apiFetch('/api/owner/payments', { method: 'POST', body: JSON.stringify(payload) });
      } else if (txModal === 'ADVANCE') {
        const payload = {
          workerId: Number(txWorkerId),
          amount: amt,
          paymentMode: txMode,
          date: txDate,
          reason: txNote || 'Advance Payment',
        };
        if (!isOnline) enqueueOfflineItem({ type: 'ADVANCE', payload });
        else await apiFetch('/api/owner/advances', { method: 'POST', body: JSON.stringify(payload) });
      } else if (txModal === 'BONUS') {
        await apiFetch('/api/owner/bonuses', {
          method: 'POST',
          body: JSON.stringify({ workerId: Number(txWorkerId), amount: amt, date: txDate, reason: txNote }),
        });
      } else if (txModal === 'DEDUCTION') {
        await apiFetch('/api/owner/deductions', {
          method: 'POST',
          body: JSON.stringify({ workerId: Number(txWorkerId), amount: amt, date: txDate, reason: txNote }),
        });
      } else if (txModal === 'EXPENSE') {
        const payload = {
          siteId: txSiteId ? Number(txSiteId) : null,
          category: txCategory,
          amount: amt,
          date: txDate,
          description: txNote,
        };
        if (!isOnline) enqueueOfflineItem({ type: 'EXPENSE', payload });
        else await apiFetch('/api/owner/expenses', { method: 'POST', body: JSON.stringify(payload) });
      }

      setTxModal(null);
      showToast(lang === 'hi' ? 'लेन-देन सफलतापूर्वक सेव हुआ।' : 'Transaction recorded successfully.');
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  // Work Site Save
  const handleUseCurrentGpsForSite = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSLat(pos.coords.latitude.toFixed(6));
        setSLng(pos.coords.longitude.toFixed(6));
      },
      () => showToast(lang === 'hi' ? 'GPS लोकेशन नहीं मिल सकी।' : 'Unable to capture GPS coordinates.')
    );
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/owner/sites', {
        method: 'POST',
        body: JSON.stringify({
          name: sName,
          location: sLocation,
          latitude: sLat,
          longitude: sLng,
          radiusMeters: Number(sRadius) || 500,
        }),
      });
      setSiteModalOpen(false);
      setSName('');
      setSLocation('');
      setSLat('');
      setSLng('');
      showToast(lang === 'hi' ? 'नई साइट जोड़ी गई।' : 'Work site added.');
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create site');
    }
  };

  const handleLeaveAction = async (leaveId: number, status: 'APPROVED' | 'REJECTED', markPaidLeave: boolean) => {
    try {
      await apiFetch(`/api/owner/leave-requests/${leaveId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, markPaidLeave }),
      });
      showToast(lang === 'hi' ? 'छुट्टी की स्थिति अपडेट हुई।' : `Leave ${status.toLowerCase()}.`);
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Action failed');
    }
  };

  // Backup & Restore
  const handleDownloadBackup = async () => {
    try {
      const data = await apiFetch('/api/owner/backup/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MajdoorMitra_Backup_${todayYmd()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(lang === 'hi' ? 'बैकअप फ़ाइल डाउनलोड हो गई।' : 'Backup JSON downloaded.');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Backup export failed');
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await apiFetch('/api/owner/backup/restore', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      showToast(lang === 'hi' ? 'बैकअप सफलतापूर्वक रीस्टोर हुआ।' : 'Backup restored successfully.');
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Invalid backup file');
    }
  };

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ name: ownerNameInput, businessName: orgNameInput }),
      });
      onUserUpdated(res.user);
      showToast(lang === 'hi' ? 'सेटिंग्स सेव हुईं।' : 'Settings updated.');
      loadDashboard();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:pb-0">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-blue-700 dark:text-blue-400">
                MAJDOOR MITRA
              </span>
            </div>
          </div>

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

      {/* Alerts & Offline Sync */}
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

      {/* Workspace Layout: Sidebar on Desktop + Main Content */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {mode === 'demo' ? t(lang, 'demoBadge') : t(lang, 'prodModeLabel')}
              </p>
              <p className="mt-1 truncate text-base font-extrabold text-slate-900 dark:text-white">
                {employer?.business_name || user.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {employer?.owner_name} · +91 {user.mobile}
              </p>
            </div>

            <nav className="mt-4 space-y-1.5">
              {(
                [
                  ['ATTENDANCE', CalendarCheck, t(lang, 'navOverview')],
                  ['WORKERS', Users, t(lang, 'navWorkers')],
                  ['ACCOUNTS', IndianRupee, t(lang, 'navAccounts')],
                  ['REPORTS', FileSpreadsheet, t(lang, 'navSitesReports')],
                  ['SETTINGS', Settings, t(lang, 'navSettings')],
                ] as Array<[OwnerTab, React.FC<{ className?: string }>, string]>
              ).map(([tab, Icon, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-6 border-t border-slate-100 pt-4 space-y-2 dark:border-slate-800">
              <button
                type="button"
                onClick={openAddWorker}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700"
              >
                <Plus className="h-4 w-4" />
                <span>{t(lang, 'addWorker')}</span>
              </button>
              <button
                type="button"
                onClick={() => openTxModal('PAYMENT')}
                className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
              >
                <CreditCard className="h-4 w-4" />
                <span>{t(lang, 'recordPayment')}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <div className="min-w-0 flex-1 space-y-6">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Top KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'कुल मजदूर' : 'Total Workers'}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                {workers.length}
              </p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                {totals.present} {lang === 'hi' ? 'उपस्थित' : 'Present'} · {totals.half} {lang === 'hi' ? 'आधा' : 'Half'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? `मासिक कुल वेतन (${selectedMonth})` : `Monthly Payroll (${selectedMonth})`}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-blue-700 dark:text-blue-400">
                {formatINR(totals.monthSalary)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {sites.length} {lang === 'hi' ? 'कार्य साइट' : 'Work Sites'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {lang === 'hi' ? 'भुगतान व अग्रिम' : 'Paid & Advances'}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatINR(totals.monthPaid + totals.monthAdvances)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {lang === 'hi' ? 'अग्रिम:' : 'Adv:'} {formatINR(totals.monthAdvances)}
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900/50 dark:bg-orange-950/30">
              <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                {lang === 'hi' ? 'कुल बकाया भुगतान' : 'Pending Payouts'}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-extrabold tabular-nums text-orange-700 dark:text-orange-400">
                {formatINR(totals.pendingBalance)}
              </p>
              <p className="mt-1 text-xs text-orange-700/80 dark:text-orange-300/80 tabular-nums">
                {leaveRequests.filter((l) => l.status === 'PENDING').length} {lang === 'hi' ? 'छुट्टी आवेदन' : 'Leave Requests'}
              </p>
            </div>
          </div>

          {/* Search, Date & Site Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={lang === 'hi' ? 'मजदूर नाम या यूनिक आईडी खोजें' : 'Search by worker name or unique ID'}
                placeholder={lang === 'hi' ? 'नाम, यूनिक आईडी (MM-...) या मोबाइल खोजें...' : 'Search by worker name, unique ID (MM-...), or mobile...'}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={lang === 'hi' ? 'खोज साफ़ करें' : 'Clear search'}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-800">
                <Filter className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  aria-label="Filter by work site"
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none dark:text-white"
                >
                  <option value="ALL">{lang === 'hi' ? 'सभी साइट' : 'All Sites'}</option>
                  {sites.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedMonth(e.target.value.slice(0, 7));
                }}
                aria-label="Attendance Date"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold tabular-nums text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Billing Month"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold tabular-nums text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
              ))}
            </div>
          ) : (
            <>
              {/* TAB 1: DAILY ATTENDANCE & LEAVE APPROVALS */}
              {activeTab === 'ATTENDANCE' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? `दैनिक हाज़िरी रजिस्टर (${selectedDate})` : `Daily Attendance Register (${selectedDate})`}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lang === 'hi'
                            ? 'उपस्थित, आधा दिन, छुट्टी या अनुपस्थित चिह्नित करें। बदलाव करने पर कारण दर्ज होगा।'
                            : 'Mark Present, Half Day, Paid Leave, or Absent. Corrections preserve edit history with reason.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBulkPresent}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          <Check className="h-4 w-4" />
                          <span>{t(lang, 'markAllPresent')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={openAddWorker}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-orange-700 lg:hidden"
                        >
                          <Plus className="h-4 w-4" />
                          <span>{t(lang, 'addWorker')}</span>
                        </button>
                      </div>
                    </div>

                    {filteredWorkers.length === 0 ? (
                      <div className="py-10 text-center">
                        <HardHat className="mx-auto h-10 w-10 text-slate-400" />
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{t(lang, 'noWorkersYet')}</p>
                        <button
                          type="button"
                          onClick={openAddWorker}
                          className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                        >
                          <Plus className="h-4 w-4" />
                          <span>{t(lang, 'addWorker')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredWorkers.map((w) => {
                          const att = w.today_attendance;
                          const st = att?.status;
                          return (
                            <div
                              key={w.id}
                              className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <img
                                  src={w.photo_url || '/src/assets/images/avatar_worker_portrait_1795110250643.jpg'}
                                  alt={w.name}
                                  referrerPolicy="no-referrer"
                                  className="h-11 w-11 rounded-xl border border-slate-200 object-cover dark:border-slate-700 shrink-0"
                                />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setInspectWorker(w)}
                                    className="truncate text-left text-base font-bold text-slate-900 hover:text-blue-700 dark:text-white dark:hover:text-blue-400"
                                  >
                                    {w.name}
                                  </button>
                                  <p className="truncate text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                    {w.unique_worker_id} · {w.site_name || 'No Site'} · {formatINR(w.effective_daily_wage)}/day
                                    {att && att.overtime_hours > 0 ? ` · +${att.overtime_hours}h OT` : ''}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {(
                                  [
                                    ['PRESENT', lang === 'hi' ? 'उपस्थित' : 'P', 'bg-emerald-600 text-white border-emerald-600'],
                                    ['HALF_DAY', lang === 'hi' ? 'आधा' : 'H', 'bg-amber-500 text-white border-amber-500'],
                                    ['PAID_LEAVE', lang === 'hi' ? 'छुट्टी' : 'L', 'bg-blue-600 text-white border-blue-600'],
                                    ['ABSENT', lang === 'hi' ? 'ग़ैर' : 'A', 'bg-red-600 text-white border-red-600'],
                                  ] as Array<[AttendanceStatus, string, string]>
                                ).map(([code, label, activeCls]) => {
                                  const isSelected = st === code;
                                  return (
                                    <button
                                      key={code}
                                      type="button"
                                      onClick={() => handleQuickAttendance(w, code)}
                                      className={`min-h-[40px] min-w-[44px] rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                                        isSelected
                                          ? activeCls
                                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setAttModal({
                                      worker: w,
                                      status: st || 'PRESENT',
                                      existing: att,
                                    });
                                    setAttOvertime(String(att?.overtime_hours || 0));
                                    setAttEditReason(att ? '' : 'Overtime hours recorded');
                                    setAttUseGps(false);
                                  }}
                                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>+OT</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pending Leave Requests */}
                  {leaveRequests.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {lang === 'hi' ? 'मजदूर छुट्टी आवेदन' : 'Worker Leave Requests'}
                      </h3>
                      <div className="mt-4 space-y-3">
                        {leaveRequests.map((lr) => (
                          <div
                            key={lr.id}
                            className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">
                                {lr.worker_name} · <span className="font-mono text-xs text-blue-700 dark:text-blue-400">{lr.from_date} → {lr.to_date}</span>
                              </p>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{lr.reason}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {lr.status === 'PENDING' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleLeaveAction(lr.id, 'APPROVED', true)}
                                    className="min-h-[38px] rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                                  >
                                    {lang === 'hi' ? 'सवेतन मंजूर करें' : 'Approve Paid Leave'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLeaveAction(lr.id, 'REJECTED', false)}
                                    className="min-h-[38px] rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                                  >
                                    {lang === 'hi' ? 'अस्वीकार करें' : 'Reject'}
                                  </button>
                                </>
                              ) : (
                                <span
                                  className={`text-xs font-bold ${
                                    lr.status === 'APPROVED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  {lr.status}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: WORKERS MANAGEMENT */}
              {activeTab === 'WORKERS' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {lang === 'hi' ? 'मजदूर डायरेक्टरी और वेतन सेटिंग्स' : 'Workers Directory & Wage Rates'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {lang === 'hi'
                          ? 'प्रत्येक मजदूर की दैनिक मज़दूरी, मासिक वेतन, ओवरटाइम और बकाया हिसाब देखें।'
                          : 'Manage worker profiles, individual daily/monthly wages, and inspect salary statements.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openAddWorker}
                      className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t(lang, 'addWorker')}</span>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-1 min-w-[240px] items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-800">
                      <Search className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label={lang === 'hi' ? 'मजदूर नाम या यूनिक आईडी से खोजें' : 'Search workers by name or unique ID'}
                        placeholder={
                          lang === 'hi'
                            ? 'मजदूर का नाम या यूनिक आईडी (जैसे MM-2026-1001) लिखें...'
                            : 'Search by worker name or unique ID (e.g. MM-2026-1001)...'
                        }
                        className="w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label={lang === 'hi' ? 'खोज साफ़ करें' : 'Clear search'}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                      {filteredWorkers.length} / {workers.length}{' '}
                      {lang === 'hi' ? 'मजदूर' : 'workers'}
                    </p>
                  </div>

                  {filteredWorkers.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-800">
                      <Search className="mx-auto h-9 w-9 text-slate-400" />
                      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {searchQuery.trim()
                          ? lang === 'hi'
                            ? `"${searchQuery.trim()}" से मिलता-जुलता कोई मजदूर नहीं मिला।`
                            : `No workers found matching "${searchQuery.trim()}".`
                          : t(lang, 'noWorkersYet')}
                      </p>
                      {searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="mt-3 inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>{lang === 'hi' ? 'खोज साफ़ करें' : 'Clear Search'}</span>
                        </button>
                      )}
                    </div>
                  ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filteredWorkers.map((w) => (
                      <div
                        key={w.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={w.photo_url || '/src/assets/images/avatar_worker_portrait_1795110250643.jpg'}
                              alt={w.name}
                              referrerPolicy="no-referrer"
                              className="h-14 w-14 rounded-xl border border-slate-200 object-cover dark:border-slate-700 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                                {w.unique_worker_id} · +91 {w.mobile}
                              </p>
                              <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                                {w.name}
                              </h3>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {w.skill_role} · {w.site_name || 'Unassigned'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditWorker(w)}
                              aria-label="Edit worker"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWorker(w)}
                              aria-label="Delete worker"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'दर' : 'Wage'}</span>
                            <p className="font-mono font-bold tabular-nums">
                              {w.wage_type === 'MONTHLY'
                                ? `${formatINR(w.monthly_salary)}/mo`
                                : `${formatINR(w.daily_wage)}/day`}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'इस माह' : 'Month'}</span>
                            <p className="font-mono font-bold tabular-nums text-blue-700 dark:text-blue-400">
                              {formatINR(w.month_salary?.total_salary || 0)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 dark:text-slate-400">{lang === 'hi' ? 'बकाया' : 'Balance'}</span>
                            <p className="font-mono font-bold tabular-nums text-orange-700 dark:text-orange-400">
                              {formatINR(w.all_time_balance?.remaining_balance || 0)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openTxModal('PAYMENT', w.id)}
                            className="flex-1 min-h-[38px] rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            {lang === 'hi' ? 'भुगतान करें' : 'Pay'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openTxModal('ADVANCE', w.id)}
                            className="flex-1 min-h-[38px] rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            {lang === 'hi' ? 'अग्रिम दें' : 'Advance'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setInspectWorker(w)}
                            className="flex-1 min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            {lang === 'hi' ? 'खाता देखें' : 'Statement'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {/* TAB 3: PAYMENTS, ADVANCES, BONUSES, DEDUCTIONS, EXPENSES & AUDIT LOGS */}
              {activeTab === 'ACCOUNTS' && (
                <div className="space-y-6">
                  {/* Action Strip */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <button
                      type="button"
                      onClick={() => openTxModal('PAYMENT')}
                      className="min-h-[46px] rounded-xl bg-blue-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-800"
                    >
                      + {t(lang, 'recordPayment')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTxModal('ADVANCE')}
                      className="min-h-[46px] rounded-xl bg-orange-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
                    >
                      + {t(lang, 'recordAdvance')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTxModal('BONUS')}
                      className="min-h-[46px] rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      + {t(lang, 'addBonus')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTxModal('DEDUCTION')}
                      className="min-h-[46px] rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                    >
                      + {t(lang, 'addDeduction')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTxModal('EXPENSE')}
                      className="col-span-2 sm:col-span-1 min-h-[46px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      + {t(lang, 'addExpense')}
                    </button>
                  </div>

                  {/* Unified Ledger */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? `पूरा वित्तीय खाता (${selectedMonth})` : `Complete Financial Ledger (${selectedMonth})`}
                    </h2>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[650px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="py-3 pr-4">{lang === 'hi' ? 'दिनांक व समय' : 'Date & Time'}</th>
                            <th className="py-3 pr-4">{lang === 'hi' ? 'श्रेणी' : 'Category'}</th>
                            <th className="py-3 pr-4">{lang === 'hi' ? 'मजदूर / साइट' : 'Worker / Site'}</th>
                            <th className="py-3 pr-4">{lang === 'hi' ? 'विवरण' : 'Description'}</th>
                            <th className="py-3 text-right">{lang === 'hi' ? 'राशि' : 'Amount'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {transactions.map((tx) => (
                            <tr key={`${tx.category}-${tx.id}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                              <td className="py-3 pr-4 font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                {tx.date} · {tx.time}
                              </td>
                              <td className="py-3 pr-4 text-xs font-bold">
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
                                  {tx.category} ({tx.mode})
                                </span>
                              </td>
                              <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">
                                {tx.worker_name}
                              </td>
                              <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                                {tx.description} {tx.reference_no ? `(${tx.reference_no})` : ''}
                              </td>
                              <td className="py-3 text-right font-mono font-bold tabular-nums">
                                {formatINR(tx.amount)}
                              </td>
                            </tr>
                          ))}
                          {transactions.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                                {lang === 'hi' ? 'इस माह कोई लेन-देन नहीं हुआ है।' : 'No transactions recorded this month.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Audit Logs */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {lang === 'hi' ? 'स्थायी ऑडिट लॉग (Audit Trail)' : 'Permanent Audit Logs'}
                      </h3>
                    </div>
                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto text-xs">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {' '}· {log.actor_name} ({log.actor_role})
                              {log.reason ? ` · ${log.reason}` : ''}
                            </span>
                          </div>
                          <span className="font-mono text-slate-500 dark:text-slate-400">{log.created_at}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WORK SITES & DAILY/WEEKLY/MONTHLY REPORTS */}
              {activeTab === 'REPORTS' && (
                <div className="space-y-6">
                  {/* Work Sites Manager */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? 'कार्य साइट प्रबंधन (Work Sites)' : 'Work Sites Management'}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {lang === 'hi'
                            ? 'GPS सीमा और मल्टी-साइट ट्रैकिंग के साथ सभी प्रोजेक्ट जोड़ें।'
                            : 'Manage multiple work locations with optional GPS geofence radius.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSiteModalOpen(true)}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                      >
                        <Plus className="h-4 w-4" />
                        <span>{t(lang, 'addSite')}</span>
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sites.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white">{s.name}</h4>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {s.location || 'Location not set'}
                              </p>
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{s.status}</span>
                          </div>
                          {s.latitude != null && s.longitude != null && (
                            <p className="mt-2 flex items-center gap-1 font-mono text-[11px] text-blue-700 dark:text-blue-400">
                              <MapPin className="h-3 w-3" />
                              {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)} ({s.radius_meters}m)
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reports & Exports */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {lang === 'hi' ? 'दैनिक, साप्ताहिक और मासिक रिपोर्ट' : 'Daily, Weekly & Monthly Reports'}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {reportRange.startDate} → {reportRange.endDate} · {lang === 'hi' ? 'साइट खर्च:' : 'Site Expenses:'}{' '}
                          {formatINR(reportRange.siteExpenses)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setReportPeriod(p)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                                reportPeriod === p
                                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-400'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            downloadOwnerReportPDF({
                              employerName: employer?.business_name || user.name,
                              period: reportPeriod,
                              startDate: reportRange.startDate,
                              endDate: reportRange.endDate,
                              rows: reportRows,
                              siteExpenses: reportRange.siteExpenses,
                            })
                          }
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                          <FileDown className="h-4 w-4" />
                          <span>PDF</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            downloadOwnerReportExcel({
                              employerName: employer?.business_name || user.name,
                              period: reportPeriod,
                              startDate: reportRange.startDate,
                              endDate: reportRange.endDate,
                              rows: reportRows,
                              transactions,
                            })
                          }
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>{t(lang, 'exportExcel')}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[780px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            <th className="py-3 pr-3">{lang === 'hi' ? 'मजदूर' : 'Worker'}</th>
                            <th className="py-3 pr-3">{lang === 'hi' ? 'हाज़िरी (P/H/L)' : 'Attendance'}</th>
                            <th className="py-3 pr-3 text-right">OT (h)</th>
                            <th className="py-3 pr-3 text-right">{lang === 'hi' ? 'कुल वेतन' : 'Total Salary'}</th>
                            <th className="py-3 pr-3 text-right">{lang === 'hi' ? 'अग्रिम' : 'Advances'}</th>
                            <th className="py-3 pr-3 text-right">{lang === 'hi' ? 'भुगतान' : 'Paid'}</th>
                            <th className="py-3 pr-3 text-right">{lang === 'hi' ? 'बकाया' : 'Remaining'}</th>
                            <th className="py-3 text-right">{lang === 'hi' ? 'शेयर' : 'Share'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {reportRows.map((r) => {
                            const waText = buildWhatsAppReportRowText({
                              row: r,
                              employerName: employer?.business_name || user.name,
                              periodLabel: `${reportRange.startDate} → ${reportRange.endDate}`,
                              lang,
                            });
                            return (
                              <tr key={r.worker_id}>
                                <td className="py-3 pr-3">
                                  <p className="font-bold text-slate-900 dark:text-white">{r.name}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{r.unique_worker_id} · {r.site_name}</p>
                                </td>
                                <td className="py-3 pr-3 font-mono text-xs tabular-nums">
                                  {r.present_days}P / {r.half_days}H / {r.paid_leave_days}L
                                </td>
                                <td className="py-3 pr-3 text-right font-mono tabular-nums">{r.overtime_hours}h</td>
                                <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-blue-700 dark:text-blue-400">
                                  {formatINR(r.total_salary)}
                                </td>
                                <td className="py-3 pr-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                                  {formatINR(r.advance_total)}
                                </td>
                                <td className="py-3 pr-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                                  {formatINR(r.paid_total)}
                                </td>
                                <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-orange-700 dark:text-orange-400">
                                  {formatINR(r.remaining_balance)}
                                </td>
                                <td className="py-3 text-right">
                                  <a
                                    href={buildWhatsAppShareUrl(waText, r.mobile)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={t(lang, 'shareWhatsapp')}
                                    className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: SETTINGS, BACKUP & ABOUT APP */}
              {activeTab === 'SETTINGS' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'hi' ? 'संस्था और प्रोफाइल सेटिंग्स' : 'Organization & Profile'}
                    </h2>
                    <form onSubmit={handleSaveOrgSettings} className="mt-4 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {t(lang, 'businessName')}
                        </label>
                        <input
                          type="text"
                          required
                          value={orgNameInput}
                          onChange={(e) => setOrgNameInput(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {t(lang, 'fullName')}
                        </label>
                        <input
                          type="text"
                          required
                          value={ownerNameInput}
                          onChange={(e) => setOwnerNameInput(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                        />
                      </div>
                      {employer && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            {lang === 'hi' ? 'सब्सक्रिप्शन प्लान:' : 'Subscription Plan:'}{' '}
                          </span>
                          <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                            {employer.subscription_plan || 'FREE'}
                          </span>
                          <span className="mx-1.5 text-slate-400">·</span>
                          <span className="tabular-nums text-slate-600 dark:text-slate-300">
                            {workers.length}/{employer.max_workers || 25} {lang === 'hi' ? 'मजदूर सीमा' : 'workers quota'}
                          </span>
                        </div>
                      )}
                      <button
                        type="submit"
                        className="min-h-[44px] rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                      >
                        {lang === 'hi' ? 'सेटिंग्स सेव करें' : 'Save Changes'}
                      </button>
                    </form>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <DatabaseBackup className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {lang === 'hi' ? 'डेटा बैकअप और रीस्टोर' : 'Data Backup & Restore'}
                      </h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {lang === 'hi'
                        ? 'अपने सभी मजदूरों, हाज़िरी और लेन-देन का सुरक्षित बैकअप डाउनलोड या रीस्टोर करें।'
                        : 'Export a complete JSON backup of your organization records or restore from a saved backup.'}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleDownloadBackup}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                      >
                        <FileDown className="h-4 w-4" />
                        <span>{t(lang, 'backupExport')}</span>
                      </button>

                      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        <Upload className="h-4 w-4" />
                        <span>{t(lang, 'backupRestore')}</span>
                        <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                      </label>
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    <AboutAppCard
                      lang={lang}
                      founderName={appSettings?.founderName || 'Raja'}
                      supportContact={appSettings?.supportContact}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 lg:hidden pb-safe">
        <div className="grid h-16 grid-cols-5 items-center">
          {(
            [
              ['ATTENDANCE', CalendarCheck, lang === 'hi' ? 'हाज़िरी' : 'Attend'],
              ['WORKERS', Users, lang === 'hi' ? 'मजदूर' : 'Workers'],
              ['ACCOUNTS', IndianRupee, lang === 'hi' ? 'खाता' : 'Accounts'],
              ['REPORTS', FileSpreadsheet, lang === 'hi' ? 'रिपोर्ट' : 'Reports'],
              ['SETTINGS', Settings, lang === 'hi' ? 'सेटिंग्स' : 'Settings'],
            ] as Array<[OwnerTab, React.FC<{ className?: string }>, string]>
          ).map(([tab, Icon, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex h-full flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                activeTab === tab
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* MODAL: ADD / EDIT WORKER */}
      {workerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingWorker ? (lang === 'hi' ? 'मजदूर विवरण बदलें' : 'Edit Worker') : t(lang, 'addWorker')}
              </h3>
              <button type="button" onClick={() => setWorkerModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveWorker} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{t(lang, 'fullName')}</label>
                  <input type="text" required value={wName} onChange={(e) => setWName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{t(lang, 'mobileLabel')}</label>
                  <input type="tel" required maxLength={10} value={wMobile} onChange={(e) => setWMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'काम / कौशल' : 'Skill / Trade'}</label>
                  <input type="text" value={wSkill} onChange={(e) => setWSkill(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'कार्य साइट' : 'Work Site'}</label>
                  <select value={wSiteId} onChange={(e) => setWSiteId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <option value="">{lang === 'hi' ? 'कोई नहीं' : 'Unassigned'}</option>
                    {sites.map((s) => (
                      <option key={s.id} value={String(s.id)}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'वेतन प्रकार' : 'Wage Type'}</label>
                  <select value={wWageType} onChange={(e) => setWWageType(e.target.value as 'DAILY' | 'MONTHLY')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {wWageType === 'DAILY' ? t(lang, 'dailyWage') : t(lang, 'monthlySalary')}
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={wWageType === 'DAILY' ? wDailyWage : wMonthlySalary}
                    onChange={(e) => (wWageType === 'DAILY' ? setWDailyWage(e.target.value) : setWMonthlySalary(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">OT ₹/hr</label>
                  <input type="number" min="0" value={wOtRate} onChange={(e) => setWOtRate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'hi' ? 'मजदूर फोटो (वैकल्पिक)' : 'Worker Photo (Optional)'}
                </label>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="mt-1 block w-full text-xs text-slate-500" />
              </div>

              <button type="submit" className="min-h-[46px] w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
                {lang === 'hi' ? 'सेव करें' : 'Save Worker'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ATTENDANCE CORRECTION / OVERTIME */}
      {attModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {attModal.worker.name} ({selectedDate})
              </h3>
              <button type="button" onClick={() => setAttModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'hi' ? 'स्थिति चुनें' : 'Attendance Status'}
                </label>
                <select
                  value={attModal.status}
                  onChange={(e) => setAttModal({ ...attModal, status: e.target.value as AttendanceStatus })}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="PRESENT">{t(lang, 'PRESENT')}</option>
                  <option value="HALF_DAY">{t(lang, 'HALF_DAY')}</option>
                  <option value="PAID_LEAVE">{t(lang, 'PAID_LEAVE')}</option>
                  <option value="ABSENT">{t(lang, 'ABSENT')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'hi' ? 'ओवरटाइम घंटे (Overtime Hours)' : 'Overtime Hours'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="16"
                  value={attOvertime}
                  onChange={(e) => setAttOvertime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {attModal.existing && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'hi' ? 'सुधार का कारण (अनिवार्य)' : 'Reason for Correction (Required)'}
                  </label>
                  <input
                    type="text"
                    required
                    value={attEditReason}
                    onChange={(e) => setAttEditReason(e.target.value)}
                    placeholder={lang === 'hi' ? 'जैसे: शाम को 2 घंटे अतिरिक्त काम किया' : 'e.g. Worked 2 extra hours on slab'}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={attUseGps} onChange={(e) => setAttUseGps(e.target.checked)} />
                <span>{lang === 'hi' ? 'वर्तमान GPS लोकेशन टैग करें' : 'Attach current GPS coordinates'}</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  submitAttendance(attModal.worker.id, attModal.status, Number(attOvertime || 0), attEditReason, attUseGps)
                }
                className="min-h-[44px] w-full rounded-xl bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {lang === 'hi' ? 'हाज़िरी अपडेट करें' : 'Save Attendance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FINANCIAL TRANSACTION */}
      {txModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {txModal === 'PAYMENT' && t(lang, 'recordPayment')}
                {txModal === 'ADVANCE' && t(lang, 'recordAdvance')}
                {txModal === 'BONUS' && t(lang, 'addBonus')}
                {txModal === 'DEDUCTION' && t(lang, 'addDeduction')}
                {txModal === 'EXPENSE' && t(lang, 'addExpense')}
              </h3>
              <button type="button" onClick={() => setTxModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="mt-4 space-y-3.5">
              {txModal !== 'EXPENSE' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'hi' ? 'मजदूर चुनें' : 'Select Worker'}
                  </label>
                  <select required value={txWorkerId} onChange={(e) => setTxWorkerId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                    {workers.map((w) => (
                      <option key={w.id} value={String(w.id)}>
                        {w.name} ({w.unique_worker_id})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Site</label>
                    <select value={txSiteId} onChange={(e) => setTxSiteId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                      {sites.map((s) => (
                        <option key={s.id} value={String(s.id)}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
                    <input type="text" required value={txCategory} onChange={(e) => setTxCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}
                  </label>
                  <input type="number" required min="1" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono font-bold dark:border-slate-700 dark:bg-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {lang === 'hi' ? 'दिनांक' : 'Date'}
                  </label>
                  <input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>

              {(txModal === 'PAYMENT' || txModal === 'ADVANCE') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Mode</label>
                    <select value={txMode} onChange={(e) => setTxMode(e.target.value as 'CASH' | 'UPI' | 'BANK')} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <option value="UPI">UPI</option>
                      <option value="CASH">CASH</option>
                      <option value="BANK">BANK</option>
                    </select>
                  </div>
                  {txModal === 'PAYMENT' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Ref No.</label>
                      <input type="text" value={txRef} onChange={(e) => setTxRef(e.target.value)} placeholder="Optional" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {lang === 'hi' ? 'कारण / विवरण' : 'Reason / Description'}
                </label>
                <input
                  type="text"
                  required={txModal === 'BONUS' || txModal === 'DEDUCTION'}
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder={lang === 'hi' ? 'विवरण लिखें' : 'Enter note or reason'}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <button type="submit" className="min-h-[46px] w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">
                {lang === 'hi' ? 'रिकॉर्ड सेव करें' : 'Save Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD WORK SITE */}
      {siteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t(lang, 'addSite')}</h3>
              <button type="button" onClick={() => setSiteModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSite} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'साइट का नाम' : 'Site Name'}</label>
                <input type="text" required value={sName} onChange={(e) => setSName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{lang === 'hi' ? 'स्थान / पता' : 'Location'}</label>
                <input type="text" value={sLocation} onChange={(e) => setSLocation(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="Lat" value={sLat} onChange={(e) => setSLat(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800" />
                <input type="text" placeholder="Lng" value={sLng} onChange={(e) => setSLng(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800" />
                <input type="number" placeholder="Radius (m)" value={sRadius} onChange={(e) => setSRadius(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <button type="button" onClick={handleUseCurrentGpsForSite} className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400">
                <MapPin className="h-3.5 w-3.5" />
                <span>{lang === 'hi' ? 'वर्तमान GPS लोकेशन भरें' : 'Use Current GPS Location'}</span>
              </button>
              <button type="submit" className="min-h-[44px] w-full rounded-xl bg-blue-700 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                {lang === 'hi' ? 'साइट जोड़ें' : 'Save Work Site'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: WORKER SALARY STATEMENT INSPECTOR */}
      {inspectWorker && inspectWorker.month_salary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {inspectWorker.unique_worker_id} · {selectedMonth}
                </p>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{inspectWorker.name}</h3>
              </div>
              <button type="button" onClick={() => setInspectWorker(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
              <div className="flex justify-between px-4 py-2.5">
                <span>{t(lang, 'attendanceEarnings')}</span>
                <span className="font-mono font-bold tabular-nums">{formatINR(inspectWorker.month_salary.attendance_earnings)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span>{t(lang, 'overtimeEarnings')} ({inspectWorker.month_salary.overtime_hours}h)</span>
                <span className="font-mono font-bold tabular-nums">{formatINR(inspectWorker.month_salary.overtime_earnings)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span>{t(lang, 'bonus')} / {t(lang, 'deduction')}</span>
                <span className="font-mono font-bold tabular-nums">
                  +{formatINR(inspectWorker.month_salary.bonus_total)} / -{formatINR(inspectWorker.month_salary.deduction_total)}
                </span>
              </div>
              <div className="flex justify-between bg-blue-50/70 px-4 py-2.5 font-bold dark:bg-blue-950/30">
                <span>{t(lang, 'totalSalary')}</span>
                <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                  {formatINR(inspectWorker.month_salary.total_salary)}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span>{t(lang, 'advanceTaken')} + {t(lang, 'paidReceived')}</span>
                <span className="font-mono font-bold tabular-nums">
                  -{formatINR(inspectWorker.month_salary.advance_total + inspectWorker.month_salary.paid_total)}
                </span>
              </div>
              <div className="flex justify-between bg-orange-50/80 px-4 py-3 font-extrabold dark:bg-orange-950/30">
                <span>{t(lang, 'remainingBalance')}</span>
                <span className="font-mono tabular-nums text-orange-700 dark:text-orange-400">
                  {formatINR(inspectWorker.month_salary.remaining_balance)}
                </span>
              </div>
            </div>

            {(() => {
              const waText = buildWhatsAppStatementText({
                workerName: inspectWorker.name,
                uniqueId: inspectWorker.unique_worker_id,
                employerName: employer?.business_name || user.name,
                month: selectedMonth,
                salary: inspectWorker.month_salary,
                lang,
              });
              const waHref = buildWhatsAppShareUrl(waText, inspectWorker.mobile);
              return (
                <div className="mt-5 space-y-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() =>
                        downloadSalarySlipPDF({
                          worker: inspectWorker,
                          employerName: employer?.business_name || user.name,
                          month: selectedMonth,
                          salary: inspectWorker.month_salary!,
                          attendance: monthAttendance.filter((a) => a.worker_id === inspectWorker.id),
                          transactions: transactions.filter((tx) => tx.worker_id === inspectWorker.id),
                        })
                      }
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>PDF</span>
                    </button>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <Share2 className="h-4 w-4" />
                      <span>{t(lang, 'shareWhatsapp')}</span>
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(waText);
                          showToast(lang === 'hi' ? 'WhatsApp संदेश कॉपी हो गया!' : 'WhatsApp message copied!');
                        } catch {
                          showToast(lang === 'hi' ? 'संदेश तैयार है।' : 'Message ready to share.');
                        }
                      }}
                      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{lang === 'hi' ? 'कॉपी करें' : 'Copy Text'}</span>
                    </button>
                  </div>

                  <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                    <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                      {lang === 'hi' ? 'WhatsApp संदेश पूर्वावलोकन देखें' : 'Preview WhatsApp Message'}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-slate-600 dark:text-slate-300">
                      {waText}
                    </pre>
                  </details>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
