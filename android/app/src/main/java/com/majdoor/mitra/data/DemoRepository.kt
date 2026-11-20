package com.majdoor.mitra.data

import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AppThemeMode
import com.majdoor.mitra.model.AttendanceRecord
import com.majdoor.mitra.model.AttendanceStatus
import com.majdoor.mitra.model.AuditLog
import com.majdoor.mitra.model.EmployerOrg
import com.majdoor.mitra.model.FinancialTransaction
import com.majdoor.mitra.model.LeaveRequest
import com.majdoor.mitra.model.LeaveStatus
import com.majdoor.mitra.model.NotificationItem
import com.majdoor.mitra.model.PaymentMode
import com.majdoor.mitra.model.PayrollCalculator
import com.majdoor.mitra.model.SiteStatus
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.model.UserAccount
import com.majdoor.mitra.model.UserRole
import com.majdoor.mitra.model.WageType
import com.majdoor.mitra.model.WorkSite
import com.majdoor.mitra.model.WorkerProfile
import com.majdoor.mitra.model.WorkerStatus
import com.majdoor.mitra.util.ExportHelper
import kotlinx.coroutines.delay
import org.json.JSONObject

class DemoRepository(private val initialRole: UserRole) : MajdoorRepository {
    override val isDemo: Boolean = true

    private var currentAccount: UserAccount
    private var employerOrg: EmployerOrg
    private val sites = mutableListOf<WorkSite>()
    private val workers = mutableListOf<WorkerProfile>()
    private val attendance = mutableListOf<AttendanceRecord>()
    private val transactions = mutableListOf<FinancialTransaction>()
    private val leaves = mutableListOf<LeaveRequest>()
    private val notifications = mutableListOf<NotificationItem>()
    private val auditLogs = mutableListOf<AuditLog>()

