package com.majdoor.mitra.data

import android.app.Activity
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
import com.majdoor.mitra.model.SalarySummary
import com.majdoor.mitra.model.SiteStatus
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.model.UserAccount
import com.majdoor.mitra.model.UserRole
import com.majdoor.mitra.model.WageType
import com.majdoor.mitra.model.WorkSite
import com.majdoor.mitra.model.WorkerProfile
import com.majdoor.mitra.model.WorkerStatus

sealed class OtpSendResult {
    data class CodeSent(val verificationId: String) : OtpSendResult()
    data class AutoVerified(val account: UserAccount) : OtpSendResult()
    data class Error(val message: String) : OtpSendResult()
}

data class WorkerInput(
    val name: String,
    val mobile: String,
    val skillRole: String,
    val siteId: String,
    val wageType: WageType,
    val dailyWage: Double,
    val monthlySalary: Double,
    val overtimeRate: Double,
    val photoUrl: String = "",
    val status: WorkerStatus = WorkerStatus.ACTIVE
)

data class SiteInput(
    val name: String,
    val location: String,
    val latitude: Double?,
    val longitude: Double?,
    val radiusMeters: Double,
    val status: SiteStatus = SiteStatus.ACTIVE
)

data class TransactionInput(
    val category: TransactionCategory,
    val workerId: String,
    val siteId: String,
    val amount: Double,
    val mode: PaymentMode,
    val referenceNo: String,
    val date: String,
    val description: String
)

data class AttendanceMarkInput(
    val workerId: String,
    val date: String,
    val status: AttendanceStatus,
    val hoursWorked: Double,
    val overtimeHours: Double,
    val editReason: String,
    val notes: String,
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsVerified: Boolean = false
)

data class AppWorkspaceData(
    val account: UserAccount,
    val employerOrg: EmployerOrg? = null,
    val workSites: List<WorkSite> = emptyList(),
    val workers: List<WorkerProfile> = emptyList(),
    val attendance: List<AttendanceRecord> = emptyList(),
    val salaries: List<SalarySummary> = emptyList(),
    val transactions: List<FinancialTransaction> = emptyList(),
    val leaveRequests: List<LeaveRequest> = emptyList(),
    val notifications: List<NotificationItem> = emptyList(),
    val auditLogs: List<AuditLog> = emptyList()
)

interface MajdoorRepository {
    val isDemo: Boolean

    suspend fun getCurrentAccount(): UserAccount?

    suspend fun sendPhoneOtp(
        activity: Activity,
        mobile10: String,
        role: UserRole,
        name: String,
        businessName: String,
        address: String,
        language: AppLanguage,
        theme: AppThemeMode
    ): OtpSendResult

    suspend fun verifyPhoneOtp(
        verificationId: String,
        otpCode: String,
        mobile10: String,
        role: UserRole,
        name: String,
        businessName: String,
        address: String,
        language: AppLanguage,
        theme: AppThemeMode
    ): Result<UserAccount>

    suspend fun signOut()

    suspend fun updatePreferences(
        account: UserAccount,
        language: AppLanguage,
        theme: AppThemeMode
    ): Result<UserAccount>

    suspend fun loadWorkspace(account: UserAccount): Result<AppWorkspaceData>

    // Owner actions
    suspend fun updateEmployerOrg(
        account: UserAccount,
        businessName: String,
        ownerName: String,
        address: String
    ): Result<EmployerOrg>

    suspend fun upsertWorkSite(
        account: UserAccount,
        existingSiteId: String?,
        input: SiteInput
    ): Result<WorkSite>

    suspend fun deleteWorkSite(account: UserAccount, siteId: String): Result<Unit>

    suspend fun upsertWorker(
        account: UserAccount,
        employerOrg: EmployerOrg?,
        sites: List<WorkSite>,
        existingWorker: WorkerProfile?,
        input: WorkerInput
    ): Result<WorkerProfile>

    suspend fun deleteWorker(account: UserAccount, workerId: String): Result<Unit>

    suspend fun markOrEditAttendance(
        account: UserAccount,
        worker: WorkerProfile,
        existingRecord: AttendanceRecord?,
        input: AttendanceMarkInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<AttendanceRecord>

    suspend fun bulkMarkPresent(
        account: UserAccount,
        workers: List<WorkerProfile>,
        date: String,
        existingAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<Int>

    suspend fun recordTransaction(
        account: UserAccount,
        workers: List<WorkerProfile>,
        input: TransactionInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<FinancialTransaction>

    suspend fun respondToLeave(
        account: UserAccount,
        leave: LeaveRequest,
        newStatus: LeaveStatus,
        ownerNote: String
    ): Result<LeaveRequest>

    // Worker actions
    suspend fun submitWorkerGpsCheckIn(
        account: UserAccount,
        worker: WorkerProfile,
        date: String,
        gpsLat: Double,
        gpsLng: Double,
        gpsVerified: Boolean,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<AttendanceRecord>

    suspend fun submitLeaveRequest(
        account: UserAccount,
        worker: WorkerProfile,
        fromDate: String,
        toDate: String,
        reason: String
    ): Result<LeaveRequest>

    suspend fun markNotificationRead(notificationId: String): Result<Unit>

    // Backup & Restore
    suspend fun exportBackupJson(data: AppWorkspaceData): String
    suspend fun importBackupJson(account: UserAccount, jsonString: String): Result<Int>
}
