# MAJDOOR MITRA — Firestore Security Specification

## 1. Data Invariants & Source of Truth
1. **Founder Super Admin Authority (`super_admins/{adminId}`)**: Founder Raja (`rh588193@gmail.com` with `email_verified == true`, or UID registered in `super_admins/{uid}`) holds `SUPER_ADMIN` privileges. `super_admins/{adminId}` is strictly read-only from client SDKs (`allow create, update, delete: if false`).
2. **User Isolation & Anti-Escalation (`users/{userId}`)**: A signed-in user can only read, create, or update their own `users/{uid}` document (`userId == request.auth.uid`). Ordinary users can ONLY create `role in ['WORKER', 'OWNER']` with `accountStatus == 'ACTIVE'` and `isFounder == false`. `uid`, `role`, `accountStatus`, and `isFounder` are immutable by regular users. Only `isSuperAdmin()` can list users, suspend/deactivate non-`SUPER_ADMIN` accounts, or delete non-`SUPER_ADMIN` accounts.
3. **Global App Settings (`app_settings/global`)**: Signed-in users may `get` `/app_settings/global` to enforce maintenance mode, worker quotas, and feature flags. Only `isSuperAdmin()` may create or update `/app_settings/global`.
4. **Employer Scoping & Subscriptions (`employers/{employerId}`, `work_sites/{siteId}`)**: Only the authenticated owner (`ownerUid == request.auth.uid`) can create/edit their organization metadata (`businessName`, `ownerName`, `mobile`, `address`). Only `isSuperAdmin()` can modify `subscriptionPlan`, `maxWorkers`, `subscriptionExpiresAt`, or `accountStatus`.
5. **Worker-Owner Access Boundary (`workers/{workerId}`)**: Only the owning employer (`employerUid == request.auth.uid`) can add, edit, wage-configure, or remove workers. A worker can only read/list records matching their `workerUid == request.auth.uid` or verified `phone_number == mobileE164`, and can only update `['workerUid', 'updatedAt']` once when claiming an unlinked record.
6. **Attendance Integrity (`attendance/{attendanceId}`)**: Workers CANNOT update or delete any attendance record. A worker may only `create` a single `PRESENT` check-in (`markedByRole == 'WORKER'`, `gpsVerified == true`, `overtimeHours == 0`) if no record exists for that date. Only the owning employer (`employerUid == request.auth.uid`) can mark or correct attendance (`editHistory` capped at 30 entries).
7. **Immutable Financial Ledger (`transactions/{txId}`, `audit_logs/{logId}`)**: Only the owning employer can create financial transactions (`amount > 0`). Nobody (neither worker nor owner) can update or delete committed financial transactions or audit logs.
8. **Leave Request Terminal Locking (`leave_requests/{leaveId}`)**: Workers can only create `PENDING` leave requests for themselves. Employers can only transition `PENDING` requests to `APPROVED` or `REJECTED`; once approved or rejected, the status is locked.
9. **Temporal & ID Hardening**: Every single-document operation validates `isValidId(docId)` (`^[a-zA-Z0-9_-]{1,128}$`), enforces strict string bounds, and validates `createdAt == request.time` / `updatedAt == request.time`.

## 2. "Dirty Dozen+" Adversarial Test Payloads (Expected: PERMISSION_DENIED)
1. **Cross-Tenant User Read**: Worker UID `workerA` tries `get(/users/ownerB)`.
2. **Self-Role Escalation to OWNER or SUPER_ADMIN**: User with `role: 'WORKER'` tries `update(/users/workerA, { role: 'SUPER_ADMIN', isFounder: true })` or `create(/users/attacker, { role: 'SUPER_ADMIN', ... })`.
3. **Self-Registration into `super_admins`**: Attacker tries `create(/super_admins/attacker, { uid: 'attacker', founderName: 'Fake' })`.
4. **Account Status Bypass**: Suspended user tries `update(/users/workerA, { accountStatus: 'ACTIVE' })`.
5. **Subscription Self-Upgrade**: Employer tries `update(/employers/ownerA, { subscriptionPlan: 'ENTERPRISE', maxWorkers: 9999 })`.
6. **Unauthorized App Settings Tampering**: Non-founder user tries `update(/app_settings/global, { maintenanceMode: true })`.
7. **Worker Wage Tampering**: Worker tries `update(/workers/w1, { dailyWage: 5000 })`.
8. **Worker Attendance Overwrite**: Worker tries `update(/attendance/w1_2026-11-19, { status: 'PRESENT', overtimeHours: 8 })`.
9. **Worker Forged Overtime on GPS Check-In**: Worker tries `create(/attendance/w1_2026-11-19, { ..., status: 'PRESENT', overtimeHours: 5, markedByRole: 'WORKER' })`.
10. **Unauthorized Transaction Creation / Deletion**: Worker tries `create(/transactions/tx1, ...)` or Owner tries `delete(/transactions/tx1)`.
11. **Blanket List Scraping**: Worker `workerA` tries `list(/workers)` or `list(/users)` without ownership filter.
12. **Client Timestamp Forgery**: Owner tries `create(/transactions/tx2, { ..., createdAt: <past timestamp> })` instead of `request.time`.