    init {
        val ownerUid = "demo_owner_1"
        val workerUid = "demo_worker_1"
        val today = PayrollCalculator.todayYmd()
        val ym = PayrollCalculator.currentYm()

        employerOrg = EmployerOrg(
            id = ownerUid,
            ownerUid = ownerUid,
            businessName = "शर्मा कंस्ट्रक्शन एंड बिल्डर्स",
            ownerName = "राजेश शर्मा",
            mobile = "9811223344",
            address = "सेक्टर 18, रोहिणी, नई दिल्ली"
        )

        currentAccount = if (initialRole == UserRole.OWNER) {
            UserAccount(
                uid = ownerUid,
                mobile = "9811223344",
                mobileE164 = "+919811223344",
                name = "राजेश शर्मा",
                role = UserRole.OWNER,
                language = AppLanguage.HI,
                theme = AppThemeMode.LIGHT,
                employerUid = ownerUid
            )
        } else {
            UserAccount(
                uid = workerUid,
                mobile = "9876543210",
                mobileE164 = "+919876543210",
                name = "रमेश कुमार",
                role = UserRole.WORKER,
                language = AppLanguage.HI,
                theme = AppThemeMode.LIGHT,
                employerUid = ownerUid
            )
        }

        val site1 = WorkSite(
            id = "demo_site_1",
            employerUid = ownerUid,
            name = "मेट्रो फेज-4 पिलर साइट",
            location = "रोहिणी सेक्टर 18, दिल्ली",
            latitude = 28.7383,
            longitude = 77.1411,
            radiusMeters = 500.0,
            status = SiteStatus.ACTIVE
        )
        val site2 = WorkSite(
            id = "demo_site_2",
            employerUid = ownerUid,
            name = "द्वारका रेजिडेंशियल टॉवर-B",
            location = "द्वारका सेक्टर 21, दिल्ली",
            latitude = 28.5521,
            longitude = 77.0582,
            radiusMeters = 400.0,
            status = SiteStatus.ACTIVE
        )
        sites.addAll(listOf(site1, site2))

        val w1 = WorkerProfile(
            id = "demo_w_1",
            uniqueWorkerId = "MM-1001",
            employerUid = ownerUid,
            employerName = employerOrg.businessName,
            employerMobile = employerOrg.mobile,
            workerUid = workerUid,
            siteId = site1.id,
            siteName = site1.name,
            siteLat = site1.latitude,
            siteLng = site1.longitude,
            siteRadiusMeters = site1.radiusMeters,
            name = "रमेश कुमार",
            mobile = "9876543210",
            mobileE164 = "+919876543210",
            skillRole = "राजमिस्त्री (Mason)",
            wageType = WageType.DAILY,
            dailyWage = 850.0,
            monthlySalary = 0.0,
            overtimeRate = 120.0,
            status = WorkerStatus.ACTIVE,
            joinedAt = "$ym-01"
        )
        val w2 = WorkerProfile(
            id = "demo_w_2",
            uniqueWorkerId = "MM-1002",
            employerUid = ownerUid,
            employerName = employerOrg.businessName,
            employerMobile = employerOrg.mobile,
            workerUid = "demo_worker_2",
            siteId = site1.id,
            siteName = site1.name,
            siteLat = site1.latitude,
            siteLng = site1.longitude,
            siteRadiusMeters = site1.radiusMeters,
            name = "सुनीता देवी",
            mobile = "9876501122",
            mobileE164 = "+919876501122",
            skillRole = "सहायक (Helper)",
            wageType = WageType.DAILY,
            dailyWage = 650.0,
            monthlySalary = 0.0,
            overtimeRate = 90.0,
            status = WorkerStatus.ACTIVE,
            joinedAt = "$ym-01"
        )
        val w3 = WorkerProfile(
            id = "demo_w_3",
            uniqueWorkerId = "MM-1003",
            employerUid = ownerUid,
            employerName = employerOrg.businessName,
            employerMobile = employerOrg.mobile,
            workerUid = "demo_worker_3",
            siteId = site2.id,
            siteName = site2.name,
            siteLat = site2.latitude,
            siteLng = site2.longitude,
            siteRadiusMeters = site2.radiusMeters,
            name = "इमरान अंसारी",
            mobile = "9810099887",
            mobileE164 = "+919810099887",
            skillRole = "इलेक्ट्रीशियन (Electrician)",
            wageType = WageType.MONTHLY,
            dailyWage = 0.0,
            monthlySalary = 24000.0,
            overtimeRate = 140.0,
            status = WorkerStatus.ACTIVE,
            joinedAt = "$ym-01"
        )
        val w4 = WorkerProfile(
            id = "demo_w_4",
            uniqueWorkerId = "MM-1004",
            employerUid = ownerUid,
            employerName = employerOrg.businessName,
            employerMobile = employerOrg.mobile,
            workerUid = "demo_worker_4",
            siteId = site2.id,
            siteName = site2.name,
            siteLat = site2.latitude,
            siteLng = site2.longitude,
            siteRadiusMeters = site2.radiusMeters,
            name = "मनोज यादव",
            mobile = "9711224455",
            mobileE164 = "+919711224455",
            skillRole = "बढ़ई (Carpenter)",
            wageType = WageType.DAILY,
            dailyWage = 900.0,
            monthlySalary = 0.0,
            overtimeRate = 130.0,
            status = WorkerStatus.ACTIVE,
            joinedAt = "$ym-01"
        )
        workers.addAll(listOf(w1, w2, w3, w4))

        val dates = PayrollCalculator.monthDates(ym).filter { it <= today }
        for ((dIdx, dt) in dates.withIndex()) {
            workers.forEachIndexed { wIdx, w ->
                val status = when {
                    (dIdx + wIdx) % 9 == 0 -> AttendanceStatus.HALF_DAY
                    (dIdx + wIdx) % 13 == 0 -> AttendanceStatus.ABSENT
                    dIdx == 5 && wIdx == 0 -> AttendanceStatus.PAID_LEAVE
                    else -> AttendanceStatus.PRESENT
                }
                val ot = if (status == AttendanceStatus.PRESENT && (dIdx + wIdx) % 3 == 0) 2.0 else 0.0
                val hrs = when (status) {
                    AttendanceStatus.PRESENT -> 8.0
                    AttendanceStatus.HALF_DAY -> 4.0
                    AttendanceStatus.PAID_LEAVE -> 8.0
                    AttendanceStatus.ABSENT -> 0.0
                }
                attendance.add(
                    AttendanceRecord(
                        id = "att_${w.id}_$dt",
                        workerId = w.id,
                        workerUid = w.workerUid,
                        workerMobileE164 = w.mobileE164,
                        employerUid = ownerUid,
                        siteId = w.siteId,
                        date = dt,
                        month = ym,
                        status = status,
                        hoursWorked = hrs,
                        overtimeHours = ot,
                        gpsLat = w.siteLat,
                        gpsLng = w.siteLng,
                        gpsVerified = wIdx == 0 && dIdx % 2 == 0,
                        markedByUid = ownerUid,
                        markedByRole = UserRole.OWNER,
                        editReason = if (dIdx == 2 && wIdx == 0) "साइट सुपरवाइज़र द्वारा 2 घंटे ओवरटाइम जोड़ा गया" else "",
                        editHistory = if (dIdx == 2 && wIdx == 0) listOf("$dt: PRESENT + 2h OT (Supervisor confirmation)") else emptyList(),
                        notes = ""
                    )
                )
            }
        }

        transactions.addAll(
            listOf(
                FinancialTransaction(
                    id = "demo_tx_1",
                    category = TransactionCategory.ADVANCE,
                    employerUid = ownerUid,
                    workerId = w1.id,
                    workerUid = w1.workerUid,
                    workerMobileE164 = w1.mobileE164,
                    workerName = w1.name,
                    uniqueWorkerId = w1.uniqueWorkerId,
                    siteId = w1.siteId,
                    amount = 2000.0,
                    mode = PaymentMode.UPI,
                    referenceNo = "UPI-448291",
                    date = dates.firstOrNull() ?: today,
                    month = ym,
                    time = "11:15",
                    description = "राशन और घर खर्च के लिए एडवांस",
                    recordedByUid = ownerUid
                ),
                FinancialTransaction(
                    id = "demo_tx_2",
                    category = TransactionCategory.PAYMENT,
                    employerUid = ownerUid,
                    workerId = w1.id,
                    workerUid = w1.workerUid,
                    workerMobileE164 = w1.mobileE164,
                    workerName = w1.name,
                    uniqueWorkerId = w1.uniqueWorkerId,
                    siteId = w1.siteId,
                    amount = 3500.0,
                    mode = PaymentMode.CASH,
                    referenceNo = "CASH-102",
                    date = dates.getOrElse(dates.size / 2) { today },
                    month = ym,
                    time = "18:40",
                    description = "साप्ताहिक हिसाब भुगतान",
                    recordedByUid = ownerUid
                ),
                FinancialTransaction(
                    id = "demo_tx_3",
                    category = TransactionCategory.BONUS,
                    employerUid = ownerUid,
                    workerId = w1.id,
                    workerUid = w1.workerUid,
                    workerMobileE164 = w1.mobileE164,
                    workerName = w1.name,
                    uniqueWorkerId = w1.uniqueWorkerId,
                    siteId = w1.siteId,
                    amount = 500.0,
                    mode = PaymentMode.ADJUSTMENT,
                    referenceNo = "",
                    date = today,
                    month = ym,
                    time = "17:30",
                    description = "पिलर स्लैब समय पर पूरा करने का बोनस",
                    recordedByUid = ownerUid
                ),
                FinancialTransaction(
                    id = "demo_tx_4",
                    category = TransactionCategory.ADVANCE,
                    employerUid = ownerUid,
                    workerId = w2.id,
                    workerUid = w2.workerUid,
                    workerMobileE164 = w2.mobileE164,
                    workerName = w2.name,
                    uniqueWorkerId = w2.uniqueWorkerId,
                    siteId = w2.siteId,
                    amount = 1500.0,
                    mode = PaymentMode.UPI,
                    referenceNo = "UPI-993012",
                    date = today,
                    month = ym,
                    time = "13:05",
                    description = "मेडिकल खर्च एडवांस",
                    recordedByUid = ownerUid
                ),
                FinancialTransaction(
                    id = "demo_tx_5",
                    category = TransactionCategory.EXPENSE,
                    employerUid = ownerUid,
                    workerId = "",
                    workerUid = "",
                    workerMobileE164 = "",
                    workerName = "Site Expense",
                    uniqueWorkerId = "",
                    siteId = site1.id,
                    amount = 4200.0,
                    mode = PaymentMode.SITE,
                    referenceNo = "BILL-881",
                    date = today,
                    month = ym,
                    time = "10:20",
                    description = "सीमेंट और सुरक्षा हेलमेट खरीद",
                    recordedByUid = ownerUid
                )
            )
        )

        leaves.add(
            LeaveRequest(
                id = "demo_lv_1",
                workerId = w2.id,
                workerUid = w2.workerUid,
                workerMobileE164 = w2.mobileE164,
                workerName = w2.name,
                uniqueWorkerId = w2.uniqueWorkerId,
                employerUid = ownerUid,
                fromDate = PayrollCalculator.shiftDateYmd(today, 2),
                toDate = PayrollCalculator.shiftDateYmd(today, 3),
                reason = "गांव में पारिवारिक कार्यक्रम",
                status = LeaveStatus.PENDING,
                ownerNote = ""
            )
        )

        notifications.add(
            NotificationItem(
                id = "demo_notif_1",
                employerUid = ownerUid,
                workerId = w1.id,
                workerUid = w1.workerUid,
                workerMobileE164 = w1.mobileE164,
                type = "BONUS",
                titleEn = "Bonus Added: ₹500",
                titleHi = "बोनस जोड़ा गया: ₹500",
                messageEn = "Rajesh Sharma added ₹500 bonus for timely slab completion.",
                messageHi = "राजेश शर्मा ने स्लैब कार्य पूरा होने पर ₹500 का बोनस जोड़ा।",
                isRead = false
            )
        )

        auditLogs.add(
            AuditLog(
                id = "demo_log_1",
                employerUid = ownerUid,
                workerId = w1.id,
                actorUid = ownerUid,
                actorName = "राजेश शर्मा",
                actorRole = UserRole.OWNER,
                action = "RECORD_BONUS",
                entityType = "TRANSACTION",
                entityId = "demo_tx_3",
                reason = "स्लैब कार्य समय पर पूरा",
                summary = "रमेश कुमार को ₹500 बोनस दर्ज किया गया"
            )
        )
    }

