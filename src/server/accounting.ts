import type Database from 'better-sqlite3';

export interface WorkerRow {
  id: number;
  unique_worker_id: string;
  user_id: number | null;
  employer_id: number;
  site_id: number | null;
  name: string;
  mobile: string;
  photo_url: string;
  skill_role: string;
  wage_type: 'DAILY' | 'MONTHLY';
  daily_wage: number;
  monthly_salary: number;
  overtime_rate: number;
  status: 'ACTIVE' | 'INACTIVE';
  joined_at: string;
}

export interface SalaryCalculation {
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

export function roundRupees(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getEffectiveDailyWage(worker: Pick<WorkerRow, 'wage_type' | 'daily_wage' | 'monthly_salary'>): number {
  if (worker.wage_type === 'MONTHLY' && worker.monthly_salary > 0) {
    return roundRupees(worker.monthly_salary / 30);
  }
  return roundRupees(worker.daily_wage || 0);
}

export function calculateAndPersistSalary(
  db: Database.Database,
  workerId: number,
  month: string // YYYY-MM
): SalaryCalculation | null {
  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId) as WorkerRow | undefined;
  if (!worker) return null;

  const monthPrefix = `${month}%`;
  const attendanceRows = db
    .prepare(
      `SELECT status, hours_worked, overtime_hours
       FROM attendance
       WHERE worker_id = ? AND date LIKE ?`
    )
    .all(workerId, monthPrefix) as Array<{
    status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE';
    hours_worked: number;
    overtime_hours: number;
  }>;

  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let absentDays = 0;
  let totalHours = 0;
  let overtimeHours = 0;

  for (const row of attendanceRows) {
    if (row.status === 'PRESENT') {
      presentDays += 1;
    } else if (row.status === 'HALF_DAY') {
      halfDays += 1;
    } else if (row.status === 'PAID_LEAVE') {
      paidLeaveDays += 1;
    } else if (row.status === 'ABSENT') {
      absentDays += 1;
    }
    totalHours += Number(row.hours_worked || 0);
    overtimeHours += Number(row.overtime_hours || 0);
  }

  const effectiveDailyWage = getEffectiveDailyWage(worker);
  const payableDays = presentDays + paidLeaveDays + halfDays * 0.5;
  const attendanceEarnings = roundRupees(payableDays * effectiveDailyWage);
  const otRate = worker.overtime_rate > 0 ? worker.overtime_rate : roundRupees(effectiveDailyWage / 8);
  const overtimeEarnings = roundRupees(overtimeHours * otRate);

  const bonusRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM bonuses WHERE worker_id = ? AND date LIKE ?')
    .get(workerId, monthPrefix) as { total: number };
  const deductionRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM deductions WHERE worker_id = ? AND date LIKE ?')
    .get(workerId, monthPrefix) as { total: number };
  const advanceRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM advances WHERE worker_id = ? AND date LIKE ?')
    .get(workerId, monthPrefix) as { total: number };
  const paymentRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE worker_id = ? AND date LIKE ?')
    .get(workerId, monthPrefix) as { total: number };

  const bonusTotal = roundRupees(Number(bonusRow.total || 0));
  const deductionTotal = roundRupees(Number(deductionRow.total || 0));
  const advanceTotal = roundRupees(Number(advanceRow.total || 0));
  const paidTotal = roundRupees(Number(paymentRow.total || 0));

  // Total Salary = Attendance-based Earnings + Overtime + Bonus - Valid Deductions
  const totalSalary = roundRupees(attendanceEarnings + overtimeEarnings + bonusTotal - deductionTotal);
  // Remaining Balance = Total Salary - Advance Payments - Salary Payments
  const remainingBalance = roundRupees(totalSalary - advanceTotal - paidTotal);

  db.prepare(
    `INSERT INTO salaries (
      worker_id, employer_id, month, present_days, half_days, paid_leave_days, absent_days,
      total_hours, overtime_hours, attendance_earnings, overtime_earnings,
      bonus_total, deduction_total, total_salary, advance_total, paid_total, remaining_balance, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(worker_id, month) DO UPDATE SET
      present_days = excluded.present_days,
      half_days = excluded.half_days,
      paid_leave_days = excluded.paid_leave_days,
      absent_days = excluded.absent_days,
      total_hours = excluded.total_hours,
      overtime_hours = excluded.overtime_hours,
      attendance_earnings = excluded.attendance_earnings,
      overtime_earnings = excluded.overtime_earnings,
      bonus_total = excluded.bonus_total,
      deduction_total = excluded.deduction_total,
      total_salary = excluded.total_salary,
      advance_total = excluded.advance_total,
      paid_total = excluded.paid_total,
      remaining_balance = excluded.remaining_balance,
      updated_at = datetime('now')`
  ).run(
    workerId,
    worker.employer_id,
    month,
    presentDays,
    halfDays,
    paidLeaveDays,
    absentDays,
    roundRupees(totalHours),
    roundRupees(overtimeHours),
    attendanceEarnings,
    overtimeEarnings,
    bonusTotal,
    deductionTotal,
    totalSalary,
    advanceTotal,
    paidTotal,
    remainingBalance
  );

  return {
    month,
    worker_id: workerId,
    employer_id: worker.employer_id,
    effective_daily_wage: effectiveDailyWage,
    present_days: presentDays,
    half_days: halfDays,
    paid_leave_days: paidLeaveDays,
    absent_days: absentDays,
    total_working_days: roundRupees(presentDays + halfDays * 0.5 + paidLeaveDays),
    total_hours: roundRupees(totalHours),
    overtime_hours: roundRupees(overtimeHours),
    attendance_earnings: attendanceEarnings,
    overtime_earnings: overtimeEarnings,
    bonus_total: bonusTotal,
    deduction_total: deductionTotal,
    total_salary: totalSalary,
    advance_total: advanceTotal,
    paid_total: paidTotal,
    remaining_balance: remainingBalance,
  };
}

export function getWorkerAllTimeBalance(db: Database.Database, workerId: number) {
  const worker = db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId) as WorkerRow | undefined;
  if (!worker) {
    return {
      total_earnings: 0,
      total_advances: 0,
      total_paid: 0,
      remaining_balance: 0,
    };
  }

