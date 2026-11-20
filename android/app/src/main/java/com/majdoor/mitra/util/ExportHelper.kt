package com.majdoor.mitra.util

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.majdoor.mitra.data.AppWorkspaceData
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AttendanceRecord
import com.majdoor.mitra.model.FinancialTransaction
import com.majdoor.mitra.model.PayrollCalculator
import com.majdoor.mitra.model.ReportRow
import com.majdoor.mitra.model.SalarySummary
import com.majdoor.mitra.model.WorkerProfile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

object ExportHelper {

    private fun ensureExportDir(context: Context): File {
        val dir = File(context.cacheDir, "exports")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    fun getShareUri(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

    fun shareFile(context: Context, uri: Uri, mimeType: String, chooserTitle: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(intent, chooserTitle).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    fun openFile(context: Context, uri: Uri, mimeType: String, chooserTitle: String) {
        val viewIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mimeType)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val canOpen = viewIntent.resolveActivity(context.packageManager) != null
        if (canOpen) {
            context.startActivity(viewIntent)
        } else {
            shareFile(context, uri, mimeType, chooserTitle)
        }
    }

    fun shareToWhatsApp(context: Context, message: String) {
        val packages = listOf("com.whatsapp", "com.whatsapp.w4b")
        for (pkg in packages) {
            val waIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                `package` = pkg
                putExtra(Intent.EXTRA_TEXT, message)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (waIntent.resolveActivity(context.packageManager) != null) {
                context.startActivity(waIntent)
                return
            }
        }
        // Fallback: system share sheet or wa.me web link
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, message)
        }
        val chooser = Intent.createChooser(shareIntent, "Share via WhatsApp").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    fun generateWorkerSalaryPdf(
        context: Context,
        worker: WorkerProfile,
        salary: SalarySummary,
        businessName: String,
        attendance: List<AttendanceRecord>,
        transactions: List<FinancialTransaction>,
        lang: AppLanguage
    ): File {
        val doc = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
        val page = doc.startPage(pageInfo)
        val c = page.canvas

        val headerBg = Paint().apply { color = Color.rgb(29, 78, 216) }
        val accentPaint = Paint().apply { color = Color.rgb(234, 88, 12) }
        val whiteBold = Paint().apply {
            color = Color.WHITE
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        }
        val whiteSub = Paint().apply {
            color = Color.rgb(219, 234, 254)
            textSize = 11f
            isAntiAlias = true
        }
        val titlePaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        }
        val bodyPaint = Paint().apply {
            color = Color.rgb(51, 65, 85)
            textSize = 11f
            isAntiAlias = true
        }
        val boldBody = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 11.5f
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        }
        val linePaint = Paint().apply {
            color = Color.rgb(203, 213, 225)
            strokeWidth = 1f
        }
        val boxBg = Paint().apply { color = Color.rgb(248, 250, 252) }

        c.drawRect(0f, 0f, 595f, 88f, headerBg)
        c.drawRect(0f, 84f, 595f, 90f, accentPaint)
        c.drawText("MAJDOOR MITRA", 32f, 40f, whiteBold)
        c.drawText("मजदूर का साथी, हिसाब में पारदर्शिता", 32f, 60f, whiteSub)
        c.drawText("Month / माह: ${salary.month}", 410f, 48f, whiteSub)

        var y = 122f
        val heading = if (lang == AppLanguage.HI) "मासिक वेतन एवं हाजिरी विवरण" else "Monthly Salary & Attendance Statement"
        c.drawText(heading, 32f, y, titlePaint)
        y += 22f

        c.drawRect(32f, y, 563f, y + 86f, boxBg)
        c.drawText("Worker: ${worker.name} (${worker.uniqueWorkerId})", 44f, y + 22f, boldBody)
        c.drawText("Organization: ${businessName.ifBlank { worker.employerName }}", 44f, y + 40f, bodyPaint)
        c.drawText("Trade / Site: ${worker.skillRole} • ${worker.siteName.ifBlank { "-" }}", 44f, y + 58f, bodyPaint)
        c.drawText("Mobile: ${worker.mobileE164} • Daily Rate: ${PayrollCalculator.formatInr(salary.effectiveDailyWage)}", 44f, y + 76f, bodyPaint)
        y += 108f