    override suspend fun getCurrentAccount(): UserAccount = currentAccount

    override suspend fun sendPhoneOtp(
        activity: android.app.Activity,
        mobile10: String,
        role: UserRole,
        name: String,
        businessName: String,
        address: String,
        language: AppLanguage,
        theme: AppThemeMode
    ): OtpSendResult {
        delay(200)
        return OtpSendResult.CodeSent("demo_verification")
    }

    override suspend fun verifyPhoneOtp(
        verificationId: String,
        otpCode: String,
        mobile10: String,
        role: UserRole,
        name: String,
        businessName: String,
        address: String,
        language: AppLanguage,
        theme: AppThemeMode
    ): Result<UserAccount> = Result.success(currentAccount)

    override suspend fun signOut() {
        // Handled by caller clearing session
    }

    override suspend fun updatePreferences(
        account: UserAccount,
        language: AppLanguage,
        theme: AppThemeMode
    ): Result<UserAccount> {
        currentAccount = account.copy(language = language, theme = theme)
        return Result.success(currentAccount)
    }

    override suspend fun loadWorkspace(account: UserAccount): Result<AppWorkspaceData> {
        val ym = PayrollCalculator.currentYm()
        val visibleWorkers = if (account.role == UserRole.OWNER) {
            workers.toList()
        } else {
            workers.filter { it.workerUid == account.uid || it.mobile == account.mobile }
        }
        val salaries = visibleWorkers.map { w ->
            PayrollCalculator.recomputeSalary(w, ym, attendance, transactions)
        }
        val visibleWorkerIds = visibleWorkers.map { it.id }.toSet()
        return Result.success(
            AppWorkspaceData(
                account = currentAccount,
                employerOrg = employerOrg,
                workSites = sites.toList(),
                workers = visibleWorkers,
                attendance = if (account.role == UserRole.OWNER) attendance.toList() else attendance.filter { it.workerId in visibleWorkerIds },
                salaries = salaries,
                transactions = if (account.role == UserRole.OWNER) transactions.toList() else transactions.filter { it.workerId in visibleWorkerIds },
                leaveRequests = if (account.role == UserRole.OWNER) leaves.toList() else leaves.filter { it.workerId in visibleWorkerIds },
                notifications = if (account.role == UserRole.OWNER) notifications.toList() else notifications.filter { it.workerId in visibleWorkerIds },
                auditLogs = auditLogs.toList()
            )
        )
    }

