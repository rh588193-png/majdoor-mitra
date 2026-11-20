import { calculateAndPersistSalary, notifyWorker, writeAuditLog } from './accounting.ts';
import { getDb, resetDemoDbFile } from './db.ts';

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ensureDemoSeeded(forceReset = false) {
  const db = forceReset ? resetDemoDbFile() : getDb('demo');
  const existingOwner = db.prepare("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1").get() as
    | { id: number }
    | undefined;

  if (existingOwner && !forceReset) {
    return db;
  }

  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const currentMonth = `${y}-${String(m + 1).padStart(2, '0')}`;
  const todayStr = formatYmd(today);

  // Create Demo Owner User
  const ownerRes = db
    .prepare(
      `INSERT INTO users (mobile, name, role, language, theme, avatar_url)
       VALUES (?, ?, 'OWNER', 'hi', 'light', ?)`
    )
    .run('9876500001', 'राजेश शर्मा (Demo Owner)', '/src/assets/images/avatar_owner_portrait_1795110250453.jpg');
  const ownerUserId = Number(ownerRes.lastInsertRowid);

  // Create Demo Employer
  const empRes = db
    .prepare(
      `INSERT INTO employers (user_id, business_name, owner_name, mobile, address)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(ownerUserId, 'Shree Vishwakarma Builders', 'राजेश शर्मा', '9876500001', 'Sector 62, Noida, UP');
  const employerId = Number(empRes.lastInsertRowid);

  // Create Work Sites
  const site1Res = db
    .prepare(
      `INSERT INTO work_sites (employer_id, name, location, latitude, longitude, radius_meters, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`
    )
    .run(employerId, 'Metro Tower Phase-2', 'Sector 62, Noida', 28.6279, 77.3649, 800);
  const site1Id = Number(site1Res.lastInsertRowid);

  const site2Res = db
    .prepare(
      `INSERT INTO work_sites (employer_id, name, location, latitude, longitude, radius_meters, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`
    )
    .run(employerId, 'Green Valley Residency', 'Indirapuram, Ghaziabad', 28.6415, 77.3714, 800);
  const site2Id = Number(site2Res.lastInsertRowid);

  // Create Demo Primary Worker User (linked to two employers to showcase Multi-Employer feature!)
  const workerUserRes = db
    .prepare(
      `INSERT INTO users (mobile, name, role, language, theme, avatar_url)
       VALUES (?, ?, 'WORKER', 'hi', 'light', ?)`
    )
    .run('9876543210', 'रमेश कुमार (Demo Worker)', '/src/assets/images/avatar_worker_portrait_1795110250643.jpg');
  const primaryWorkerUserId = Number(workerUserRes.lastInsertRowid);

  // Secondary employer for multi-employer demo
  const owner2Res = db
    .prepare(
      `INSERT INTO users (mobile, name, role, language, theme, avatar_url)
       VALUES (?, ?, 'OWNER', 'en', 'light', ?)`
    )
    .run('9876500099', 'Vikram Infra Works', '/src/assets/images/avatar_owner_portrait_1795110250453.jpg');
  const owner2UserId = Number(owner2Res.lastInsertRowid);

  const emp2Res = db
    .prepare(
      `INSERT INTO employers (user_id, business_name, owner_name, mobile, address)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(owner2UserId, 'Vikram Infra Works', 'Vikram Patel', '9876500099', 'Vaishali, Ghaziabad');
  const employer2Id = Number(emp2Res.lastInsertRowid);

  const site3Res = db
    .prepare(
      `INSERT INTO work_sites (employer_id, name, location, latitude, longitude, radius_meters, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`
    )
    .run(employer2Id, 'Highway Overbridge Site B', 'NH-24, Ghaziabad', 28.636, 77.351, 800);
  const site3Id = Number(site3Res.lastInsertRowid);

  // Create Demo Workers for Primary Employer
  const demoWorkers = [
    {
      uid: 'MM-2026-1001',
      userId: primaryWorkerUserId,
      siteId: site1Id,
      name: 'रमेश कुमार (Ramesh Kumar)',
      mobile: '9876543210',
      photo: '/src/assets/images/avatar_worker_portrait_1795110250643.jpg',
      skill: 'राजमिस्त्री (Head Mason)',
      wageType: 'DAILY',
      dailyWage: 750,
      monthlySalary: 0,
      otRate: 110,
    },
    {
      uid: 'MM-2026-1002',
      userId: null,
      siteId: site1Id,
      name: 'सुरेश यादव (Suresh Yadav)',
      mobile: '9811223344',
      photo: '',
      skill: 'बेलदार (Helper)',
      wageType: 'DAILY',
      dailyWage: 550,
      monthlySalary: 0,
      otRate: 80,
    },
    {
      uid: 'MM-2026-1003',
      userId: null,
      siteId: site2Id,
      name: 'अमित वर्मा (Amit Verma)',
      mobile: '9811223355',
      photo: '',
      skill: 'इलेक्ट्रीशियन (Electrician)',
      wageType: 'MONTHLY',
      dailyWage: 0,
      monthlySalary: 21000,
      otRate: 100,
    },
    {
      uid: 'MM-2026-1004',
      userId: null,
      siteId: site2Id,
      name: 'मनीष चौहान (Manish Chauhan)',
      mobile: '9811223366',
      photo: '',
      skill: 'सरिया कारीगर (Bar Bender)',
      wageType: 'DAILY',
      dailyWage: 700,
      monthlySalary: 0,
      otRate: 100,
    },
    {
      uid: 'MM-2026-1005',
      userId: null,
      siteId: site1Id,
      name: 'दिनेश पासवान (Dinesh Paswan)',
      mobile: '9811223377',
      photo: '',
      skill: 'पेंटर (Painter)',
      wageType: 'DAILY',
      dailyWage: 650,
      monthlySalary: 0,
      otRate: 90,
    },
  ];

  const workerIds: number[] = [];
  for (const w of demoWorkers) {
    const res = db
      .prepare(
        `INSERT INTO workers (
          unique_worker_id, user_id, employer_id, site_id, name, mobile, photo_url,
          skill_role, wage_type, daily_wage, monthly_salary, overtime_rate, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        w.uid,
        w.userId,
        employerId,
        w.siteId,
        w.name,
        w.mobile,
        w.photo,
        w.skill,
        w.wageType,
        w.dailyWage,
        w.monthlySalary,
        w.otRate,
        `${currentMonth}-01`
      );
    workerIds.push(Number(res.lastInsertRowid));
  }

  // Link Ramesh Kumar to Secondary Employer too (Multi-employer support!)
  const rameshEmp2Res = db
    .prepare(
      `INSERT INTO workers (
        unique_worker_id, user_id, employer_id, site_id, name, mobile, photo_url,
        skill_role, wage_type, daily_wage, monthly_salary, overtime_rate, joined_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'MM-2026-2001',
      primaryWorkerUserId,
      employer2Id,
      site3Id,
      'रमेश कुमार (Ramesh Kumar)',
      '9876543210',
      '/src/assets/images/avatar_worker_portrait_1795110250643.jpg',
      'राजमिस्त्री (Weekend Consultant)',
      'DAILY',
      850,
      0,
      125,
      `${currentMonth}-01`
    );
  const rameshEmp2WorkerId = Number(rameshEmp2Res.lastInsertRowid);

  // Seed Attendance for current month up to today
  const dayOfMonth = today.getDate();
  const statuses: Array<'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'PAID_LEAVE'> = [
    'PRESENT',
    'PRESENT',
    'PRESENT',
    'PRESENT',
    'HALF_DAY',
    'PRESENT',
    'PAID_LEAVE',
    'PRESENT',
    'ABSENT',
    'PRESENT',
  ];

  for (let d = 1; d <= dayOfMonth; d++) {
    const dateStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
    workerIds.forEach((wid, idx) => {
      // Leave today open for last 2 workers so demo user can mark live attendance too
      if (d === dayOfMonth && idx >= 3) return;
      const st = statuses[(d + idx) % statuses.length];
      const ot = st === 'PRESENT' && (d + idx) % 3 === 0 ? 2 : 0;
      const hrs = st === 'PRESENT' ? 8 + ot : st === 'HALF_DAY' ? 4 : st === 'PAID_LEAVE' ? 8 : 0;
      const siteId = demoWorkers[idx].siteId;
      db.prepare(
        `INSERT INTO attendance (
          worker_id, employer_id, site_id, date, status, hours_worked, overtime_hours,
          gps_lat, gps_lng, gps_verified, marked_by_user_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(wid, employerId, siteId, dateStr, st, hrs, ot, 28.6279, 77.3649, 1, ownerUserId, 'Morning roll call');
    });
  }

  // Seed 2 days on secondary employer for Ramesh
  if (dayOfMonth >= 2) {
    db.prepare(
      `INSERT INTO attendance (
        worker_id, employer_id, site_id, date, status, hours_worked, overtime_hours,
        gps_lat, gps_lng, gps_verified, marked_by_user_id, notes
      ) VALUES (?, ?, ?, ?, 'PRESENT', 10, 2, 28.636, 77.351, 1, ?, 'Sunday slab inspection')`
    ).run(rameshEmp2WorkerId, employer2Id, site3Id, `${currentMonth}-02`, owner2UserId);
  }

  // Seed Advances, Payments, Bonuses, Deductions, Expenses
  db.prepare(
    `INSERT INTO advances (worker_id, employer_id, site_id, amount, payment_mode, date, time, reason, recorded_by_user_id)
     VALUES (?, ?, ?, 2000, 'UPI', ?, '18:15', 'घर खर्च हेतु अग्रिम (Family expense advance)', ?)`
  ).run(workerIds[0], employerId, site1Id, `${currentMonth}-05`, ownerUserId);

  db.prepare(
    `INSERT INTO advances (worker_id, employer_id, site_id, amount, payment_mode, date, time, reason, recorded_by_user_id)
     VALUES (?, ?, ?, 1000, 'CASH', ?, '13:30', 'Medical emergency advance', ?)`
  ).run(workerIds[1], employerId, site1Id, `${currentMonth}-06`, ownerUserId);

  db.prepare(
    `INSERT INTO payments (worker_id, employer_id, site_id, amount, payment_mode, reference_no, date, time, description, recorded_by_user_id)
     VALUES (?, ?, ?, 3500, 'UPI', 'UPI-40928172', ?, '19:10', 'साप्ताहिक भुगतान (Weekly settlement)', ?)`
  ).run(workerIds[0], employerId, site1Id, `${currentMonth}-07`, ownerUserId);

  db.prepare(
    `INSERT INTO payments (worker_id, employer_id, site_id, amount, payment_mode, reference_no, date, time, description, recorded_by_user_id)
     VALUES (?, ?, ?, 2500, 'CASH', 'CASH-0012', ?, '18:45', 'Weekly cash payout', ?)`
  ).run(workerIds[1], employerId, site1Id, `${currentMonth}-07`, ownerUserId);

  db.prepare(
    `INSERT INTO bonuses (worker_id, employer_id, amount, date, time, reason, recorded_by_user_id)
     VALUES (?, ?, 500, ?, '17:30', 'स्लैब कास्टिंग समय पर पूरा करने का बोनस (On-time slab completion)', ?)`
  ).run(workerIds[0], employerId, `${currentMonth}-08`, ownerUserId);

  db.prepare(
    `INSERT INTO deductions (worker_id, employer_id, amount, date, time, reason, recorded_by_user_id)
     VALUES (?, ?, 200, ?, '16:00', 'Safety helmet replacement deduction', ?)`
  ).run(workerIds[1], employerId, `${currentMonth}-09`, ownerUserId);

  db.prepare(
    `INSERT INTO expenses (employer_id, site_id, category, amount, date, time, description, recorded_by_user_id)
     VALUES (?, ?, 'Material & Tools', 4850, ?, '11:20', 'Cement mixer diesel & safety gloves batch', ?)`
  ).run(employerId, site1Id, todayStr, ownerUserId);

  db.prepare(
    `INSERT INTO expenses (employer_id, site_id, category, amount, date, time, description, recorded_by_user_id)
     VALUES (?, ?, 'Site Refreshments', 640, ?, '16:15', 'Tea & snacks for evening shift', ?)`
  ).run(employerId, site2Id, todayStr, ownerUserId);

  // Seed Leave Request
  db.prepare(
    `INSERT INTO leave_requests (worker_id, employer_id, from_date, to_date, reason, status)
     VALUES (?, ?, ?, ?, 'गाँव में पारिवारिक कार्यक्रम (Family function in village)', 'PENDING')`
  ).run(workerIds[0], employerId, todayStr, todayStr);

  // Recalculate all monthly salary snapshots
  for (const wid of [...workerIds, rameshEmp2WorkerId]) {
    calculateAndPersistSalary(db, wid, currentMonth);
  }

  // Notifications & Audit logs
  notifyWorker(db, {
    workerId: workerIds[0],
    employerId,
    type: 'PAYMENT',
    titleEn: 'Payment Received: ₹3,500',
    titleHi: 'भुगतान प्राप्त: ₹3,500',
    messageEn: 'Weekly settlement ₹3,500 paid via UPI (Ref: UPI-40928172).',
    messageHi: 'साप्ताहिक भुगतान ₹3,500 UPI द्वारा प्राप्त हुआ (Ref: UPI-40928172)।',
  });

  notifyWorker(db, {
    workerId: workerIds[0],
    employerId,
    type: 'BONUS',
    titleEn: 'Bonus Credited: ₹500',
    titleHi: 'बोनस जुड़ा: ₹500',
    messageEn: '₹500 bonus added for on-time slab completion.',
    messageHi: 'स्लैब कास्टिंग समय पर पूरा करने के लिए ₹500 बोनस जोड़ा गया।',
  });

  writeAuditLog(db, {
    actorUserId: ownerUserId,
    actorName: 'राजेश शर्मा',
    actorRole: 'OWNER',
    employerId,
    workerId: workerIds[0],
    action: 'ADD_BONUS',
    entityType: 'bonuses',
    entityId: 1,
    newValue: { amount: 500, reason: 'On-time slab completion' },
    reason: 'On-time slab completion',
  });

  return db;
}
