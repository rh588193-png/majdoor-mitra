import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { AttendanceRecord, ReportRow, SalarySummary, TransactionItem, WorkerWithStats } from '../types';

function formatRsPdf(val: number): string {
  const n = Number(val || 0);
  return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function downloadSalarySlipPDF(params: {
  worker: WorkerWithStats;
  employerName: string;
  month: string;
  salary: SalarySummary;
  attendance: AttendanceRecord[];
  transactions: TransactionItem[];
}) {
  const { worker, employerName, month, salary, attendance, transactions } = params;
  const doc = new jsPDF();

  // Header Banner
  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 34, 210, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('MAJDOOR MITRA - SALARY STATEMENT', 14, 15);
  doc.setFontSize(10);
  doc.text(`Employer: ${employerName}  |  Month: ${month}`, 14, 24);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 152, 24);

  // Worker Details
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Worker: ${worker.name} (${worker.unique_worker_id})`, 14, 46);
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Mobile: ${worker.mobile}  |  Role: ${worker.skill_role}  |  Rate: ${formatRsPdf(salary.effective_daily_wage)}/day`,
    14,
    53
  );

  // Salary Calculation Summary Table
  autoTable(doc, {
    startY: 60,
    head: [['Component', 'Details', 'Amount']],
    body: [
      ['Present Days', `${salary.present_days} days`, formatRsPdf(salary.present_days * salary.effective_daily_wage)],
      ['Half Days', `${salary.half_days} days (0.5x)`, formatRsPdf(salary.half_days * 0.5 * salary.effective_daily_wage)],
      ['Paid Leave Days', `${salary.paid_leave_days} days`, formatRsPdf(salary.paid_leave_days * salary.effective_daily_wage)],
      ['Absent Days', `${salary.absent_days} days`, 'Rs. 0'],
      ['Overtime Hours', `${salary.overtime_hours} hrs`, formatRsPdf(salary.overtime_earnings)],
      ['Bonuses Added', 'Performance / Incentives', `+ ${formatRsPdf(salary.bonus_total)}`],
      ['Valid Deductions', 'Penalties / Adjustments', `- ${formatRsPdf(salary.deduction_total)}`],
      ['TOTAL SALARY (Attendance + OT + Bonus - Deductions)', '', formatRsPdf(salary.total_salary)],
      ['Advance Payments Taken', 'Deducted from payable', `- ${formatRsPdf(salary.advance_total)}`],
      ['Salary Payments Received', 'Paid via Cash / UPI / Bank', `- ${formatRsPdf(salary.paid_total)}`],
      ['REMAINING BALANCE DUE', '', formatRsPdf(salary.remaining_balance)],
    ],
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 9 },
    didParseCell(data) {
      if (data.row.index === 7 || data.row.index === 10) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = data.row.index === 10 ? [255, 247, 237] : [239, 246, 255];
      }
    },
  });

  // Transactions Table
  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (transactions.length > 0) {
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Transaction History', 14, afterSummaryY);

    autoTable(doc, {
      startY: afterSummaryY + 4,
      head: [['Date & Time', 'Category', 'Mode', 'Description', 'Amount']],
      body: transactions.map((tx) => [
        `${tx.date} ${tx.time}`,
        tx.category,
        tx.mode,
        tx.description,
        formatRsPdf(tx.amount),
      ]),
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8.5 },
    });
  }

  // Attendance Log on next page if many rows
  if (attendance.length > 0) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Attendance Log (${month}) - ${worker.name}`, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [['Date', 'Status', 'Hours', 'Overtime', 'GPS', 'Notes / Edit Reason']],
      body: attendance.map((a) => [
        a.date,
        a.status,
        `${a.hours_worked}h`,
        `${a.overtime_hours}h`,
        a.gps_verified ? 'Verified' : '-',
        a.edit_reason || a.notes || '-',
      ]),
      headStyles: { fillColor: [29, 78, 216] },
      styles: { fontSize: 8.5 },
    });
  }

  doc.save(`MajdoorMitra_${worker.unique_worker_id}_${month}.pdf`);
}

export function downloadOwnerReportPDF(params: {
  employerName: string;
  period: string;
  startDate: string;
  endDate: string;
  rows: ReportRow[];
  siteExpenses: number;
}) {
  const { employerName, period, startDate, endDate, rows, siteExpenses } = params;
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFillColor(29, 78, 216);
  doc.rect(0, 0, 297, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(`MAJDOOR MITRA - ${period.toUpperCase()} PAYROLL & ATTENDANCE REPORT`, 14, 13);
  doc.setFontSize(9.5);
  doc.text(`${employerName}  |  Period: ${startDate} to ${endDate}  |  Site Expenses: ${formatRsPdf(siteExpenses)}`, 14, 21);

  autoTable(doc, {
    startY: 32,
    head: [
      [
        'ID',
        'Worker Name',
        'Site',
        'Present/Half/Leave',
        'OT (h)',
        'Total Salary',
        'Advances',
        'Paid',
        'Remaining',
      ],
    ],
    body: rows.map((r) => [
      r.unique_worker_id,
      r.name,
      r.site_name,
      `${r.present_days}P / ${r.half_days}H / ${r.paid_leave_days}L`,
      `${r.overtime_hours}`,
      formatRsPdf(r.total_salary),
      formatRsPdf(r.advance_total),
      formatRsPdf(r.paid_total),
      formatRsPdf(r.remaining_balance),
    ]),
    headStyles: { fillColor: [29, 78, 216] },
    styles: { fontSize: 8.5 },
  });

  doc.save(`MajdoorMitra_Report_${period}_${startDate}_to_${endDate}.pdf`);
}

export function downloadOwnerReportExcel(params: {
  employerName: string;
  period: string;
  startDate: string;
  endDate: string;
  rows: ReportRow[];
  transactions: TransactionItem[];
}) {
  const { employerName, period, startDate, endDate, rows, transactions } = params;
  const wb = XLSX.utils.book_new();

  const summarySheetData = rows.map((r) => ({
    'Worker ID': r.unique_worker_id,
    'Worker Name': r.name,
    Mobile: r.mobile,
    'Work Site': r.site_name,
    Role: r.skill_role,
    'Daily Rate (INR)': r.daily_rate,
    'Present Days': r.present_days,
    'Half Days': r.half_days,
    'Paid Leave': r.paid_leave_days,
    'Absent Days': r.absent_days,
    'Overtime Hours': r.overtime_hours,
    'Attendance Earnings': r.attendance_earnings,
    'Overtime Earnings': r.overtime_earnings,
    Bonus: r.bonus_total,
    Deductions: r.deduction_total,
    'Total Salary': r.total_salary,
    Advances: r.advance_total,
    'Paid Amount': r.paid_total,
    'Remaining Balance': r.remaining_balance,
  }));

  const ws1 = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Payroll Summary');

  const txSheetData = transactions.map((tx) => ({
    Date: tx.date,
    Time: tx.time,
    Category: tx.category,
    'Worker / Site': tx.worker_name,
    'ID / Tag': tx.unique_worker_id,
    Mode: tx.mode,
    'Amount (INR)': tx.amount,
    Description: tx.description,
    Reference: tx.reference_no,
  }));

  const ws2 = XLSX.utils.json_to_sheet(txSheetData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Transactions');

  const metaSheet = XLSX.utils.json_to_sheet([
    { Organization: employerName, Period: period, 'Start Date': startDate, 'End Date': endDate },
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Info');

  XLSX.writeFile(wb, `MajdoorMitra_${period}_${startDate}.xlsx`);
}

export function buildWhatsAppShareUrl(text: string, mobile?: string): string {
  const digits = mobile ? mobile.replace(/\D/g, '').slice(-10) : '';
  const target = digits.length === 10 ? `91${digits}` : '';
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppStatementText(params: {
  workerName: string;
  uniqueId: string;
  employerName: string;
  month: string;
  salary: SalarySummary;
  lang?: 'hi' | 'en';
}): string {
  const { workerName, uniqueId, employerName, month, salary, lang = 'hi' } = params;
  const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN');

  if (lang === 'en') {
    return [
      `*MAJDOOR MITRA — Salary Summary (${month})*`,
      `Worker: ${workerName} (${uniqueId})`,
      `Employer: ${employerName}`,
      `----------------------------`,
      `*Attendance Summary*`,
      `• Present: ${salary.present_days} days | Half Day: ${salary.half_days} | Paid Leave: ${salary.paid_leave_days} | Absent: ${salary.absent_days}`,
      `• Total Working Days: ${salary.total_working_days} days (${salary.total_hours} hrs)`,
      `• Overtime: ${salary.overtime_hours} hrs (₹${fmt(salary.overtime_earnings)})`,
      `----------------------------`,
      `*Earnings & Deductions*`,
      `• Attendance Earnings: ₹${fmt(salary.attendance_earnings)}`,
      `• Bonus: +₹${fmt(salary.bonus_total)} | Deductions: -₹${fmt(salary.deduction_total)}`,
      `*Total Salary: ₹${fmt(salary.total_salary)}*`,
      `• Advance Taken: -₹${fmt(salary.advance_total)}`,
      `• Payments Received: -₹${fmt(salary.paid_total)}`,
      `*Remaining Balance Due: ₹${fmt(salary.remaining_balance)}*`,
      `----------------------------`,
      `मजदूर का साथी, हिसाब में पारदर्शिता`,
    ].join('\n');
  }

  return [
    `*MAJDOOR MITRA — मासिक वेतन विवरण (${month})*`,
    `मजदूर: ${workerName} (${uniqueId})`,
    `मालिक: ${employerName}`,
    `----------------------------`,
    `*हाज़िरी सारांश (Attendance)*`,
    `• उपस्थित: ${salary.present_days} दिन | आधा दिन: ${salary.half_days} | सवेतन छुट्टी: ${salary.paid_leave_days} | अनुपस्थित: ${salary.absent_days}`,
    `• कुल कार्य दिवस: ${salary.total_working_days} दिन (${salary.total_hours} घंटे)`,
    `• ओवरटाइम: ${salary.overtime_hours} घंटे (₹${fmt(salary.overtime_earnings)})`,
    `----------------------------`,
    `*कमाई व भुगतान विवरण*`,
    `• हाज़िरी कमाई: ₹${fmt(salary.attendance_earnings)}`,
    `• बोनस: +₹${fmt(salary.bonus_total)} | कटौती: -₹${fmt(salary.deduction_total)}`,
    `*कुल वेतन (Total Salary): ₹${fmt(salary.total_salary)}*`,
    `• अग्रिम (Advance): -₹${fmt(salary.advance_total)}`,
    `• प्राप्त भुगतान (Paid): -₹${fmt(salary.paid_total)}`,
    `*बकाया राशि (Remaining Balance): ₹${fmt(salary.remaining_balance)}*`,
    `----------------------------`,
    `मजदूर का साथी, हिसाब में पारदर्शिता`,
  ].join('\n');
}

export function buildWhatsAppReportRowText(params: {
  row: ReportRow;
  employerName: string;
  periodLabel: string;
  lang?: 'hi' | 'en';
}): string {
  const { row, employerName, periodLabel, lang = 'hi' } = params;
  const fmt = (n: number) => Number(n || 0).toLocaleString('en-IN');

  if (lang === 'en') {
    return [
      `*MAJDOOR MITRA — Salary Summary (${periodLabel})*`,
      `Worker: ${row.name} (${row.unique_worker_id})`,
      `Employer: ${employerName} · ${row.site_name}`,
      `----------------------------`,
      `• Attendance: ${row.present_days}P / ${row.half_days}H / ${row.paid_leave_days}L / ${row.absent_days}A`,
      `• Overtime: ${row.overtime_hours} hrs (₹${fmt(row.overtime_earnings)})`,
      `• Attendance Earnings: ₹${fmt(row.attendance_earnings)}`,
      `• Bonus: +₹${fmt(row.bonus_total)} | Deductions: -₹${fmt(row.deduction_total)}`,
      `*Total Salary: ₹${fmt(row.total_salary)}*`,
      `• Advance: -₹${fmt(row.advance_total)} | Paid: -₹${fmt(row.paid_total)}`,
      `*Remaining Balance: ₹${fmt(row.remaining_balance)}*`,
      `----------------------------`,
      `मजदूर का साथी, हिसाब में पारदर्शिता`,
    ].join('\n');
  }

  return [
    `*MAJDOOR MITRA — वेतन विवरण (${periodLabel})*`,
    `मजदूर: ${row.name} (${row.unique_worker_id})`,
    `मालिक: ${employerName} · ${row.site_name}`,
    `----------------------------`,
    `• हाज़िरी: ${row.present_days} उपस्थित | ${row.half_days} आधा दिन | ${row.paid_leave_days} छुट्टी | ${row.absent_days} अनुपस्थित`,
    `• ओवरटाइम: ${row.overtime_hours} घंटे (₹${fmt(row.overtime_earnings)})`,
    `• हाज़िरी कमाई: ₹${fmt(row.attendance_earnings)}`,
    `• बोनस: +₹${fmt(row.bonus_total)} | कटौती: -₹${fmt(row.deduction_total)}`,
    `*कुल वेतन: ₹${fmt(row.total_salary)}*`,
    `• अग्रिम: -₹${fmt(row.advance_total)} | भुगतान: -₹${fmt(row.paid_total)}`,
    `*बकाया राशि: ₹${fmt(row.remaining_balance)}*`,
    `----------------------------`,
    `मजदूर का साथी, हिसाब में पारदर्शिता`,
  ].join('\n');
}