    override suspend fun updateEmployerOrg(
        account: UserAccount,
        businessName: String,
        ownerName: String,
        address: String
    ): Result<EmployerOrg> {
        employerOrg = employerOrg.copy(businessName = businessName, ownerName = ownerName, address = address)
        return Result.success(employerOrg)
    }

    override suspend fun upsertWorkSite(
        account: UserAccount,
        existingSiteId: String?,
        input: SiteInput
    ): Result<WorkSite> {
        val site = WorkSite(
            id = existingSiteId ?: "demo_site_${System.currentTimeMillis()}",
            employerUid = account.uid,
            name = input.name,
            location = input.location,
            latitude = input.latitude,
            longitude = input.longitude,
            radiusMeters = input.radiusMeters,
            status = input.status
        )
        sites.removeAll { it.id == site.id }
        sites.add(0, site)
        return Result.success(site)
    }

    override suspend fun deleteWorkSite(account: UserAccount, siteId: String): Result<Unit> {
        sites.removeAll { it.id == siteId }
        return Result.success(Unit)
    }

    override suspend fun upsertWorker(
        account: UserAccount,
        employerOrg: EmployerOrg?,
        sites: List<WorkSite>,
        existingWorker: WorkerProfile?,
        input: WorkerInput
    ): Result<WorkerProfile> {
        val site = sites.firstOrNull { it.id == input.siteId }
        val cleanMob = input.mobile.filter { it.isDigit() }.takeLast(10)
        val profile = WorkerProfile(
            id = existingWorker?.id ?: "demo_w_${System.currentTimeMillis()}",
            uniqueWorkerId = existingWorker?.uniqueWorkerId ?: "MM-${1000 + workers.size + 1}",
            employerUid = account.uid,
            employerName = this.employerOrg.businessName,
            employerMobile = this.employerOrg.mobile,
            workerUid = existingWorker?.workerUid ?: "",
            siteId = site?.id ?: input.siteId,
            siteName = site?.name ?: "",
            siteLat = site?.latitude,
            siteLng = site?.longitude,
            siteRadiusMeters = site?.radiusMeters,
            name = input.name,
            mobile = cleanMob,
            mobileE164 = "+91$cleanMob",
            photoUrl = input.photoUrl,
            skillRole = input.skillRole,
            wageType = input.wageType,
            dailyWage = input.dailyWage,
            monthlySalary = input.monthlySalary,
            overtimeRate = input.overtimeRate,
            status = input.status,
            joinedAt = existingWorker?.joinedAt ?: PayrollCalculator.todayYmd()
        )
        workers.removeAll { it.id == profile.id }
        workers.add(0, profile)
        return Result.success(profile)
    }

