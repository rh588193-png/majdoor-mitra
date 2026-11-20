package com.majdoor.mitra.model

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToLong
import kotlin.math.sin
import kotlin.math.sqrt

enum class UserRole(val apiValue: String) {
    WORKER("WORKER"),
    OWNER("OWNER");

    companion object {
        fun from(value: String?): UserRole =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: WORKER
    }
}

enum class AppLanguage(val code: String) {
    HI("hi"),
    EN("en");

    companion object {
        fun from(value: String?): AppLanguage =
            if (value.equals("en", ignoreCase = true)) EN else HI
    }
}

enum class AppThemeMode(val code: String) {
    LIGHT("light"),
    DARK("dark");

    companion object {
        fun from(value: String?): AppThemeMode =
            if (value.equals("dark", ignoreCase = true)) DARK else LIGHT
    }
}

enum class WageType(val apiValue: String) {
    DAILY("DAILY"),
    MONTHLY("MONTHLY");

    companion object {
        fun from(value: String?): WageType =
            if (value.equals("MONTHLY", ignoreCase = true)) MONTHLY else DAILY
    }
}

enum class WorkerStatus(val apiValue: String) {
    ACTIVE("ACTIVE"),
    INACTIVE("INACTIVE");

    companion object {
        fun from(value: String?): WorkerStatus =
            if (value.equals("INACTIVE", ignoreCase = true)) INACTIVE else ACTIVE
    }
}

enum class SiteStatus(val apiValue: String) {
    ACTIVE("ACTIVE"),
    COMPLETED("COMPLETED"),
    PAUSED("PAUSED");

    companion object {
        fun from(value: String?): SiteStatus =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: ACTIVE
    }
}

enum class AttendanceStatus(val apiValue: String) {
    PRESENT("PRESENT"),
    HALF_DAY("HALF_DAY"),
    PAID_LEAVE("PAID_LEAVE"),
    ABSENT("ABSENT");

    companion object {
        fun from(value: String?): AttendanceStatus =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: ABSENT
    }
}

enum class TransactionCategory(val apiValue: String) {
    PAYMENT("PAYMENT"),
    ADVANCE("ADVANCE"),
    BONUS("BONUS"),
    DEDUCTION("DEDUCTION"),
    EXPENSE("EXPENSE");

    companion object {
        fun from(value: String?): TransactionCategory =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: PAYMENT
    }
}

enum class PaymentMode(val apiValue: String) {
    CASH("CASH"),
    UPI("UPI"),
    BANK("BANK"),
    ADJUSTMENT("ADJUSTMENT"),
    SITE("SITE");

    companion object {
        fun from(value: String?): PaymentMode =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: CASH
    }
}

enum class LeaveStatus(val apiValue: String) {
    PENDING("PENDING"),
    APPROVED("APPROVED"),
    REJECTED("REJECTED");

    companion object {
        fun from(value: String?): LeaveStatus =
            entries.firstOrNull { it.apiValue.equals(value, ignoreCase = true) } ?: PENDING
    }
}

data class UserAccount(
    val uid: String = "",
    val mobile: String = "",
    val mobileE164: String = "",
    val name: String = "",
    val role: UserRole = UserRole.WORKER,
    val language: AppLanguage = AppLanguage.HI,
    val theme: AppThemeMode = AppThemeMode.LIGHT,
    val employerUid: String = ""
)

data class EmployerOrg(
    val id: String = "",
    val ownerUid: String = "",
    val businessName: String = "",
    val ownerName: String = "",
    val mobile: String = "",
    val address: String = ""
)

data class WorkSite(
    val id: String = "",
    val employerUid: String = "",
    val name: String = "",
    val location: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val radiusMeters: Double = 300.0,
    val status: SiteStatus = SiteStatus.ACTIVE
)

