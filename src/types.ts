export type UserRole = 'WORKER' | 'OWNER' | 'SUPER_ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type SubscriptionPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type Language = 'hi' | 'en';
export type ThemeMode = 'light' | 'dark';
export type DbMode = 'prod' | 'demo';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE';

export interface PremiumFeatures {
  gpsGeofencing: boolean;
  pdfExcelExports: boolean;
  whatsappIntegration: boolean;
  multiSiteManagement: boolean;
  cloudBackupRestore: boolean;
  customBranding: boolean;
}

export interface AppSettings {
  appName: string;
  founderName: string;
  founderRoleTitle: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  freePlanWorkerLimit: number;
  proPlanWorkerLimit: number;
  proPlanPriceInr: number;
  enterprisePlanPriceInr: number;
  premiumFeatures: PremiumFeatures;
  supportContact: string;
  announcementBanner: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: number;
  mobile: string;
  name: string;
  role: UserRole;
  language: Language;
  theme: ThemeMode;
  avatar_url: string;
  email?: string;
  account_status?: AccountStatus;
  status_reason?: string;
  is_founder?: number;
}

export interface EmployerProfile {
  id: number;
  user_id: number;
  business_name: string;
  owner_name: string;
  mobile: string;
  address: string;
  account_status?: AccountStatus;
  subscription_plan?: SubscriptionPlan;
  subscription_expires_at?: string;
  max_workers?: number;
}

export interface SuperAdminStats {
  totalUsers: number;
  totalOwners: number;
  totalWorkersUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  deactivatedUsers: number;
  totalWorkerProfiles: number;
  activeWorkerProfiles: number;
  totalSites: number;
  totalAttendance: number;
  totalPaid: number;
  totalAdvances: number;
  subscriptionBreakdown: {
    FREE: number;
    PRO: number;
    ENTERPRISE: number;
  };
}

export interface SuperAdminAuditLog {
  id: number;
  actor_user_id: number | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: number | null;
  details_json: string;
  reason: string;
  created_at: string;
}

export interface SuperAdminUserRow {
  id: number;
  mobile: string;
  name: string;
  role: 'OWNER' | 'WORKER';
  language: Language;
  email: string;
  account_status: AccountStatus;
  status_reason: string;
  created_at: string;
  employer_id: number | null;
  business_name: string | null;
  employer_address: string | null;
  employer_status: AccountStatus | null;
  subscription_plan: SubscriptionPlan | null;
  subscription_expires_at: string | null;
  max_workers: number | null;
  managed_workers_count: number;
  sites_count: number;
  linked_jobs_count: number;
}

export interface SuperAdminWorkerRow {
  id: number;
  unique_worker_id: string;
  name: string;
  mobile: string;
  skill_role: string;
  wage_type: 'DAILY' | 'MONTHLY';
  daily_wage: number;
  monthly_salary: number;
  status: 'ACTIVE' | 'INACTIVE';
  business_name: string;
  owner_name: string;
  employer_mobile: string;
  site_name: string | null;
  joined_at: string;
}

export interface WorkSite {
  id: number;
  employer_id: number;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}

export interface SalarySummary {
  month: string;
  worker_id: number;
  employer_id: number;
  effective_daily_wage: number;
  present_days: number;
  half_days: number;
  paid_leave_days: number;
  absent_days: number;
  total_working_days: number;
  total_hours: number;
  overtime_hours: number;
  attendance_earnings: number;
  overtime_earnings: number;
  bonus_total: number;
  deduction_total: number;
  total_salary: number;
  advance_total: number;
  paid_total: number;
  remaining_balance: number;
}

export interface AllTimeBalance {
  total_earnings: number;
  total_advances: number;
  total_paid: number;
  remaining_balance: number;
}

export interface AttendanceRecord {
  id: number;
  worker_id: number;
  employer_id: number;
  site_id: number | null;
  date: string;
  status: AttendanceStatus;
  hours_worked: number;
  overtime_hours: number;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_verified: number;
  edit_reason: string;
  edit_history_json: string;
  notes: string;
  worker_name?: string;
  unique_worker_id?: string;
}

export interface WorkerWithStats {
  id: number;
  unique_worker_id: string;
  user_id: number | null;
  employer_id: number;
  site_id: number | null;
  site_name: string | null;
  name: string;
  mobile: string;
  photo_url: string;
  skill_role: string;
  wage_type: 'DAILY' | 'MONTHLY';
  daily_wage: number;
  monthly_salary: number;
  overtime_rate: number;
  effective_daily_wage: number;
  status: 'ACTIVE' | 'INACTIVE';
  joined_at: string;
  month_salary: SalarySummary | null;
  all_time_balance: AllTimeBalance;
  today_attendance: AttendanceRecord | null;
  // Extra fields on worker dashboard profile
  business_name?: string;
  owner_name?: string;
  employer_mobile?: string;
  employer_address?: string;
  site_location?: string | null;
}

export interface TransactionItem {
  id: number;
  category: 'PAYMENT' | 'ADVANCE' | 'BONUS' | 'DEDUCTION' | 'EXPENSE';
  worker_id: number | null;
  worker_name: string;
  unique_worker_id: string;
  amount: number;
  mode: string;
  reference_no: string;
  date: string;
  time: string;
  description: string;
}

export interface LeaveRequestItem {
  id: number;
  worker_id: number;
  employer_id: number;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  owner_note: string;
  worker_name?: string;
  unique_worker_id?: string;
  worker_mobile?: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title_en: string;
  title_hi: string;
  message_en: string;
  message_hi: string;
  is_read: number;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  entity_type: string;
  reason: string;
  old_value_json: string;
  new_value_json: string;
  created_at: string;
}

export interface SiteExpense {
  id: number;
  site_id: number | null;
  site_name: string | null;
  category: string;
  amount: number;
  date: string;
  time: string;
  description: string;
}

export interface ReportRow {
  worker_id: number;
  unique_worker_id: string;
  name: string;
  mobile: string;
  site_name: string;
  skill_role: string;
  daily_rate: number;
  present_days: number;
  half_days: number;
  paid_leave_days: number;
  absent_days: number;
  total_hours: number;
  overtime_hours: number;
  attendance_earnings: number;
  overtime_earnings: number;
  bonus_total: number;
  deduction_total: number;
  total_salary: number;
  advance_total: number;
  paid_total: number;
  remaining_balance: number;
}