        c.drawText("Attendance Summary / उपस्थिति सारांश", 32f, y, titlePaint)
        y += 18f
        c.drawText(
            "Present: ${salary.presentDays}  |  Half Day: ${salary.halfDays}  |  Paid Leave: ${salary.paidLeaveDays}  |  Absent: ${salary.absentDays}",
            32f,
            y,
            bodyPaint
        )
        y += 18f
        c.drawText(
            "Total Working Days: ${salary.totalWorkingDays}  |  Total Hours: ${salary.totalHours}h  |  Overtime: ${salary.overtimeHours}h",
            32f,
            y,
            bodyPaint
        )
        y += 16f
        c.drawLine(32f, y, 563f, y, linePaint)
        y += 24f

        c.drawText("Salary Breakdown / वेतन गणना", 32f, y, titlePaint)
        y += 20f
        val rows = listOf(
            "Attendance Earnings (${salary.totalWorkingDays} x ${PayrollCalculator.formatInr(salary.effectiveDailyWage)})" to PayrollCalculator.formatInr(salary.attendanceEarnings),
            "Overtime Earnings (${salary.overtimeHours}h x ${PayrollCalculator.formatInr(worker.overtimeRate)})" to "+${PayrollCalculator.formatInr(salary.overtimeEarnings)}",
            "Bonus / पुरस्कार" to "+${PayrollCalculator.formatInr(salary.bonusTotal)}",
            "Valid Deductions / कटौती" to "-${PayrollCalculator.formatInr(salary.deductionTotal)}",
            "Total Salary / कुल वेतन" to PayrollCalculator.formatInr(salary.totalSalary),
            "Advance Paid / एडवांस" to "-${PayrollCalculator.formatInr(salary.advanceTotal)}",
            "Salary Payments Received / प्राप्त भुगतान" to "-${PayrollCalculator.formatInr(salary.paidTotal)}",
            "Remaining Balance / शेष बकाया" to PayrollCalculator.formatInr(salary.remainingBalance)
        )
        for ((index, pair) in rows.withIndex()) {
            val p = if (index == 4 || index == 7) boldBody else bodyPaint
            c.drawText(pair.first, 36f, y, p)
            c.drawText(pair.second, 440f, y, p)
            y += 20f
            if (index == 3 || index == 6) {
                c.drawLine(32f, y - 12f, 563f, y - 12f, linePaint)
            }
        }

        y += 14f
        c.drawText("Recent Transactions (${salary.month}) / लेन-देन इतिहास", 32f, y, titlePaint)
        y += 18f
        val monthTx = transactions.filter { it.workerId == worker.id && it.month == salary.month }.take(12)
        if (monthTx.isEmpty()) {
            c.drawText("No transactions recorded in this month.", 36f, y, bodyPaint)
        } else {
            for (tx in monthTx) {
                if (y > 790f) break
                val line = "${tx.date} ${tx.time} • ${tx.category.apiValue} (${tx.mode.apiValue}) — ${tx.description.take(36)}"
                c.drawText(line, 36f, y, bodyPaint)
                c.drawText(PayrollCalculator.formatInr(tx.amount), 455f, y, boldBody)
                y += 16f
            }
        }

        c.drawText("Generated by MAJDOOR MITRA • Verified Digital Wage Record", 32f, 822f, bodyPaint)
        doc.finishPage(page)