data class WorkerProfile(
    val id: String = "",
    val uniqueWorkerId: String = "",
    val employerUid: String = "",
    val employerName: String = "",
    val employerMobile: String = "",
    val workerUid: String = "",
    val siteId: String = "",
    val siteName: String = "",
    val siteLat: Double? = null,
    val siteLng: Double? = null,
    val siteRadiusMeters: Double? = null,
    val name: String = "",
    val mobile: String = "",
    val mobileE164: String = "",
    val photoUrl: String = "",
    val skillRole: String = "",
    val wageType: WageType = WageType.DAILY,
    val dailyWage: Double = 0.0,
    val monthlySalary: Double = 0.0,
    val overtimeRate: Double = 0.0,
    val status: WorkerStatus = WorkerStatus.ACTIVE,
    val joinedAt: String = ""
)

data class AttendanceRecord(
    val id: String = "",
    val workerId: String = "",
    val workerUid: String = "",
    val workerMobileE164: String = "",
    val employerUid: String = "",
    val siteId: String = "",
    val date: String = "",
    val month: String = "",
    val status: AttendanceStatus = AttendanceStatus.ABSENT,
    val hoursWorked: Double = 0.0,
    val overtimeHours: Double = 0.0,
    val gpsLat: Double? = null,
    val gpsLng: Double? = null,
    val gpsVerified: Boolean = false,
    val markedByUid: String = "",
    val markedByRole: UserRole = UserRole.OWNER,
    val editReason: String = "",
    val editHistory: List<String> = emptyList(),
    val notes: String = ""
)

data class SalarySummary(
    val id: String = "",
    val workerId: String = "",
    val workerUid: String = "",
    val workerMobileE164: String = "",
    val employerUid: String = "",
    val month: String = "",
    val effectiveDailyWage: Double = 0.0,
    val presentDays: Int = 0,
    val halfDays: Int = 0,
    val paidLeaveDays: Int = 0,
    val absentDays: Int = 0,
    val totalWorkingDays: Double = 0.0,
    val totalHours: Double = 0.0,
    val overtimeHours: Double = 0.0,
    val attendanceEarnings: Double = 0.0,
    val overtimeEarnings: Double = 0.0,
    val bonusTotal: Double = 0.0,
    val deductionTotal: Double = 0.0,
    val totalSalary: Double = 0.0,
    val advanceTotal: Double = 0.0,
    val paidTotal: Double = 0.0,
    val remainingBalance: Double = 0.0
)

data class FinancialTransaction(
    val id: String = "",
    val category: TransactionCategory = TransactionCategory.PAYMENT,
    val employerUid: String = "",
    val workerId: String = "",
    val workerUid: String = "",
    val workerMobileE164: String = "",
    val workerName: String = "",
    val uniqueWorkerId: String = "",
    val siteId: String = "",
    val amount: Double = 0.0,
    val mode: PaymentMode = PaymentMode.CASH,
    val referenceNo: String = "",
    val date: String = "",
    val month: String = "",
    val time: String = "",
    val description: String = "",
    val recordedByUid: String = ""
)

data class LeaveRequest(
    val id: String = "",
    val workerId: String = "",
    val workerUid: String = "",
    val workerMobileE164: String = "",
    val workerName: String = "",
    val uniqueWorkerId: String = "",
    val employerUid: String = "",
    val fromDate: String = "",
    val toDate: String = "",
    val reason: String = "",
    val status: LeaveStatus = LeaveStatus.PENDING,
    val ownerNote: String = ""
)

data class NotificationItem(
    val id: String = "",
    val employerUid: String = "",
    val workerId: String = "",
    val workerUid: String = "",
    val workerMobileE164: String = "",
    val type: String = "SYSTEM",
    val titleEn: String = "",
    val titleHi: String = "",
    val messageEn: String = "",
    val messageHi: String = "",
    val isRead: Boolean = false,
    val createdAtMillis: Long = System.currentTimeMillis()
)

data class AuditLog(
    val id: String = "",
    val employerUid: String = "",
    val workerId: String = "",
    val actorUid: String = "",
    val actorName: String = "",
    val actorRole: UserRole = UserRole.OWNER,
    val action: String = "",
    val entityType: String = "",
    val entityId: String = "",
    val reason: String = "",
    val summary: String = "",
    val createdAtMillis: Long = System.currentTimeMillis()
)