  // Ensure every month with activity is synced
  const months = db
    .prepare(
      `SELECT DISTINCT substr(date, 1, 7) as m FROM attendance WHERE worker_id = ?
       UNION SELECT DISTINCT substr(date, 1, 7) as m FROM bonuses WHERE worker_id = ?
       UNION SELECT DISTINCT substr(date, 1, 7) as m FROM deductions WHERE worker_id = ?
       UNION SELECT DISTINCT substr(date, 1, 7) as m FROM advances WHERE worker_id = ?
       UNION SELECT DISTINCT substr(date, 1, 7) as m FROM payments WHERE worker_id = ?`
    )
    .all(workerId, workerId, workerId, workerId, workerId) as Array<{ m: string }>;

  for (const row of months) {
    if (row.m) {
      calculateAndPersistSalary(db, workerId, row.m);
    }
  }

  const agg = db
    .prepare(
      `SELECT
        COALESCE(SUM(total_salary), 0) as total_earnings,
        COALESCE(SUM(advance_total), 0) as total_advances,
        COALESCE(SUM(paid_total), 0) as total_paid,
        COALESCE(SUM(remaining_balance), 0) as remaining_balance
       FROM salaries WHERE worker_id = ?`
    )
    .get(workerId) as {
    total_earnings: number;
    total_advances: number;
    total_paid: number;
    remaining_balance: number;
  };

  return {
    total_earnings: roundRupees(agg.total_earnings),
    total_advances: roundRupees(agg.total_advances),
    total_paid: roundRupees(agg.total_paid),
    remaining_balance: roundRupees(agg.remaining_balance),
  };
}

export function writeAuditLog(
  db: Database.Database,
  params: {
    actorUserId: number | null;
    actorName: string;
    actorRole: string;
    employerId: number;
    workerId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    oldValue?: unknown;
    newValue?: unknown;
    reason?: string;
  }
) {
  db.prepare(
    `INSERT INTO audit_logs (
      actor_user_id, actor_name, actor_role, employer_id, worker_id,
      action, entity_type, entity_id, old_value_json, new_value_json, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    params.actorUserId,
    params.actorName,
    params.actorRole,
    params.employerId,
    params.workerId ?? null,
    params.action,
    params.entityType,
    params.entityId ?? null,
    JSON.stringify(params.oldValue ?? {}),
    JSON.stringify(params.newValue ?? {}),
    params.reason ?? ''
  );
}

export function notifyWorker(
  db: Database.Database,
  params: {
    workerId: number;
    employerId: number;
    type: string;
    titleEn: string;
    titleHi: string;
    messageEn: string;
    messageHi: string;
  }
) {
  const worker = db.prepare('SELECT user_id FROM workers WHERE id = ?').get(params.workerId) as
    | { user_id: number | null }
    | undefined;
  db.prepare(
    `INSERT INTO notifications (
      recipient_user_id, worker_id, employer_id, type,
      title_en, title_hi, message_en, message_hi
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    worker?.user_id ?? null,
    params.workerId,
    params.employerId,
    params.type,
    params.titleEn,
    params.titleHi,
    params.messageEn,
    params.messageHi
  );
}