        val file = File(ensureExportDir(context), "salary_${worker.uniqueWorkerId}_${salary.month}.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun generateOwnerReportPdf(
        context: Context,
        businessName: String,
        periodTitle: String,
        rows: List<ReportRow>,
        totalPayroll: Double,
        totalPaid: Double,
        totalAdvance: Double,
        totalPending: Double
    ): File {
        val doc = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
        var page = doc.startPage(pageInfo)
        var c = page.canvas

        val headerBg = Paint().apply { color = Color.rgb(29, 78, 216) }
        val accentPaint = Paint().apply { color = Color.rgb(234, 88, 12) }
        val whiteBold = Paint().apply {
            color = Color.WHITE
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        }
        val whiteSub = Paint().apply {
            color = Color.rgb(219, 234, 254)
            textSize = 11f
            isAntiAlias = true
        }
        val boldPaint = Paint().apply {
            color = Color.rgb(15, 23, 42)
            textSize = 11f
            typeface = Typeface.DEFAULT_BOLD
            isAntiAlias = true
        }
        val bodyPaint = Paint().apply {
            color = Color.rgb(51, 65, 85)
            textSize = 10f
            isAntiAlias = true
        }
        val linePaint = Paint().apply { color = Color.rgb(203, 213, 225); strokeWidth = 1f }

        c.drawRect(0f, 0f, 595f, 82f, headerBg)
        c.drawRect(0f, 78f, 595f, 84f, accentPaint)
        c.drawText("MAJDOOR MITRA — PAYROLL REPORT", 28f, 36f, whiteBold)
        c.drawText("$businessName  •  Period: $periodTitle", 28f, 58f, whiteSub)

        var y = 110f
        c.drawText(
            "Payroll: ${PayrollCalculator.formatInr(totalPayroll)}  |  Advances: ${PayrollCalculator.formatInr(totalAdvance)}  |  Paid: ${PayrollCalculator.formatInr(totalPaid)}  |  Pending: ${PayrollCalculator.formatInr(totalPending)}",
            28f,
            y,
            boldPaint
        )
        y += 22f
        c.drawLine(28f, y, 567f, y, linePaint)
        y += 16f
        c.drawText("Worker (ID)", 28f, y, boldPaint)
        c.drawText("Days/OT", 215f, y, boldPaint)
        c.drawText("Salary", 315f, y, boldPaint)
        c.drawText("Adv+Paid", 405f, y, boldPaint)
        c.drawText("Pending", 500f, y, boldPaint)
        y += 10f
        c.drawLine(28f, y, 567f, y, linePaint)
        y += 16f

        var pageNum = 1
        for (row in rows) {
            if (y > 790f) {
                doc.finishPage(page)
                pageNum++
                page = doc.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNum).create())
                c = page.canvas
                y = 48f
            }
            c.drawText("${row.worker.name.take(18)} (${row.worker.uniqueWorkerId})", 28f, y, bodyPaint)
            c.drawText("${row.workingDays}d / ${row.overtimeHours}h", 215f, y, bodyPaint)
            c.drawText(PayrollCalculator.formatInr(row.totalSalary), 315f, y, bodyPaint)
            c.drawText(PayrollCalculator.formatInr(row.advanceTotal + row.paidTotal), 405f, y, bodyPaint)
            c.drawText(PayrollCalculator.formatInr(row.remainingBalance), 500f, y, boldPaint)
            y += 18f
        }

        doc.finishPage(page)
        val safePeriod = periodTitle.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        val file = File(ensureExportDir(context), "majdoor_mitra_report_$safePeriod.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun generateOwnerReportExcel(
        context: Context,
        businessName: String,
        periodTitle: String,
        rows: List<ReportRow>,
        attendance: List<AttendanceRecord>,
        transactions: List<FinancialTransaction>
    ): File {
        fun esc(s: String): String = s
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")

        fun rowXml(cells: List<Any>): String {
            val inner = cells.joinToString("") { value ->
                when (value) {
                    is Number -> """<Cell><Data ss:Type="Number">$value</Data></Cell>"""
                    else -> """<Cell><Data ss:Type="String">${esc(value.toString())}</Data></Cell>"""
                }
            }
            return "<Row>$inner</Row>"
        }

        val summaryRows = buildString {
            append(rowXml(listOf("MAJDOOR MITRA Payroll Report", businessName, periodTitle)))
            append(rowXml(listOf("Unique ID", "Name", "Site", "Days", "OT Hours", "Att Earnings", "OT Earnings", "Bonus", "Deductions", "Total Salary", "Advances", "Paid", "Remaining")))
            rows.forEach { r ->
                append(
                    rowXml(
                        listOf(
                            r.worker.uniqueWorkerId,
                            r.worker.name,
                            r.worker.siteName,
                            r.workingDays,
                            r.overtimeHours,
                            r.attendanceEarnings,
                            r.overtimeEarnings,
                            r.bonusTotal,
                            r.deductionTotal,
                            r.totalSalary,
                            r.advanceTotal,
                            r.paidTotal,
                            r.remainingBalance
                        )
                    )
                )
            }
        }

        val attRows = buildString {
            append(rowXml(listOf("Date", "Worker ID", "Status", "Hours", "OT Hours", "GPS Verified", "Marked By", "Edit Reason")))
            attendance.forEach { a ->
                append(
                    rowXml(
                        listOf(
                            a.date,
                            a.workerId,
                            a.status.apiValue,
                            a.hoursWorked,
                            a.overtimeHours,
                            if (a.gpsVerified) "YES" else "NO",
                            a.markedByRole.apiValue,
                            a.editReason
                        )
                    )
                )
            }
        }

        val txRows = buildString {
            append(rowXml(listOf("Date", "Time", "Category", "Worker", "Mode", "Amount", "Reference", "Description")))
            transactions.forEach { t ->
                append(
                    rowXml(
                        listOf(
                            t.date,
                            t.time,
                            t.category.apiValue,
                            t.workerName,
                            t.mode.apiValue,
                            t.amount,
                            t.referenceNo,
                            t.description
                        )
                    )
                )
            }
        }

        val xml = """
            <?xml version="1.0"?>
            <?mso-application progid="Excel.Sheet"?>
            <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
             xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
             <Worksheet ss:Name="Payroll Summary"><Table>$summaryRows</Table></Worksheet>
             <Worksheet ss:Name="Attendance Log"><Table>$attRows</Table></Worksheet>
             <Worksheet ss:Name="Transactions"><Table>$txRows</Table></Worksheet>
            </Workbook>
        """.trimIndent()

        val safePeriod = periodTitle.replace(Regex("[^a-zA-Z0-9_-]"), "_")
        val file = File(ensureExportDir(context), "majdoor_mitra_$safePeriod.xls")
        file.writeText(xml, Charsets.UTF_8)
        return file
    }

    fun buildBackupJson(data: AppWorkspaceData): String {
        val root = JSONObject()
        root.put("app", "MAJDOOR MITRA")
        root.put("version", 1)
        root.put("exportedAt", PayrollCalculator.todayYmd())
        root.put("ownerName", data.employerOrg?.ownerName ?: data.account.name)
        root.put("businessName", data.employerOrg?.businessName ?: "")

        val sitesArr = JSONArray()
        data.workSites.forEach { s ->
            sitesArr.put(JSONObject().apply {
                put("id", s.id)
                put("name", s.name)
                put("location", s.location)
                if (s.latitude != null) put("latitude", s.latitude)
                if (s.longitude != null) put("longitude", s.longitude)
                put("radiusMeters", s.radiusMeters)
                put("status", s.status.apiValue)
            })
        }
        root.put("workSites", sitesArr)

        val workersArr = JSONArray()
        data.workers.forEach { w ->
            workersArr.put(JSONObject().apply {
                put("id", w.id)
                put("uniqueWorkerId", w.uniqueWorkerId)
                put("name", w.name)
                put("mobile", w.mobile)
                put("skillRole", w.skillRole)
                put("siteId", w.siteId)
                put("siteName", w.siteName)
                put("wageType", w.wageType.apiValue)
                put("dailyWage", w.dailyWage)
                put("monthlySalary", w.monthlySalary)
                put("overtimeRate", w.overtimeRate)
                put("status", w.status.apiValue)
                put("joinedAt", w.joinedAt)
            })
        }
        root.put("workers", workersArr)

        val attArr = JSONArray()
        data.attendance.forEach { a ->
            attArr.put(JSONObject().apply {
                put("id", a.id)
                put("workerId", a.workerId)
                put("siteId", a.siteId)
                put("date", a.date)
                put("status", a.status.apiValue)
                put("hoursWorked", a.hoursWorked)
                put("overtimeHours", a.overtimeHours)
                put("editReason", a.editReason)
                put("notes", a.notes)
            })
        }
        root.put("attendance", attArr)

        val txArr = JSONArray()
        data.transactions.forEach { t ->
            txArr.put(JSONObject().apply {
                put("id", t.id)
                put("category", t.category.apiValue)
                put("workerId", t.workerId)
                put("workerName", t.workerName)
                put("siteId", t.siteId)
                put("amount", t.amount)
                put("mode", t.mode.apiValue)
                put("referenceNo", t.referenceNo)
                put("date", t.date)
                put("time", t.time)
                put("description", t.description)
            })
        }
        root.put("transactions", txArr)

        return root.toString(2)
    }
}