data class ReportRow(
    val worker: WorkerProfile,
    val presentDays: Int,
    val halfDays: Int,
    val paidLeaveDays: Int,
    val absentDays: Int,
    val workingDays: Double,
    val overtimeHours: Double,
    val attendanceEarnings: Double,
    val overtimeEarnings: Double,
    val bonusTotal: Double,
    val deductionTotal: Double,
    val totalSalary: Double,
    val advanceTotal: Double,
    val paidTotal: Double,
    val remainingBalance: Double
)

object PayrollCalculator {
    fun round2(value: Double): Double = (value * 100.0).roundToLong() / 100.0

    fun todayYmd(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun currentYm(): String = SimpleDateFormat("yyyy-MM", Locale.US).format(Date())

    fun nowTimeHm(): String = SimpleDateFormat("HH:mm", Locale.US).format(Date())

    fun daysInMonth(ym: String): Int {
        val parts = ym.split("-")
        if (parts.size != 2) return 30
        val year = parts[0].toIntOrNull() ?: return 30
        val month = parts[1].toIntOrNull() ?: return 30
        val cal = Calendar.getInstance()
        cal.set(Calendar.YEAR, year)
        cal.set(Calendar.MONTH, (month - 1).coerceIn(0, 11))
        cal.set(Calendar.DAY_OF_MONTH, 1)
        return cal.getActualMaximum(Calendar.DAY_OF_MONTH)
    }

    fun monthDates(ym: String): List<String> {
        val count = daysInMonth(ym)
        return (1..count).map { day -> "$ym-${day.toString().padStart(2, '0')}" }
    }

    fun startDayOffset(ym: String): Int {
        val parts = ym.split("-")
        if (parts.size != 2) return 0
        val year = parts[0].toIntOrNull() ?: return 0
        val month = parts[1].toIntOrNull() ?: return 0
        val cal = Calendar.getInstance()
        cal.set(year, (month - 1).coerceIn(0, 11), 1)
        // Sunday = 0 .. Saturday = 6
        return (cal.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY).coerceIn(0, 6)
    }

    fun shiftDateYmd(ymd: String, deltaDays: Int): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val parsed = runCatching { fmt.parse(ymd) }.getOrNull() ?: Date()
        val cal = Calendar.getInstance()
        cal.time = parsed
        cal.add(Calendar.DAY_OF_MONTH, deltaDays)
        return fmt.format(cal.time)
    }

    fun effectiveDailyWage(worker: WorkerProfile, ym: String): Double {
        return if (worker.wageType == WageType.MONTHLY && worker.monthlySalary > 0.0) {
            round2(worker.monthlySalary / daysInMonth(ym).coerceAtLeast(1))
        } else {
            worker.dailyWage
        }
    }

    fun recomputeSalary(
        worker: WorkerProfile,
        month: String,
        attendance: List<AttendanceRecord>,
        transactions: List<FinancialTransaction>
    ): SalarySummary {
        val monthAtt = attendance.filter { it.workerId == worker.id && it.month == month }
        val monthTx = transactions.filter { it.workerId == worker.id && it.month == month }

        var presentDays = 0
        var halfDays = 0
        var paidLeaveDays = 0
        var absentDays = 0
        var totalHours = 0.0
        var overtimeHours = 0.0

        for (rec in monthAtt) {
            when (rec.status) {
                AttendanceStatus.PRESENT -> presentDays++
                AttendanceStatus.HALF_DAY -> halfDays++
                AttendanceStatus.PAID_LEAVE -> paidLeaveDays++
                AttendanceStatus.ABSENT -> absentDays++
            }
            totalHours += rec.hoursWorked
            overtimeHours += rec.overtimeHours
        }

        val dailyRate = effectiveDailyWage(worker, month)
        val workingDays = presentDays + paidLeaveDays + (halfDays * 0.5)
        val attendanceEarnings = round2(workingDays * dailyRate)
        val overtimeEarnings = round2(overtimeHours * worker.overtimeRate)

        var bonusTotal = 0.0
        var deductionTotal = 0.0
        var advanceTotal = 0.0
        var paidTotal = 0.0

        for (tx in monthTx) {
            when (tx.category) {
                TransactionCategory.BONUS -> bonusTotal += tx.amount
                TransactionCategory.DEDUCTION -> deductionTotal += tx.amount
                TransactionCategory.ADVANCE -> advanceTotal += tx.amount
                TransactionCategory.PAYMENT -> paidTotal += tx.amount
                TransactionCategory.EXPENSE -> Unit
            }
        }

        val totalSalary = round2(attendanceEarnings + overtimeEarnings + bonusTotal - deductionTotal)
        val remainingBalance = round2(totalSalary - advanceTotal - paidTotal)

        return SalarySummary(
            id = "sal_${worker.id}_$month",
            workerId = worker.id,
            workerUid = worker.workerUid,
            workerMobileE164 = worker.mobileE164,
            employerUid = worker.employerUid,
            month = month,
            effectiveDailyWage = dailyRate,
            presentDays = presentDays,
            halfDays = halfDays,
            paidLeaveDays = paidLeaveDays,
            absentDays = absentDays,
            totalWorkingDays = round2(workingDays),
            totalHours = round2(totalHours),
            overtimeHours = round2(overtimeHours),
            attendanceEarnings = attendanceEarnings,
            overtimeEarnings = overtimeEarnings,
            bonusTotal = round2(bonusTotal),
            deductionTotal = round2(deductionTotal),
            totalSalary = totalSalary,
            advanceTotal = round2(advanceTotal),
            paidTotal = round2(paidTotal),
            remainingBalance = remainingBalance
        )
    }

