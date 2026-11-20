package com.majdoor.mitra.data

import android.app.Activity
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseException
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.majdoor.mitra.BuildConfig
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
import com.majdoor.mitra.model.SalarySummary
import com.majdoor.mitra.model.SiteStatus
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.model.UserAccount
import com.majdoor.mitra.model.UserRole
import com.majdoor.mitra.model.WageType
import com.majdoor.mitra.model.WorkSite
import com.majdoor.mitra.model.WorkerProfile
import com.majdoor.mitra.model.WorkerStatus
import com.majdoor.mitra.util.ExportHelper
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume

class FirebaseRepository : MajdoorRepository {
    override val isDemo: Boolean = false

    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }
    private val db: FirebaseFirestore by lazy {
        FirebaseFirestore.getInstance(FirebaseApp.getInstance(), BuildConfig.FIRESTORE_DATABASE_ID)
    }

    private fun logFirestoreError(error: Exception, operation: String, path: String) {
        val u = auth.currentUser
        val info = JSONObject().apply {
            put("error", error.message ?: "Unknown Firestore error")
            put("operationType", operation)
            put("path", path)
            put("userId", u?.uid ?: "")
            put("phoneNumber", u?.phoneNumber ?: "")
            put("provider", u?.providerData?.firstOrNull()?.providerId ?: "")
        }
        Log.e("FirestoreError", info.toString(), error)
    }

    private fun sanitizeId(raw: String): String =
        raw.replace(Regex("[^a-zA-Z0-9_-]"), "_").take(128).ifBlank { "id_${System.currentTimeMillis()}" }

    private fun cleanMobile10(raw: String): String =
        raw.filter { it.isDigit() }.takeLast(10)

    override suspend fun getCurrentAccount(): UserAccount? {
        val user = auth.currentUser ?: return null
        return runCatching {
            val snap = db.collection("users").document(user.uid).get().await()
            if (snap.exists()) snap.toUserAccount() else null
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "get", "users/${user.uid}")
        }.getOrNull()
    }

    override suspend fun sendPhoneOtp(
        activity: Activity,
        mobile10: String,
        role: UserRole,
        name: String,
        businessName: String,
        address: String,
        language: AppLanguage,
        theme: AppThemeMode
    ): OtpSendResult {
        val clean = cleanMobile10(mobile10)
        if (clean.length != 10) {
            return OtpSendResult.Error("Please enter a valid 10-digit Indian mobile number.")
        }
        val e164 = "+91$clean"

        return suspendCancellableCoroutine { cont ->
            val callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    if (!cont.isActive) return
                    auth.signInWithCredential(credential).addOnSuccessListener { res ->
                        val uid = res.user?.uid ?: ""
                        if (uid.isNotBlank()) {
                            // Ensure profile exists via thread-safe Task callback
                            cont.resume(OtpSendResult.CodeSent("AUTO_VERIFIED:$uid"))
                        }
                    }.addOnFailureListener { ex ->
                        if (cont.isActive) cont.resume(OtpSendResult.Error(ex.message ?: "Auto verification failed"))
                    }
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    if (cont.isActive) {
                        val hint = e.message ?: "Phone verification failed."
                        cont.resume(OtpSendResult.Error(hint))
                    }
                }

                override fun onCodeSent(
                    verificationId: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    if (cont.isActive) {
                        cont.resume(OtpSendResult.CodeSent(verificationId))
                    }
                }
            }

            val options = PhoneAuthOptions.newBuilder(auth)
                .setPhoneNumber(e164)
                .setTimeout(60L, TimeUnit.SECONDS)
                .setActivity(activity)
                .setCallbacks(callbacks)
                .build()
            PhoneAuthProvider.verifyPhoneNumber(options)
        }
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
    ): Result<UserAccount> {
        return runCatching {
            val firebaseUser = if (verificationId.startsWith("AUTO_VERIFIED:") && auth.currentUser != null) {
                auth.currentUser!!
            } else {
                val credential = PhoneAuthProvider.getCredential(verificationId, otpCode.trim())
                val authResult = auth.signInWithCredential(credential).await()
                authResult.user ?: error("Authentication succeeded but user is null.")
            }

            val uid = firebaseUser.uid
            val phoneE164 = firebaseUser.phoneNumber?.takeIf { it.length == 13 }
                ?: "+91${cleanMobile10(mobile10)}"
            val clean10 = phoneE164.takeLast(10)

            val userRef = db.collection("users").document(uid)
            val existingSnap = userRef.get().await()

            val finalAccount = if (existingSnap.exists()) {
                val existing = existingSnap.toUserAccount()
                val updatedName = if (name.isNotBlank() && existing.name.isBlank()) name.trim() else existing.name
                userRef.update(
                    mapOf(
                        "name" to updatedName,
                        "language" to language.code,
                        "theme" to theme.code,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
                existing.copy(name = updatedName, language = language, theme = theme)
            } else {
                val displayName = name.trim().ifBlank {
                    if (role == UserRole.OWNER) "Owner $clean10" else "Worker $clean10"
                }
                val newUserMap = hashMapOf<String, Any>(
                    "uid" to uid,
                    "mobile" to clean10,
                    "mobileE164" to phoneE164,
                    "name" to displayName,
                    "role" to role.apiValue,
                    "language" to language.code,
                    "theme" to theme.code,
                    "employerUid" to if (role == UserRole.OWNER) uid else "",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                userRef.set(newUserMap).await()

                if (role == UserRole.OWNER) {
                    val empRef = db.collection("employers").document(uid)
                    val empSnap = empRef.get().await()
                    if (!empSnap.exists()) {
                        empRef.set(
                            mapOf(
                                "id" to uid,
                                "ownerUid" to uid,
                                "businessName" to businessName.trim().ifBlank { "$displayName Enterprises" },
                                "ownerName" to displayName,
                                "mobile" to clean10,
                                "address" to address.trim(),
                                "createdAt" to FieldValue.serverTimestamp(),
                                "updatedAt" to FieldValue.serverTimestamp()
                            )
                        ).await()
                    }
                }
                UserAccount(
                    uid = uid,
                    mobile = clean10,
                    mobileE164 = phoneE164,
                    name = displayName,
                    role = role,
                    language = language,
                    theme = theme,
                    employerUid = if (role == UserRole.OWNER) uid else ""
                )
            }
            finalAccount
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "auth/write", "users")
        }
    }

    override suspend fun signOut() {
        auth.signOut()
    }

    override suspend fun updatePreferences(
        account: UserAccount,
        language: AppLanguage,
        theme: AppThemeMode
    ): Result<UserAccount> {
        return runCatching {
            db.collection("users").document(account.uid).update(
                mapOf(
                    "language" to language.code,
                    "theme" to theme.code,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            account.copy(language = language, theme = theme)
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "update", "users/${account.uid}")
        }
    }

    override suspend fun loadWorkspace(account: UserAccount): Result<AppWorkspaceData> {
        return runCatching {
            if (account.role == UserRole.OWNER) {
                val empSnap = db.collection("employers").document(account.uid).get().await()
                val employer = if (empSnap.exists()) empSnap.toEmployerOrg() else EmployerOrg(
                    id = account.uid,
                    ownerUid = account.uid,
                    businessName = "${account.name} Construction",
                    ownerName = account.name,
                    mobile = account.mobile,
                    address = ""
                )
                if (!empSnap.exists()) {
                    db.collection("employers").document(account.uid).set(
                        mapOf(
                            "id" to account.uid,
                            "ownerUid" to account.uid,
                            "businessName" to employer.businessName,
                            "ownerName" to employer.ownerName,
                            "mobile" to employer.mobile,
                            "address" to "",
                            "createdAt" to FieldValue.serverTimestamp(),
                            "updatedAt" to FieldValue.serverTimestamp()
                        )
                    ).await()
                }

                val sites = db.collection("work_sites")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toWorkSite() }

                val workers = db.collection("workers")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toWorkerProfile() }

                val attendance = db.collection("attendance")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toAttendanceRecord() }
                    .sortedByDescending { it.date }

                val salaries = db.collection("salaries")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toSalarySummary() }

                val transactions = db.collection("transactions")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toFinancialTransaction() }
                    .sortedWith(compareByDescending<FinancialTransaction> { it.date }.thenByDescending { it.time })

                val leaves = db.collection("leave_requests")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toLeaveRequest() }
                    .sortedByDescending { it.fromDate }

                val notifications = db.collection("notifications")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toNotificationItem() }
                    .sortedByDescending { it.createdAtMillis }

                val auditLogs = db.collection("audit_logs")
                    .whereEqualTo("employerUid", account.uid).get().await()
                    .documents.map { it.toAuditLog() }
                    .sortedByDescending { it.createdAtMillis }

                AppWorkspaceData(
                    account = account,
                    employerOrg = employer,
                    workSites = sites,
                    workers = workers,
                    attendance = attendance,
                    salaries = salaries,
                    transactions = transactions,
                    leaveRequests = leaves,
                    notifications = notifications,
                    auditLogs = auditLogs
                )
            } else {
                // WORKER role: query by workerUid AND mobileE164 so unlinked employer-added records also appear and get claimed
                val e164 = account.mobileE164.ifBlank { "+91${cleanMobile10(account.mobile)}" }

                val workersByUid = db.collection("workers")
                    .whereEqualTo("workerUid", account.uid).get().await().documents
                val workersByPhone = db.collection("workers")
                    .whereEqualTo("mobileE164", e164).get().await().documents

                val workerMap = linkedMapOf<String, WorkerProfile>()
                for (doc in workersByUid + workersByPhone) {
                    val w = doc.toWorkerProfile()
                    // Tier 2 claim: if workerUid == "", link this workerUid securely
                    if (w.workerUid.isBlank()) {
                        runCatching {
                            doc.reference.update(
                                mapOf(
                                    "workerUid" to account.uid,
                                    "updatedAt" to FieldValue.serverTimestamp()
                                )
                            ).await()
                        }
                        workerMap[w.id] = w.copy(workerUid = account.uid)
                    } else {
                        workerMap[w.id] = w
                    }
                }
                val workers = workerMap.values.toList()

                suspend fun queryByWorker(collection: String): List<DocumentSnapshot> {
                    val byUid = db.collection(collection).whereEqualTo("workerUid", account.uid).get().await().documents
                    val byPhone = db.collection(collection).whereEqualTo("workerMobileE164", e164).get().await().documents
                    val dedup = linkedMapOf<String, DocumentSnapshot>()
                    (byUid + byPhone).forEach { dedup[it.id] = it }
                    return dedup.values.toList()
                }

                val attendance = queryByWorker("attendance")
                    .map { it.toAttendanceRecord() }
                    .sortedByDescending { it.date }
                val salaries = queryByWorker("salaries").map { it.toSalarySummary() }
                val transactions = queryByWorker("transactions")
                    .map { it.toFinancialTransaction() }
                    .sortedWith(compareByDescending<FinancialTransaction> { it.date }.thenByDescending { it.time })
                val leaves = queryByWorker("leave_requests")
                    .map { it.toLeaveRequest() }
                    .sortedByDescending { it.fromDate }
                val notifications = queryByWorker("notifications")
                    .map { it.toNotificationItem() }
                    .sortedByDescending { it.createdAtMillis }

                AppWorkspaceData(
                    account = account,
                    employerOrg = null,
                    workSites = emptyList(),
                    workers = workers,
                    attendance = attendance,
                    salaries = salaries,
                    transactions = transactions,
                    leaveRequests = leaves,
                    notifications = notifications,
                    auditLogs = emptyList()
                )
            }
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "list", "workspace")
        }
    }

    override suspend fun updateEmployerOrg(
        account: UserAccount,
        businessName: String,
        ownerName: String,
        address: String
    ): Result<EmployerOrg> {
        return runCatching {
            val ref = db.collection("employers").document(account.uid)
            val snap = ref.get().await()
            if (snap.exists()) {
                ref.update(
                    mapOf(
                        "businessName" to businessName.trim(),
                        "ownerName" to ownerName.trim(),
                        "mobile" to account.mobile,
                        "address" to address.trim(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } else {
                ref.set(
                    mapOf(
                        "id" to account.uid,
                        "ownerUid" to account.uid,
                        "businessName" to businessName.trim(),
                        "ownerName" to ownerName.trim(),
                        "mobile" to account.mobile,
                        "address" to address.trim(),
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
            EmployerOrg(
                id = account.uid,
                ownerUid = account.uid,
                businessName = businessName.trim(),
                ownerName = ownerName.trim(),
                mobile = account.mobile,
                address = address.trim()
            )
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "write", "employers/${account.uid}")
        }
    }

    override suspend fun upsertWorkSite(
        account: UserAccount,
        existingSiteId: String?,
        input: SiteInput
    ): Result<WorkSite> {
        return runCatching {
            val id = sanitizeId(existingSiteId ?: "site_${System.currentTimeMillis()}")
            val radius = input.radiusMeters.coerceIn(50.0, 50000.0)
            val ref = db.collection("work_sites").document(id)
            if (existingSiteId != null) {
                ref.update(
                    mapOf(
                        "name" to input.name.trim(),
                        "location" to input.location.trim(),
                        "latitude" to input.latitude,
                        "longitude" to input.longitude,
                        "radiusMeters" to radius,
                        "status" to input.status.apiValue,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } else {
                val map = hashMapOf<String, Any?>(
                    "id" to id,
                    "employerUid" to account.uid,
                    "name" to input.name.trim(),
                    "location" to input.location.trim(),
                    "latitude" to input.latitude,
                    "longitude" to input.longitude,
                    "radiusMeters" to radius,
                    "status" to input.status.apiValue,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
                ref.set(map).await()
            }
            WorkSite(
                id = id,
                employerUid = account.uid,
                name = input.name.trim(),
                location = input.location.trim(),
                latitude = input.latitude,
                longitude = input.longitude,
                radiusMeters = radius,
                status = input.status
            )
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "write", "work_sites")
        }
    }

    override suspend fun deleteWorkSite(account: UserAccount, siteId: String): Result<Unit> {
        return runCatching {
            db.collection("work_sites").document(siteId).delete().await()
            Unit
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "delete", "work_sites/$siteId")
        }
    }

    override suspend fun upsertWorker(
        account: UserAccount,
        employerOrg: EmployerOrg?,
        sites: List<WorkSite>,
        existingWorker: WorkerProfile?,
        input: WorkerInput
    ): Result<WorkerProfile> {
        return runCatching {
            val clean10 = cleanMobile10(input.mobile)
            require(clean10.length == 10) { "10-digit mobile number is required." }
            val e164 = "+91$clean10"
            val id = sanitizeId(existingWorker?.id ?: "w_${System.currentTimeMillis()}")
            val uniqueId = existingWorker?.uniqueWorkerId ?: "MM-${clean10.takeLast(4)}-${(100..999).random()}"
            val site = sites.firstOrNull { it.id == input.siteId }
            val ref = db.collection("workers").document(id)

            if (existingWorker != null) {
                ref.update(
                    mapOf(
                        "name" to input.name.trim(),
                        "mobile" to clean10,
                        "mobileE164" to e164,
                        "skillRole" to input.skillRole.trim(),
                        "siteId" to (site?.id ?: input.siteId),
                        "siteName" to (site?.name ?: existingWorker.siteName),
                        "siteLat" to site?.latitude,
                        "siteLng" to site?.longitude,
                        "siteRadiusMeters" to site?.radiusMeters,
                        "wageType" to input.wageType.apiValue,
                        "dailyWage" to input.dailyWage.coerceAtLeast(0.0),
                        "monthlySalary" to input.monthlySalary.coerceAtLeast(0.0),
                        "overtimeRate" to input.overtimeRate.coerceAtLeast(0.0),
                        "photoUrl" to input.photoUrl.take(195000),
                        "status" to input.status.apiValue,
                        "workerUid" to existingWorker.workerUid,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } else {
                val joinedAt = PayrollCalculator.todayYmd()
                ref.set(
                    hashMapOf(
                        "id" to id,
                        "uniqueWorkerId" to uniqueId,
                        "employerUid" to account.uid,
                        "employerName" to (employerOrg?.businessName ?: account.name),
                        "employerMobile" to (employerOrg?.mobile ?: account.mobile),
                        "workerUid" to "",
                        "siteId" to (site?.id ?: input.siteId),
                        "siteName" to (site?.name ?: ""),
                        "siteLat" to site?.latitude,
                        "siteLng" to site?.longitude,
                        "siteRadiusMeters" to site?.radiusMeters,
                        "name" to input.name.trim(),
                        "mobile" to clean10,
                        "mobileE164" to e164,
                        "photoUrl" to input.photoUrl.take(195000),
                        "skillRole" to input.skillRole.trim().ifBlank { "Worker" },
                        "wageType" to input.wageType.apiValue,
                        "dailyWage" to input.dailyWage.coerceAtLeast(0.0),
                        "monthlySalary" to input.monthlySalary.coerceAtLeast(0.0),
                        "overtimeRate" to input.overtimeRate.coerceAtLeast(0.0),
                        "status" to input.status.apiValue,
                        "joinedAt" to joinedAt,
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }

            WorkerProfile(
                id = id,
                uniqueWorkerId = uniqueId,
                employerUid = account.uid,
                employerName = employerOrg?.businessName ?: account.name,
                employerMobile = employerOrg?.mobile ?: account.mobile,
                workerUid = existingWorker?.workerUid ?: "",
                siteId = site?.id ?: input.siteId,
                siteName = site?.name ?: existingWorker?.siteName ?: "",
                siteLat = site?.latitude,
                siteLng = site?.longitude,
                siteRadiusMeters = site?.radiusMeters,
                name = input.name.trim(),
                mobile = clean10,
                mobileE164 = e164,
                photoUrl = input.photoUrl.take(195000),
                skillRole = input.skillRole.trim().ifBlank { "Worker" },
                wageType = input.wageType,
                dailyWage = input.dailyWage.coerceAtLeast(0.0),
                monthlySalary = input.monthlySalary.coerceAtLeast(0.0),
                overtimeRate = input.overtimeRate.coerceAtLeast(0.0),
                status = input.status,
                joinedAt = existingWorker?.joinedAt ?: PayrollCalculator.todayYmd()
            )
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "write", "workers")
        }
    }

    override suspend fun deleteWorker(account: UserAccount, workerId: String): Result<Unit> {
        return runCatching {
            db.collection("workers").document(workerId).delete().await()
            Unit
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "delete", "workers/$workerId")
        }
    }

    override suspend fun markOrEditAttendance(
        account: UserAccount,
        worker: WorkerProfile,
        existingRecord: AttendanceRecord?,
        input: AttendanceMarkInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<AttendanceRecord> {
        return runCatching {
            val attId = sanitizeId(existingRecord?.id ?: "att_${worker.id}_${input.date}")
            val month = input.date.take(7)
            val history = existingRecord?.editHistory.orEmpty().toMutableList()
            if (existingRecord != null && input.editReason.isNotBlank()) {
                history.add(
                    0,
                    "${PayrollCalculator.todayYmd()} ${PayrollCalculator.nowTimeHm()}: ${existingRecord.status.apiValue} -> ${input.status.apiValue} (${input.editReason.trim()})"
                )
            }
            val cleanHistory = history.take(30)
            val ref = db.collection("attendance").document(attId)

            if (existingRecord != null) {
                ref.update(
                    mapOf(
                        "status" to input.status.apiValue,
                        "hoursWorked" to input.hoursWorked.coerceIn(0.0, 24.0),
                        "overtimeHours" to input.overtimeHours.coerceIn(0.0, 16.0),
                        "siteId" to worker.siteId,
                        "gpsLat" to (input.gpsLat ?: existingRecord.gpsLat),
                        "gpsLng" to (input.gpsLng ?: existingRecord.gpsLng),
                        "gpsVerified" to (input.gpsVerified || existingRecord.gpsVerified),
                        "markedByUid" to account.uid,
                        "markedByRole" to "OWNER",
                        "editReason" to input.editReason.trim().take(300),
                        "editHistory" to cleanHistory,
                        "notes" to input.notes.trim().take(300),
                        "workerUid" to worker.workerUid,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } else {
                ref.set(
                    hashMapOf(
                        "id" to attId,
                        "workerId" to worker.id,
                        "workerUid" to worker.workerUid,
                        "workerMobileE164" to worker.mobileE164,
                        "employerUid" to account.uid,
                        "siteId" to worker.siteId,
                        "date" to input.date,
                        "month" to month,
                        "status" to input.status.apiValue,
                        "hoursWorked" to input.hoursWorked.coerceIn(0.0, 24.0),
                        "overtimeHours" to input.overtimeHours.coerceIn(0.0, 16.0),
                        "gpsLat" to input.gpsLat,
                        "gpsLng" to input.gpsLng,
                        "gpsVerified" to input.gpsVerified,
                        "markedByUid" to account.uid,
                        "markedByRole" to "OWNER",
                        "editReason" to input.editReason.trim().take(300),
                        "editHistory" to cleanHistory,
                        "notes" to input.notes.trim().take(300),
                        "createdAt" to FieldValue.serverTimestamp(),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }

            val saved = AttendanceRecord(
                id = attId,
                workerId = worker.id,
                workerUid = worker.workerUid,
                workerMobileE164 = worker.mobileE164,
                employerUid = account.uid,
                siteId = worker.siteId,
                date = input.date,
                month = month,
                status = input.status,
                hoursWorked = input.hoursWorked.coerceIn(0.0, 24.0),
                overtimeHours = input.overtimeHours.coerceIn(0.0, 16.0),
                gpsLat = input.gpsLat ?: existingRecord?.gpsLat,
                gpsLng = input.gpsLng ?: existingRecord?.gpsLng,
                gpsVerified = input.gpsVerified || (existingRecord?.gpsVerified == true),
                markedByUid = account.uid,
                markedByRole = UserRole.OWNER,
                editReason = input.editReason.trim().take(300),
                editHistory = cleanHistory,
                notes = input.notes.trim().take(300)
            )

            // Sync salary aggregate
            val updatedAtt = allAttendance.filterNot { it.id == attId } + saved
            syncSalarySummaryToFirestore(worker, month, updatedAtt, allTransactions, allowUpdate = true)

            // Create worker notification
            createNotification(
                employerUid = account.uid,
                worker = worker,
                type = "ATTENDANCE",
                titleEn = "Attendance Updated (${input.date})",
                titleHi = "हाजिरी अपडेट (${input.date})",
                messageEn = "Marked ${input.status.apiValue} (${input.overtimeHours}h OT). ${input.editReason}".trim(),
                messageHi = "${input.status.apiValue} दर्ज (${input.overtimeHours}h OT). ${input.editReason}".trim()
            )

            // Create audit log
            createAuditLog(
                employerUid = account.uid,
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

            saved
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "write", "attendance")
        }
    }

    override suspend fun bulkMarkPresent(
        account: UserAccount,
        workers: List<WorkerProfile>,
        date: String,
        existingAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<Int> {
        return runCatching {
            var count = 0
            val active = workers.filter { it.status == WorkerStatus.ACTIVE }
            val currentAtt = existingAttendance.toMutableList()
            for (w in active) {
                if (currentAtt.none { it.workerId == w.id && it.date == date }) {
                    val res = markOrEditAttendance(
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
                        allAttendance = currentAtt,
                        allTransactions = allTransactions
                    ).getOrThrow()
                    currentAtt.add(res)
                    count++
                }
            }
            count
        }
    }

    override suspend fun recordTransaction(
        account: UserAccount,
        workers: List<WorkerProfile>,
        input: TransactionInput,
        allAttendance: List<AttendanceRecord>,
        allTransactions: List<FinancialTransaction>
    ): Result<FinancialTransaction> {
        return runCatching {
            val worker = workers.firstOrNull { it.id == input.workerId }
            val txId = sanitizeId("tx_${System.currentTimeMillis()}_${(100..999).random()}")
            val timeHm = PayrollCalculator.nowTimeHm()
            val month = input.date.take(7)
            val tx = FinancialTransaction(
                id = txId,
                category = input.category,
                employerUid = account.uid,
                workerId = worker?.id ?: "",
                workerUid = worker?.workerUid ?: "",
                workerMobileE164 = worker?.mobileE164 ?: "",
                workerName = worker?.name?.ifBlank { "Worker" } ?: "Site Expense",
                uniqueWorkerId = worker?.uniqueWorkerId ?: "",
                siteId = input.siteId.ifBlank { worker?.siteId ?: "" },
                amount = input.amount.coerceAtLeast(1.0),
                mode = input.mode,
                referenceNo = input.referenceNo.trim().take(80),
                date = input.date,
                month = month,
                time = timeHm,
                description = input.description.trim().take(300),
                recordedByUid = account.uid
            )

            db.collection("transactions").document(txId).set(
                hashMapOf(
                    "id" to tx.id,
                    "category" to tx.category.apiValue,
                    "employerUid" to tx.employerUid,
                    "workerId" to tx.workerId,
                    "workerUid" to tx.workerUid,
                    "workerMobileE164" to tx.workerMobileE164,
                    "workerName" to tx.workerName,
                    "uniqueWorkerId" to tx.uniqueWorkerId,
                    "siteId" to tx.siteId,
                    "amount" to tx.amount,
                    "mode" to tx.mode.apiValue,
                    "referenceNo" to tx.referenceNo,
                    "date" to tx.date,
                    "month" to tx.month,
                    "time" to tx.time,
                    "description" to tx.description,
                    "recordedByUid" to tx.recordedByUid,
                    "createdAt" to FieldValue.serverTimestamp()
                )
            ).await()

            if (worker != null) {
                syncSalarySummaryToFirestore(
                    worker = worker,
                    month = month,
                    attendance = allAttendance,
                    transactions = allTransactions + tx,
                    allowUpdate = true
                )
                createNotification(
                    employerUid = account.uid,
                    worker = worker,
                    type = tx.category.apiValue,
                    titleEn = "${tx.category.apiValue}: ₹${tx.amount.toInt()}",
                    titleHi = "${tx.category.apiValue}: ₹${tx.amount.toInt()}",
                    messageEn = "${account.name} recorded ₹${tx.amount.toInt()} (${tx.description})",
                    messageHi = "${account.name} ने ₹${tx.amount.toInt()} दर्ज किया (${tx.description})"
                )
            }

            createAuditLog(
                employerUid = account.uid,
                workerId = worker?.id ?: "",
                actorUid = account.uid,
                actorName = account.name,
                actorRole = UserRole.OWNER,
                action = "RECORD_${tx.category.apiValue}",
                entityType = "TRANSACTION",
                entityId = tx.id,
                reason = tx.description,
                summary = "${tx.workerName}: ${tx.category.apiValue} ₹${tx.amount.toInt()}"
            )

            tx
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "create", "transactions")
        }
    }

    override suspend fun respondToLeave(
        account: UserAccount,
        leave: LeaveRequest,
        newStatus: LeaveStatus,
        ownerNote: String
    ): Result<LeaveRequest> {
        return runCatching {
            db.collection("leave_requests").document(leave.id).update(
                mapOf(
                    "status" to newStatus.apiValue,
                    "ownerNote" to ownerNote.trim().take(300),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()

            val updated = leave.copy(status = newStatus, ownerNote = ownerNote.trim())
            val dummyWorker = WorkerProfile(
                id = leave.workerId,
                workerUid = leave.workerUid,
                mobileE164 = leave.workerMobileE164
            )
            createNotification(
                employerUid = account.uid,
                worker = dummyWorker,
                type = "LEAVE",
                titleEn = "Leave ${newStatus.apiValue}",
                titleHi = "छुट्टी अनुरोध: ${newStatus.apiValue}",
                messageEn = "Your leave (${leave.fromDate} to ${leave.toDate}) was ${newStatus.apiValue}. ${ownerNote}".trim(),
                messageHi = "आपकी छुट्टी (${leave.fromDate} से ${leave.toDate}) ${newStatus.apiValue} की गई। ${ownerNote}".trim()
            )
            updated
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "update", "leave_requests/${leave.id}")
        }
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
        return runCatching {
            require(gpsVerified) { "You must be within site geofence radius for GPS Check-In." }
            val attId = sanitizeId("att_${worker.id}_$date")
            val month = date.take(7)
            val history = listOf("$date ${PayrollCalculator.nowTimeHm()}: Worker GPS Self Check-In")
            db.collection("attendance").document(attId).set(
                hashMapOf(
                    "id" to attId,
                    "workerId" to worker.id,
                    "workerUid" to account.uid,
                    "workerMobileE164" to worker.mobileE164,
                    "employerUid" to worker.employerUid,
                    "siteId" to worker.siteId,
                    "date" to date,
                    "month" to month,
                    "status" to "PRESENT",
                    "hoursWorked" to 8.0,
                    "overtimeHours" to 0.0,
                    "gpsLat" to gpsLat,
                    "gpsLng" to gpsLng,
                    "gpsVerified" to true,
                    "markedByUid" to account.uid,
                    "markedByRole" to "WORKER",
                    "editReason" to "",
                    "editHistory" to history,
                    "notes" to "GPS verified check-in",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()

            val rec = AttendanceRecord(
                id = attId,
                workerId = worker.id,
                workerUid = account.uid,
                workerMobileE164 = worker.mobileE164,
                employerUid = worker.employerUid,
                siteId = worker.siteId,
                date = date,
                month = month,
                status = AttendanceStatus.PRESENT,
                hoursWorked = 8.0,
                overtimeHours = 0.0,
                gpsLat = gpsLat,
                gpsLng = gpsLng,
                gpsVerified = true,
                markedByUid = account.uid,
                markedByRole = UserRole.WORKER,
                editReason = "",
                editHistory = history,
                notes = "GPS verified check-in"
            )

            // Worker can create initial salary summary if absent (update is restricted to owner per security rules)
            syncSalarySummaryToFirestore(
                worker = worker,
                month = month,
                attendance = allAttendance + rec,
                transactions = allTransactions,
                allowUpdate = false
            )

            createAuditLog(
                employerUid = worker.employerUid,
                workerId = worker.id,
                actorUid = account.uid,
                actorName = account.name,
                actorRole = UserRole.WORKER,
                action = "GPS_CHECKIN",
                entityType = "ATTENDANCE",
                entityId = attId,
                reason = "GPS verified within geofence",
                summary = "${worker.name} checked in via GPS ($date)"
            )

            rec
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "create", "attendance")
        }
    }

    override suspend fun submitLeaveRequest(
        account: UserAccount,
        worker: WorkerProfile,
        fromDate: String,
        toDate: String,
        reason: String
    ): Result<LeaveRequest> {
        return runCatching {
            val id = sanitizeId("lv_${System.currentTimeMillis()}_${(100..999).random()}")
            db.collection("leave_requests").document(id).set(
                hashMapOf(
                    "id" to id,
                    "workerId" to worker.id,
                    "workerUid" to account.uid,
                    "workerMobileE164" to worker.mobileE164,
                    "workerName" to worker.name,
                    "uniqueWorkerId" to worker.uniqueWorkerId,
                    "employerUid" to worker.employerUid,
                    "fromDate" to fromDate,
                    "toDate" to toDate,
                    "reason" to reason.trim().take(300),
                    "status" to "PENDING",
                    "ownerNote" to "",
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()

            LeaveRequest(
                id = id,
                workerId = worker.id,
                workerUid = account.uid,
                workerMobileE164 = worker.mobileE164,
                workerName = worker.name,
                uniqueWorkerId = worker.uniqueWorkerId,
                employerUid = worker.employerUid,
                fromDate = fromDate,
                toDate = toDate,
                reason = reason.trim(),
                status = LeaveStatus.PENDING,
                ownerNote = ""
            )
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "create", "leave_requests")
        }
    }

    override suspend fun markNotificationRead(notificationId: String): Result<Unit> {
        return runCatching {
            db.collection("notifications").document(notificationId).update(
                mapOf(
                    "isRead" to true,
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
            Unit
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "update", "notifications/$notificationId")
        }
    }

    override suspend fun exportBackupJson(data: AppWorkspaceData): String =
        ExportHelper.buildBackupJson(data)

    override suspend fun importBackupJson(account: UserAccount, jsonString: String): Result<Int> {
        return runCatching {
            val root = JSONObject(jsonString)
            var count = 0
            val empSnap = db.collection("employers").document(account.uid).get().await()
            val empOrg = if (empSnap.exists()) empSnap.toEmployerOrg() else null

            val siteArr = root.optJSONArray("workSites")
            val currentSites = mutableListOf<WorkSite>()
            if (siteArr != null) {
                for (i in 0 until siteArr.length()) {
                    val o = siteArr.getJSONObject(i)
                    val siteId = sanitizeId(o.optString("id"))
                    val ref = db.collection("work_sites").document(siteId)
                    if (!ref.get().await().exists()) {
                        val s = upsertWorkSite(
                            account = account,
                            existingSiteId = null,
                            input = SiteInput(
                                name = o.optString("name", "Site"),
                                location = o.optString("location", ""),
                                latitude = if (o.has("latitude")) o.optDouble("latitude") else null,
                                longitude = if (o.has("longitude")) o.optDouble("longitude") else null,
                                radiusMeters = o.optDouble("radiusMeters", 300.0),
                                status = SiteStatus.from(o.optString("status"))
                            )
                        ).getOrNull()
                        if (s != null) {
                            currentSites.add(s)
                            count++
                        }
                    }
                }
            }

            val wArr = root.optJSONArray("workers")
            if (wArr != null) {
                for (i in 0 until wArr.length()) {
                    val o = wArr.getJSONObject(i)
                    val mobile = cleanMobile10(o.optString("mobile"))
                    if (mobile.length == 10) {
                        upsertWorker(
                            account = account,
                            employerOrg = empOrg,
                            sites = currentSites,
                            existingWorker = null,
                            input = WorkerInput(
                                name = o.optString("name", "Worker"),
                                mobile = mobile,
                                skillRole = o.optString("skillRole", "Worker"),
                                siteId = o.optString("siteId", ""),
                                wageType = WageType.from(o.optString("wageType")),
                                dailyWage = o.optDouble("dailyWage", 500.0),
                                monthlySalary = o.optDouble("monthlySalary", 0.0),
                                overtimeRate = o.optDouble("overtimeRate", 80.0),
                                status = WorkerStatus.from(o.optString("status"))
                            )
                        )
                        count++
                    }
                }
            }
            count
        }
    }

    private suspend fun syncSalarySummaryToFirestore(
        worker: WorkerProfile,
        month: String,
        attendance: List<AttendanceRecord>,
        transactions: List<FinancialTransaction>,
        allowUpdate: Boolean
    ) {
        val summary = PayrollCalculator.recomputeSalary(worker, month, attendance, transactions)
        val salId = sanitizeId(summary.id)
        val ref = db.collection("salaries").document(salId)
        val payload = hashMapOf<String, Any>(
            "id" to salId,
            "workerId" to summary.workerId,
            "workerUid" to summary.workerUid,
            "workerMobileE164" to summary.workerMobileE164,
            "employerUid" to summary.employerUid,
            "month" to summary.month,
            "effectiveDailyWage" to summary.effectiveDailyWage,
            "presentDays" to summary.presentDays,
            "halfDays" to summary.halfDays,
            "paidLeaveDays" to summary.paidLeaveDays,
            "absentDays" to summary.absentDays,
            "totalWorkingDays" to summary.totalWorkingDays,
            "totalHours" to summary.totalHours,
            "overtimeHours" to summary.overtimeHours,
            "attendanceEarnings" to summary.attendanceEarnings,
            "overtimeEarnings" to summary.overtimeEarnings,
            "bonusTotal" to summary.bonusTotal,
            "deductionTotal" to summary.deductionTotal,
            "totalSalary" to summary.totalSalary,
            "advanceTotal" to summary.advanceTotal,
            "paidTotal" to summary.paidTotal,
            "remainingBalance" to summary.remainingBalance,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        runCatching {
            val snap = ref.get().await()
            if (!snap.exists()) {
                ref.set(payload).await()
            } else if (allowUpdate) {
                ref.update(
                    mapOf(
                        "workerUid" to summary.workerUid,
                        "effectiveDailyWage" to summary.effectiveDailyWage,
                        "presentDays" to summary.presentDays,
                        "halfDays" to summary.halfDays,
                        "paidLeaveDays" to summary.paidLeaveDays,
                        "absentDays" to summary.absentDays,
                        "totalWorkingDays" to summary.totalWorkingDays,
                        "totalHours" to summary.totalHours,
                        "overtimeHours" to summary.overtimeHours,
                        "attendanceEarnings" to summary.attendanceEarnings,
                        "overtimeEarnings" to summary.overtimeEarnings,
                        "bonusTotal" to summary.bonusTotal,
                        "deductionTotal" to summary.deductionTotal,
                        "totalSalary" to summary.totalSalary,
                        "advanceTotal" to summary.advanceTotal,
                        "paidTotal" to summary.paidTotal,
                        "remainingBalance" to summary.remainingBalance,
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            }
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "write", "salaries/$salId")
        }
    }

    private suspend fun createNotification(
        employerUid: String,
        worker: WorkerProfile,
        type: String,
        titleEn: String,
        titleHi: String,
        messageEn: String,
        messageHi: String
    ) {
        if (worker.id.isBlank() || worker.mobileE164.isBlank()) return
        val id = sanitizeId("notif_${System.currentTimeMillis()}_${(100..999).random()}")
        runCatching {
            db.collection("notifications").document(id).set(
                hashMapOf(
                    "id" to id,
                    "employerUid" to employerUid,
                    "workerId" to worker.id,
                    "workerUid" to worker.workerUid,
                    "workerMobileE164" to worker.mobileE164,
                    "type" to type.take(40),
                    "titleEn" to titleEn.take(140),
                    "titleHi" to titleHi.take(140),
                    "messageEn" to messageEn.take(400),
                    "messageHi" to messageHi.take(400),
                    "isRead" to false,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "create", "notifications/$id")
        }
    }

    private suspend fun createAuditLog(
        employerUid: String,
        workerId: String,
        actorUid: String,
        actorName: String,
        actorRole: UserRole,
        action: String,
        entityType: String,
        entityId: String,
        reason: String,
        summary: String
    ) {
        val id = sanitizeId("log_${System.currentTimeMillis()}_${(100..999).random()}")
        runCatching {
            db.collection("audit_logs").document(id).set(
                hashMapOf(
                    "id" to id,
                    "employerUid" to employerUid,
                    "workerId" to workerId,
                    "actorUid" to actorUid,
                    "actorName" to actorName.ifBlank { "User" }.take(120),
                    "actorRole" to actorRole.apiValue,
                    "action" to action.take(80),
                    "entityType" to entityType.take(60),
                    "entityId" to entityId.take(128),
                    "reason" to reason.take(300),
                    "summary" to summary.take(400),
                    "createdAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }.onFailure {
            if (it is Exception) logFirestoreError(it, "create", "audit_logs/$id")
        }
    }

    // ---- Snapshot Mappers ----

    private fun DocumentSnapshot.toUserAccount() = UserAccount(
        uid = getString("uid") ?: id,
        mobile = getString("mobile") ?: "",
        mobileE164 = getString("mobileE164") ?: "",
        name = getString("name") ?: "",
        role = UserRole.from(getString("role")),
        language = AppLanguage.from(getString("language")),
        theme = AppThemeMode.from(getString("theme")),
        employerUid = getString("employerUid") ?: ""
    )

    private fun DocumentSnapshot.toEmployerOrg() = EmployerOrg(
        id = getString("id") ?: id,
        ownerUid = getString("ownerUid") ?: id,
        businessName = getString("businessName") ?: "",
        ownerName = getString("ownerName") ?: "",
        mobile = getString("mobile") ?: "",
        address = getString("address") ?: ""
    )

    private fun DocumentSnapshot.toWorkSite() = WorkSite(
        id = getString("id") ?: id,
        employerUid = getString("employerUid") ?: "",
        name = getString("name") ?: "",
        location = getString("location") ?: "",
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        radiusMeters = getDouble("radiusMeters") ?: 300.0,
        status = SiteStatus.from(getString("status"))
    )

    private fun DocumentSnapshot.toWorkerProfile() = WorkerProfile(
        id = getString("id") ?: id,
        uniqueWorkerId = getString("uniqueWorkerId") ?: "",
        employerUid = getString("employerUid") ?: "",
        employerName = getString("employerName") ?: "",
        employerMobile = getString("employerMobile") ?: "",
        workerUid = getString("workerUid") ?: "",
        siteId = getString("siteId") ?: "",
        siteName = getString("siteName") ?: "",
        siteLat = getDouble("siteLat"),
        siteLng = getDouble("siteLng"),
        siteRadiusMeters = getDouble("siteRadiusMeters"),
        name = getString("name") ?: "",
        mobile = getString("mobile") ?: "",
        mobileE164 = getString("mobileE164") ?: "",
        photoUrl = getString("photoUrl") ?: "",
        skillRole = getString("skillRole") ?: "",
        wageType = WageType.from(getString("wageType")),
        dailyWage = getDouble("dailyWage") ?: 0.0,
        monthlySalary = getDouble("monthlySalary") ?: 0.0,
        overtimeRate = getDouble("overtimeRate") ?: 0.0,
        status = WorkerStatus.from(getString("status")),
        joinedAt = getString("joinedAt") ?: ""
    )

    @Suppress("UNCHECKED_CAST")
    private fun DocumentSnapshot.toAttendanceRecord(): AttendanceRecord {
        val rawHistory = get("editHistory") as? List<*>
        val history = rawHistory?.mapNotNull { it?.toString() } ?: emptyList()
        return AttendanceRecord(
            id = getString("id") ?: id,
            workerId = getString("workerId") ?: "",
            workerUid = getString("workerUid") ?: "",
            workerMobileE164 = getString("workerMobileE164") ?: "",
            employerUid = getString("employerUid") ?: "",
            siteId = getString("siteId") ?: "",
            date = getString("date") ?: "",
            month = getString("month") ?: "",
            status = AttendanceStatus.from(getString("status")),
            hoursWorked = getDouble("hoursWorked") ?: 0.0,
            overtimeHours = getDouble("overtimeHours") ?: 0.0,
            gpsLat = getDouble("gpsLat"),
            gpsLng = getDouble("gpsLng"),
            gpsVerified = getBoolean("gpsVerified") ?: false,
            markedByUid = getString("markedByUid") ?: "",
            markedByRole = UserRole.from(getString("markedByRole")),
            editReason = getString("editReason") ?: "",
            editHistory = history,
            notes = getString("notes") ?: ""
        )
    }

    private fun DocumentSnapshot.toSalarySummary() = SalarySummary(
        id = getString("id") ?: id,
        workerId = getString("workerId") ?: "",
        workerUid = getString("workerUid") ?: "",
        workerMobileE164 = getString("workerMobileE164") ?: "",
        employerUid = getString("employerUid") ?: "",
        month = getString("month") ?: "",
        effectiveDailyWage = getDouble("effectiveDailyWage") ?: 0.0,
        presentDays = (getLong("presentDays") ?: 0L).toInt(),
        halfDays = (getLong("halfDays") ?: 0L).toInt(),
        paidLeaveDays = (getLong("paidLeaveDays") ?: 0L).toInt(),
        absentDays = (getLong("absentDays") ?: 0L).toInt(),
        totalWorkingDays = getDouble("totalWorkingDays") ?: 0.0,
        totalHours = getDouble("totalHours") ?: 0.0,
        overtimeHours = getDouble("overtimeHours") ?: 0.0,
        attendanceEarnings = getDouble("attendanceEarnings") ?: 0.0,
        overtimeEarnings = getDouble("overtimeEarnings") ?: 0.0,
        bonusTotal = getDouble("bonusTotal") ?: 0.0,
        deductionTotal = getDouble("deductionTotal") ?: 0.0,
        totalSalary = getDouble("totalSalary") ?: 0.0,
        advanceTotal = getDouble("advanceTotal") ?: 0.0,
        paidTotal = getDouble("paidTotal") ?: 0.0,
        remainingBalance = getDouble("remainingBalance") ?: 0.0
    )

    private fun DocumentSnapshot.toFinancialTransaction() = FinancialTransaction(
        id = getString("id") ?: id,
        category = TransactionCategory.from(getString("category")),
        employerUid = getString("employerUid") ?: "",
        workerId = getString("workerId") ?: "",
        workerUid = getString("workerUid") ?: "",
        workerMobileE164 = getString("workerMobileE164") ?: "",
        workerName = getString("workerName") ?: "",
        uniqueWorkerId = getString("uniqueWorkerId") ?: "",
        siteId = getString("siteId") ?: "",
        amount = getDouble("amount") ?: 0.0,
        mode = PaymentMode.from(getString("mode")),
        referenceNo = getString("referenceNo") ?: "",
        date = getString("date") ?: "",
        month = getString("month") ?: "",
        time = getString("time") ?: "",
        description = getString("description") ?: "",
        recordedByUid = getString("recordedByUid") ?: ""
    )

    private fun DocumentSnapshot.toLeaveRequest() = LeaveRequest(
        id = getString("id") ?: id,
        workerId = getString("workerId") ?: "",
        workerUid = getString("workerUid") ?: "",
        workerMobileE164 = getString("workerMobileE164") ?: "",
        workerName = getString("workerName") ?: "",
        uniqueWorkerId = getString("uniqueWorkerId") ?: "",
        employerUid = getString("employerUid") ?: "",
        fromDate = getString("fromDate") ?: "",
        toDate = getString("toDate") ?: "",
        reason = getString("reason") ?: "",
        status = LeaveStatus.from(getString("status")),
        ownerNote = getString("ownerNote") ?: ""
    )

    private fun DocumentSnapshot.toNotificationItem(): NotificationItem {
        val ts = getTimestamp("createdAt")?.toDate()?.time ?: System.currentTimeMillis()
        return NotificationItem(
            id = getString("id") ?: id,
            employerUid = getString("employerUid") ?: "",
            workerId = getString("workerId") ?: "",
            workerUid = getString("workerUid") ?: "",
            workerMobileE164 = getString("workerMobileE164") ?: "",
            type = getString("type") ?: "SYSTEM",
            titleEn = getString("titleEn") ?: "",
            titleHi = getString("titleHi") ?: "",
            messageEn = getString("messageEn") ?: "",
            messageHi = getString("messageHi") ?: "",
            isRead = getBoolean("isRead") ?: false,
            createdAtMillis = ts
        )
    }

    private fun DocumentSnapshot.toAuditLog(): AuditLog {
        val ts = getTimestamp("createdAt")?.toDate()?.time ?: System.currentTimeMillis()
        return AuditLog(
            id = getString("id") ?: id,
            employerUid = getString("employerUid") ?: "",
            workerId = getString("workerId") ?: "",
            actorUid = getString("actorUid") ?: "",
            actorName = getString("actorName") ?: "",
            actorRole = UserRole.from(getString("actorRole")),
            action = getString("action") ?: "",
            entityType = getString("entityType") ?: "",
            entityId = getString("entityId") ?: "",
            reason = getString("reason") ?: "",
            summary = getString("summary") ?: "",
            createdAtMillis = ts
        )
    }
}