    override suspend fun deleteWorker(account: UserAccount, workerId: String): Result<Unit> {
        workers.removeAll { it.id == workerId }
        return Result.success(Unit)
    }

    override suspend fun markOrEditAttendance(
        account: UserAccount,
        worker: WorkerProfile,
        existingRecord: AttendanceRecord?,
        input: AttendanceMarkInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<AttendanceRecord> {
        val attId = existingRecord?.id ?: "att_${worker.id}_${input.date}"
        val history = existingRecord?.editHistory.orEmpty().toMutableList()
        if (existingRecord != null && input.editReason.isNotBlank()) {
            history.add(0, "${PayrollCalculator.todayYmd()} ${PayrollCalculator.nowTimeHm()}: ${existingRecord.status.apiValue} -> ${input.status.apiValue} (${input.editReason})")
        }
        val rec = AttendanceRecord(
            id = attId,
            workerId = worker.id,
            workerUid = worker.workerUid,
            workerMobileE164 = worker.mobileE164,
            employerUid = worker.employerUid,
            siteId = worker.siteId,
            date = input.date,
            month = input.date.take(7),
            status = input.status,
            hoursWorked = input.hoursWorked,
            overtimeHours = input.overtimeHours,
            gpsLat = input.gpsLat ?: existingRecord?.gpsLat,
            gpsLng = input.gpsLng ?: existingRecord?.gpsLng,
            gpsVerified = input.gpsVerified || (existingRecord?.gpsVerified == true),
            markedByUid = account.uid,
            markedByRole = UserRole.OWNER,
            editReason = input.editReason,
            editHistory = history.take(30),
            notes = input.notes
        )
        attendance.removeAll { it.id == attId }
        attendance.add(0, rec)
        notifications.add(
            0,
            NotificationItem(
                id = "notif_${System.currentTimeMillis()}",
                employerUid = worker.employerUid,
                workerId = worker.id,
                workerUid = worker.workerUid,
                workerMobileE164 = worker.mobileE164,
                type = "ATTENDANCE",
                titleEn = "Attendance Updated (${input.date})",
                titleHi = "हाजिरी अपडेट (${input.date})",
                messageEn = "Marked ${input.status.apiValue} with ${input.overtimeHours}h OT. ${input.editReason}",
                messageHi = "${input.status.apiValue} दर्ज (${input.overtimeHours}h OT). ${input.editReason}"
            )
        )
        auditLogs.add(
            0,
            AuditLog(
                id = "log_${System.currentTimeMillis()}",
                employerUid = worker.employerUid,
                workerId = worker.id,
                actorUid = account.uid,
                actorName = account.name,
                actorRole = UserRole.OWNER,
                action = if (existingRecord == null) "MARK_ATTENDANCE" else "EDIT_ATTENDANCE",
                entityType = "ATTENDANCE",
                entityId = attId,
                reason = input.editReason,
                summary = "${worker.name} (${input.date}): ${input.status.apiValue}, OT ${input.overtimeHours}h"
            )
        )
        return Result.success(rec)
    }

    override suspend fun bulkMarkPresent(
        account: UserAccount,
        workers: List<WorkerProfile>,
        date: String,
        existingAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<Int> {
        var count = 0
        for (w in workers.filter { it.status == WorkerStatus.ACTIVE }) {
            val existing = attendance.firstOrNull { it.workerId == w.id && it.date == date }
            if (existing == null) {
                markOrEditAttendance(
                    account = account,
                    worker = w,
                    existingRecord = null,
                    input = AttendanceMarkInput(
                        workerId = w.id,
                        date = date,
                        status = AttendanceStatus.PRESENT,
                        hoursWorked = 8.0,
                        overtimeHours = 0.0,
                        editReason = "",
                        notes = "Bulk mark present"
                    ),
                    allAttendance = attendance,
                    allTransactions = transactions
                )
                count++
            }
        }
        return Result.success(count)
    }

    override suspend fun recordTransaction(
        account: UserAccount,
        workers: List<WorkerProfile>,
        input: TransactionInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<FinancialTransaction> {
        val w = workers.firstOrNull { it.id == input.workerId }
        val tx = FinancialTransaction(
            id = "tx_${System.currentTimeMillis()}",
            category = input.category,
            employerUid = account.uid,
            workerId = w?.id ?: "",
            workerUid = w?.workerUid ?: "",
            workerMobileE164 = w?.mobileE164 ?: "",
            workerName = w?.name ?: "Site Expense",
            uniqueWorkerId = w?.uniqueWorkerId ?: "",
            siteId = input.siteId.ifBlank { w?.siteId ?: "" },
            amount = input.amount,
            mode = input.mode,
            referenceNo = input.referenceNo,
            date = input.date,
            month = input.date.take(7),
            time = PayrollCalculator.nowTimeHm(),
            description = input.description,
            recordedByUid = account.uid
        )
        transactions.add(0, tx)
        if (w != null) {
            notifications.add(
                0,
                NotificationItem(
                    id = "notif_${System.currentTimeMillis()}",
                    employerUid = account.uid,
                    workerId = w.id,
                    workerUid = w.workerUid,
                    workerMobileE164 = w.mobileE164,
                    type = input.category.apiValue,
                    titleEn = "${input.category.apiValue}: ₹${input.amount.toInt()}",
                    titleHi = "${input.category.apiValue}: ₹${input.amount.toInt()}",
                    messageEn = "${account.name} recorded ₹${input.amount.toInt()} (${input.description})",
                    messageHi = "${account.name} ने ₹${input.amount.toInt()} दर्ज किया (${input.description})"
                )
            )
        }
        auditLogs.add(
            0,
            AuditLog(
                id = "log_${System.currentTimeMillis()}",
                employerUid = account.uid,
                workerId = w?.id ?: "",
                actorUid = account.uid,
                actorName = account.name,
                actorRole = UserRole.OWNER,
                action = "TX_${input.category.apiValue}",
                entityType = "TRANSACTION",
                entityId = tx.id,
                reason = input.description,
                summary = "${tx.workerName}: ${tx.category.apiValue} ₹${tx.amount.toInt()}"
            )
        )
        return Result.success(tx)
    }

    override suspend fun respondToLeave(
        account: UserAccount,
        leave: LeaveRequest,
        newStatus: LeaveStatus,
        ownerNote: String
    ): Result<LeaveRequest> {
        val updated = leave.copy(status = newStatus, ownerNote = ownerNote)
        val idx = leaves.indexOfFirst { it.id == leave.id }
        if (idx >= 0) leaves[idx] = updated
        return Result.success(updated)
    }

    override suspend fun submitWorkerGpsCheckIn(
        account: UserAccount,
        worker: WorkerProfile,
        date: String,
        gpsLat: Double,
        gpsLng: Double,
        gpsVerified: Boolean,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<AttendanceRecord> {
        val attId = "att_${worker.id}_$date"
        if (attendance.any { it.id == attId }) {
            return Result.failure(IllegalStateException("Today's attendance is already recorded."))
        }
        val rec = AttendanceRecord(
            id = attId,
            workerId = worker.id,
            workerUid = account.uid,
            workerMobileE164 = worker.mobileE164,
            employerUid = worker.employerUid,
            siteId = worker.siteId,
            date = date,
            month = date.take(7),
            status = AttendanceStatus.PRESENT,
            hoursWorked = 8.0,
            overtimeHours = 0.0,
            gpsLat = gpsLat,
            gpsLng = gpsLng,
            gpsVerified = gpsVerified,
            markedByUid = account.uid,
            markedByRole = UserRole.WORKER,
            editReason = "",
            editHistory = listOf("$date ${PayrollCalculator.nowTimeHm()}: GPS Check-in Verified"),
            notes = "Worker GPS check-in"
        )
        attendance.add(0, rec)
        return Result.success(rec)
    }

    override suspend fun submitLeaveRequest(
        account: UserAccount,
        worker: WorkerProfile,
        fromDate: String,
        toDate: String,
        reason: String
    ): Result<LeaveRequest> {
        val req = LeaveRequest(
            id = "lv_${System.currentTimeMillis()}",
            workerId = worker.id,
            workerUid = account.uid,
            workerMobileE164 = worker.mobileE164,
            workerName = worker.name,
            uniqueWorkerId = worker.uniqueWorkerId,
            employerUid = worker.employerUid,
            fromDate = fromDate,
            toDate = toDate,
            reason = reason,
            status = LeaveStatus.PENDING,
            ownerNote = ""
        )
        leaves.add(0, req)
        return Result.success(req)
    }

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> {
        val idx = notifications.indexOfFirst { it.id == notificationId }
        if (idx >= 0) notifications[idx] = notifications[idx].copy(isRead = true)
        return Result.success(Unit)
    }

    override suspend fun exportBackupJson(data: AppWorkspaceData): String = ExportHelper.buildBackupJson(data)

    override suspend fun importBackupJson(account: UserAccount, jsonString: String): Result<Int> {
        return runCatching {
            val root = JSONObject(jsonString)
            val wArr = root.optJSONArray("workers")
            var restored = 0
            if (wArr != null) {
                for (i in 0 until wArr.length()) {
                    val obj = wArr.getJSONObject(i)
                    val id = obj.optString("id")
                    if (id.isNotBlank() && workers.none { it.id == id }) {
                        workers.add(
                            WorkerProfile(
                                id = id,
                                uniqueWorkerId = obj.optString("uniqueWorkerId", "MM-${1000 + workers.size}"),
                                employerUid = account.uid,
                                employerName = employerOrg.businessName,
                                employerMobile = employerOrg.mobile,
                                siteId = obj.optString("siteId"),
                                siteName = obj.optString("siteName"),
                                name = obj.optString("name"),
                                mobile = obj.optString("mobile"),
                                mobileE164 = "+91${obj.optString("mobile")}",
                                skillRole = obj.optString("skillRole", "Worker"),
                                wageType = WageType.from(obj.optString("wageType")),
                                dailyWage = obj.optDouble("dailyWage", 0.0),
                                monthlySalary = obj.optDouble("monthlySalary", 0.0),
                                overtimeRate = obj.optDouble("overtimeRate", 0.0),
                                status = WorkerStatus.from(obj.optString("status")),
                                joinedAt = obj.optString("joinedAt", PayrollCalculator.todayYmd())
                            )
                        )
                        restored++
                    }
                }
            }
            restored
        }
    }
}