    fun buildReportRows(
        workers: List<WorkerProfile>,
        attendance: List<AttendanceRecord>,
        transactions: List<FinancialTransaction>,
        startDate: String,
        endDate: String,
        wageYm: String
    ): List<ReportRow> {
        return workers.map { w ->
            val att = attendance.filter { it.workerId == w.id && it.date in startDate..endDate }
            val tx = transactions.filter { it.workerId == w.id && it.date in startDate..endDate }
            var present = 0
            var half = 0
            var leave = 0
            var absent = 0
            var otHours = 0.0
            for (r in att) {
                when (r.status) {
                    AttendanceStatus.PRESENT -> present++
                    AttendanceStatus.HALF_DAY -> half++
                    AttendanceStatus.PAID_LEAVE -> leave++
                    AttendanceStatus.ABSENT -> absent++
                }
                otHours += r.overtimeHours
            }
            val daily = effectiveDailyWage(w, wageYm)
            val workingDays = round2(present + leave + half * 0.5)
            val attEarn = round2(workingDays * daily)
            val otEarn = round2(otHours * w.overtimeRate)
            var bonus = 0.0
            var ded = 0.0
            var adv = 0.0
            var paid = 0.0
            for (t in tx) {
                when (t.category) {
                    TransactionCategory.BONUS -> bonus += t.amount
                    TransactionCategory.DEDUCTION -> ded += t.amount
                    TransactionCategory.ADVANCE -> adv += t.amount
                    TransactionCategory.PAYMENT -> paid += t.amount
                    TransactionCategory.EXPENSE -> Unit
                }
            }
            val totalSalary = round2(attEarn + otEarn + bonus - ded)
            val remaining = round2(totalSalary - adv - paid)
            ReportRow(
                worker = w,
                presentDays = present,
                halfDays = half,
                paidLeaveDays = leave,
                absentDays = absent,
                workingDays = workingDays,
                overtimeHours = round2(otHours),
                attendanceEarnings = attEarn,
                overtimeEarnings = otEarn,
                bonusTotal = round2(bonus),
                deductionTotal = round2(ded),
                totalSalary = totalSalary,
                advanceTotal = round2(adv),
                paidTotal = round2(paid),
                remainingBalance = remaining
            )
        }
    }

    fun haversineDistanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
            sin(dLng / 2) * sin(dLng / 2)
        return r * 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
    }

    fun formatInr(amount: Double): String {
        val negative = amount < 0
        val absVal = kotlin.math.abs(amount).roundToLong()
        val s = absVal.toString()
        val formatted = if (s.length <= 3) {
            s
        } else {
            val last3 = s.takeLast(3)
            val rest = s.dropLast(3)
            val sb = StringBuilder()
            var i = rest.length
            while (i > 0) {
                val start = (i - 2).coerceAtLeast(0)
                if (sb.isNotEmpty()) sb.insert(0, ',')
                sb.insert(0, rest.substring(start, i))
                i -= 2
            }
            "$sb,$last3"
        }
        return if (negative) "-₹$formatted" else "₹$formatted"
    }

    fun formatSalaryWhatsAppMessage(
        worker: WorkerProfile,
        salary: SalarySummary,
        lang: AppLanguage,
        businessName: String
    ): String {
        return if (lang == AppLanguage.HI) {
            """
            *MAJDOOR MITRA — मासिक वेतन विवरण*
            मजदूर का साथी, हिसाब में पारदर्शिता

            संस्थान: ${businessName.ifBlank { worker.employerName }}
            नाम: ${worker.name} (${worker.uniqueWorkerId})
            माह: ${salary.month} | साइट: ${worker.siteName.ifBlank { "मुख्य साइट" }}

            • उपस्थिति: ${salary.presentDays} पूरे दिन, ${salary.halfDays} आधे दिन, ${salary.paidLeaveDays} पेड लीव
            • कुल कार्य दिवस: ${salary.totalWorkingDays} दिन
            • ओवरटाइम: ${salary.overtimeHours} घंटे (${formatInr(salary.overtimeEarnings)})
            • हाजिरी कमाई: ${formatInr(salary.attendanceEarnings)}
            • बोनस: +${formatInr(salary.bonusTotal)} | कटौती: -${formatInr(salary.deductionTotal)}
            --------------------------------
            • कुल वेतन: *${formatInr(salary.totalSalary)}*
            • एडवांस: ${formatInr(salary.advanceTotal)}
            • भुगतान किया गया: ${formatInr(salary.paidTotal)}
            • *बकाया राशि: ${formatInr(salary.remainingBalance)}*
            """.trimIndent()
        } else {
            """
            *MAJDOOR MITRA — Monthly Salary Statement*
            Transparency in Every Account

            Organization: ${businessName.ifBlank { worker.employerName }}
            Worker: ${worker.name} (${worker.uniqueWorkerId})
            Month: ${salary.month} | Site: ${worker.siteName.ifBlank { "Main Site" }}

            • Attendance: ${salary.presentDays} Present, ${salary.halfDays} Half Days, ${salary.paidLeaveDays} Paid Leave
            • Total Working Days: ${salary.totalWorkingDays} days
            • Overtime: ${salary.overtimeHours} hrs (${formatInr(salary.overtimeEarnings)})
            • Attendance Earnings: ${formatInr(salary.attendanceEarnings)}
            • Bonus: +${formatInr(salary.bonusTotal)} | Deductions: -${formatInr(salary.deductionTotal)}
            --------------------------------
            • Total Salary: *${formatInr(salary.totalSalary)}*
            • Advances: ${formatInr(salary.advanceTotal)}
            • Paid Received: ${formatInr(salary.paidTotal)}
            • *Remaining Balance: ${formatInr(salary.remainingBalance)}*
            """.trimIndent()
        }
    }

    fun formatOwnerReportWhatsAppMessage(
        businessName: String,
        periodLabel: String,
        totalWorkers: Int,
        totalPayroll: Double,
        totalPaid: Double,
        totalAdvance: Double,
        totalPending: Double,
        lang: AppLanguage
    ): String {
        return if (lang == AppLanguage.HI) {
            """
            *MAJDOOR MITRA — वेतन एवं हिसाब रिपोर्ट*
            संस्थान: $businessName
            अवधि: $periodLabel | कुल मजदूर: $totalWorkers

            • कुल देय वेतन: ${formatInr(totalPayroll)}
            • कुल एडवांस: ${formatInr(totalAdvance)}
            • कुल भुगतान: ${formatInr(totalPaid)}
            • *कुल बकाया राशि: ${formatInr(totalPending)}*
            """.trimIndent()
        } else {
            """
            *MAJDOOR MITRA — Payroll Summary Report*
            Organization: $businessName
            Period: $periodLabel | Workers: $totalWorkers

            • Total Payroll: ${formatInr(totalPayroll)}
            • Total Advances: ${formatInr(totalAdvance)}
            • Total Paid: ${formatInr(totalPaid)}
            • *Total Pending Balance: ${formatInr(totalPending)}*
            """.trimIndent()
        }
    }
}
