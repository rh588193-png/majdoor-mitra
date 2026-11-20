package com.majdoor.mitra.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.majdoor.mitra.data.AppWorkspaceData
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AttendanceRecord
import com.majdoor.mitra.model.AttendanceStatus
import com.majdoor.mitra.model.LeaveStatus
import com.majdoor.mitra.model.PayrollCalculator
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.model.WageType
import com.majdoor.mitra.model.WorkerProfile
import com.majdoor.mitra.ui.components.AttendanceStatusChip
import com.majdoor.mitra.ui.components.KpiStatCard
import com.majdoor.mitra.ui.components.MitraTopAppBar
import com.majdoor.mitra.ui.components.SalaryFormulaCard
import com.majdoor.mitra.ui.components.TransactionItemCard
import com.majdoor.mitra.ui.components.WhatsAppPreviewDialog
import com.majdoor.mitra.ui.components.WorkerAvatar
import com.majdoor.mitra.ui.theme.MitraAmber
import com.majdoor.mitra.ui.theme.MitraAmberSoft
import com.majdoor.mitra.ui.theme.MitraBlue
import com.majdoor.mitra.ui.theme.MitraBlueSoft
import com.majdoor.mitra.ui.theme.MitraGreen
import com.majdoor.mitra.ui.theme.MitraGreenSoft
import com.majdoor.mitra.ui.theme.MitraOrange
import com.majdoor.mitra.ui.theme.MitraRed
import com.majdoor.mitra.ui.theme.MitraRedSoft
import com.majdoor.mitra.util.ExportHelper
import com.majdoor.mitra.util.Strings
import java.util.Calendar

@Composable
fun WorkerDashboardScreen(
    workspace: AppWorkspaceData,
    isDemo: Boolean,
    isBusy: Boolean,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit,
    onGpsCheckIn: (worker: WorkerProfile, lat: Double, lng: Double, verified: Boolean) -> Unit,
    onSubmitLeave: (worker: WorkerProfile, fromDate: String, toDate: String, reason: String) -> Unit,
    onMarkNotificationRead: (String) -> Unit,
    onShowMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val strings = Strings.of(workspace.account.language)
    var selectedTab by remember { mutableIntStateOf(0) }
    var selectedMonth by remember { mutableStateOf(PayrollCalculator.currentYm()) }
    var selectedWorkerId by remember(workspace.workers) {
        mutableStateOf(workspace.workers.firstOrNull()?.id ?: "")
    }
    var inspectedAttendance by remember { mutableStateOf<AttendanceRecord?>(null) }
    var showWhatsAppDialog by remember { mutableStateOf(false) }

    val activeWorker = workspace.workers.firstOrNull { it.id == selectedWorkerId } ?: workspace.workers.firstOrNull()
    val unreadCount = workspace.notifications.count { !it.isRead }

    // GPS location helper
    val performGpsCheckIn: (WorkerProfile) -> Unit = remember(context) {
        { worker ->
            @SuppressLint("MissingPermission")
            fun fetchLocation() {
                val client = LocationServices.getFusedLocationProviderClient(context)
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { loc ->
                        if (loc == null) {
                            onShowMessage(
                                if (workspace.account.language == AppLanguage.HI)
                                    "GPS लोकेशन नहीं मिल सकी। कृपया लोकेशन चालू करें।"
                                else "Unable to acquire GPS fix. Please enable device Location."
                            )
                        } else {
                            val siteLat = worker.siteLat
                            val siteLng = worker.siteLng
                            val radius = worker.siteRadiusMeters ?: 500.0
                            if (siteLat != null && siteLng != null) {
                                val dist = PayrollCalculator.haversineDistanceMeters(loc.latitude, loc.longitude, siteLat, siteLng)
                                if (dist <= radius) {
                                    onGpsCheckIn(worker, loc.latitude, loc.longitude, true)
                                } else {
                                    onShowMessage(
                                        if (workspace.account.language == AppLanguage.HI)
                                            "आप कार्य साइट से ${dist.toInt()} मीटर दूर हैं (अधिकतम सीमा: ${radius.toInt()} मी)।"
                                        else "You are ${dist.toInt()}m away from site (allowed radius: ${radius.toInt()}m)."
                                    )
                                }
                            } else {
                                onGpsCheckIn(worker, loc.latitude, loc.longitude, true)
                            }
                        }
                    }
                    .addOnFailureListener {
                        onShowMessage(it.message ?: "GPS location error")
                    }
            }
            fetchLocation()
        }
    }

    var pendingGpsWorker by remember { mutableStateOf<WorkerProfile?>(null) }
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        val target = pendingGpsWorker
        pendingGpsWorker = null
        if (granted && target != null) {
            performGpsCheckIn(target)
        } else {
            onShowMessage(
                if (workspace.account.language == AppLanguage.HI)
                    "GPS हाजिरी के लिए लोकेशन अनुमति आवश्यक है।"
                else "Location permission is required for GPS Check-In."
            )
        }
    }

    Scaffold(
        topBar = {
            MitraTopAppBar(
                title = strings.appName,
                subtitle = activeWorker?.let { "${it.name} • ${it.uniqueWorkerId}" } ?: workspace.account.name,
                isDemo = isDemo,
                language = workspace.account.language,
                themeMode = workspace.account.theme,
                strings = strings,
                onToggleLanguage = onToggleLanguage,
                onToggleTheme = onToggleTheme,
                onSignOut = onSignOut
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    label = { Text(strings.tabHome) }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
                    label = { Text(strings.tabCalendar) }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = null) },
                    label = { Text(strings.tabLedger) }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = {
                        BadgedBox(badge = {
                            if (unreadCount > 0) Badge { Text("$unreadCount") }
                        }) {
                            Icon(Icons.Default.Notifications, contentDescription = null)
                        }
                    },
                    label = { Text(strings.tabAlerts) }
                )
            }
        }
    ) { padding ->
        if (activeWorker == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Card(shape = RoundedCornerShape(16.dp)) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(Icons.Default.Badge, contentDescription = null, tint = MitraBlue, modifier = Modifier.size(44.dp))
                        Text(strings.noDataTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(
                            strings.noWorkerLinkedMsg,
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            "Registered Mobile: ${workspace.account.mobileE164}",
                            style = MaterialTheme.typography.labelLarge,
                            color = MitraBlue
                        )
                    }
                }
            }
            return@Scaffold
        }

        val workerAtt = workspace.attendance.filter { it.workerId == activeWorker.id }
        val workerTx = workspace.transactions.filter { it.workerId == activeWorker.id }
        val salary = remember(activeWorker, selectedMonth, workerAtt, workerTx) {
            PayrollCalculator.recomputeSalary(activeWorker, selectedMonth, workerAtt, workerTx)
        }
        val today = PayrollCalculator.todayYmd()
        val todayAtt = workerAtt.firstOrNull { it.date == today }

        if (showWhatsAppDialog) {
            val msg = PayrollCalculator.formatSalaryWhatsAppMessage(
                worker = activeWorker,
                salary = salary,
                lang = workspace.account.language,
                businessName = activeWorker.employerName
            )
            WhatsAppPreviewDialog(
                title = strings.shareWhatsApp,
                message = msg,
                strings = strings,
                onShare = {
                    showWhatsAppDialog = false
                    ExportHelper.shareToWhatsApp(context, msg)
                },
                onDismiss = { showWhatsAppDialog = false }
            )
        }

        inspectedAttendance?.let { rec ->
            AlertDialog(
                onDismissRequest = { inspectedAttendance = null },
                title = { Text("${rec.date} — ${strings.editHistoryTitle}", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        AttendanceStatusChip(rec.status)
                        Text("Hours: ${rec.hoursWorked}h  |  Overtime: ${rec.overtimeHours}h")
                        if (rec.gpsVerified) {
                            Text("${strings.gpsVerifiedTag}: ${rec.gpsLat ?: "-"}, ${rec.gpsLng ?: "-"}", color = MitraGreen)
                        }
                        if (rec.editReason.isNotBlank()) {
                            Text("Latest Reason: ${rec.editReason}", fontWeight = FontWeight.SemiBold)
                        }
                        if (rec.editHistory.isNotEmpty()) {
                            HorizontalDivider()
                            rec.editHistory.forEach { entry ->
                                Text("• $entry", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                },
                confirmButton = {
                    TextButton(onClick = { inspectedAttendance = null }) { Text("OK") }
                }
            )
        }

        when (selectedTab) {
            0 -> LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (workspace.workers.size > 1) {
                    item {
                        Text(strings.employerSwitcher, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            workspace.workers.forEach { w ->
                                FilterChip(
                                    selected = w.id == activeWorker.id,
                                    onClick = { selectedWorkerId = w.id },
                                    label = { Text("${w.employerName.ifBlank { "Employer" }} (${w.uniqueWorkerId})") }
                                )
                            }
                        }
                    }
                }

                // Worker ID Card
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            WorkerAvatar(name = activeWorker.name, photoUrl = activeWorker.photoUrl, size = 56.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(activeWorker.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                Text(
                                    "ID: ${activeWorker.uniqueWorkerId} • ${activeWorker.skillRole}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MitraBlue,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    "${activeWorker.employerName} • ${activeWorker.siteName.ifBlank { "Main Site" }}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                val wageLine = if (activeWorker.wageType == WageType.MONTHLY) {
                                    "${strings.monthlySalaryLabel}: ${PayrollCalculator.formatInr(activeWorker.monthlySalary)}"
                                } else {
                                    "${strings.dailyWageLabel}: ${PayrollCalculator.formatInr(activeWorker.dailyWage)}"
                                }
                                Text(
                                    "$wageLine • OT: ${PayrollCalculator.formatInr(activeWorker.overtimeRate)}/hr",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MitraOrange,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                // Today's Status + GPS Check-In
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("Today ($today)", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    Text(
                                        text = todayAtt?.let { strings.statusLabel(it.status) } ?: "Not Marked Yet",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                if (todayAtt != null) {
                                    AttendanceStatusChip(todayAtt.status)
                                }
                            }
                            if (todayAtt == null) {
                                Button(
                                    onClick = {
                                        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                                        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                                        if (fine || coarse) {
                                            performGpsCheckIn(activeWorker)
                                        } else {
                                            pendingGpsWorker = activeWorker
                                            locationPermissionLauncher.launch(
                                                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                                            )
                                        }
                                    },
                                    enabled = !isBusy,
                                    colors = ButtonDefaults.buttonColors(containerColor = MitraGreen),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text(strings.gpsCheckIn, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                // Month Switcher
                item {
                    MonthSwitcherRow(selectedMonth) { selectedMonth = it }
                }

                // KPI Grid
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        KpiStatCard(
                            label = strings.totalSalary,
                            value = PayrollCalculator.formatInr(salary.totalSalary),
                            accent = MitraBlue,
                            subtext = "${salary.totalWorkingDays} ${strings.workingDaysLabel}",
                            modifier = Modifier.weight(1f)
                        )
                        KpiStatCard(
                            label = strings.remainingBalance,
                            value = PayrollCalculator.formatInr(salary.remainingBalance),
                            accent = MitraOrange,
                            subtext = "Adv ${PayrollCalculator.formatInr(salary.advanceTotal)} • Paid ${PayrollCalculator.formatInr(salary.paidTotal)}",
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // Breakdown
                item {
                    SalaryFormulaCard(salary = salary, overtimeRate = activeWorker.overtimeRate, strings = strings)
                }

                // PDF + WhatsApp Actions
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = {
                                val file = ExportHelper.generateWorkerSalaryPdf(
                                    context = context,
                                    worker = activeWorker,
                                    salary = salary,
                                    businessName = activeWorker.employerName,
                                    attendance = workerAtt,
                                    transactions = workerTx,
                                    lang = workspace.account.language
                                )
                                val uri = ExportHelper.getShareUri(context, file)
                                ExportHelper.openFile(context, uri, "application/pdf", strings.downloadPdf)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.PictureAsPdf, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(strings.downloadPdf, maxLines = 1)
                        }
                        Button(
                            onClick = { showWhatsAppDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(strings.shareWhatsApp, maxLines = 1)
                        }
                    }
                }
            }

            1 -> WorkerCalendarTab(
                month = selectedMonth,
                onMonthChange = { selectedMonth = it },
                attendance = workerAtt.filter { it.month == selectedMonth },
                onInspectDay = { inspectedAttendance = it },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            2 -> WorkerLedgerTab(
                transactions = workerTx,
                strings = strings,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            3 -> WorkerAlertsAndLeaveTab(
                worker = activeWorker,
                language = workspace.account.language,
                notifications = workspace.notifications,
                leaveRequests = workspace.leaveRequests.filter { it.workerId == activeWorker.id },
                strings = strings,
                isBusy = isBusy,
                onSubmitLeave = onSubmitLeave,
                onMarkRead = onMarkNotificationRead,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )
        }
    }
}

@Composable
private fun MonthSwitcherRow(month: String, onChange: (String) -> Unit) {
    fun shiftMonth(ym: String, delta: Int): String {
        val parts = ym.split("-")
        val y = parts.getOrNull(0)?.toIntOrNull() ?: 2026
        val m = parts.getOrNull(1)?.toIntOrNull() ?: 1
        val cal = Calendar.getInstance()
        cal.set(y, (m - 1).coerceIn(0, 11), 1)
        cal.add(Calendar.MONTH, delta)
        val ny = cal.get(Calendar.YEAR)
        val nm = (cal.get(Calendar.MONTH) + 1).toString().padStart(2, '0')
        return "$ny-$nm"
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = { onChange(shiftMonth(month, -1)) }) {
                Icon(Icons.Default.ChevronLeft, contentDescription = "Previous")
            }
            Text(month, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            IconButton(onClick = { onChange(shiftMonth(month, +1)) }) {
                Icon(Icons.Default.ChevronRight, contentDescription = "Next")
            }
        }
    }
}

@Composable
private fun WorkerCalendarTab(
    month: String,
    onMonthChange: (String) -> Unit,
    attendance: List<AttendanceRecord>,
    onInspectDay: (AttendanceRecord) -> Unit,
    modifier: Modifier = Modifier
) {
    val dates = remember(month) { PayrollCalculator.monthDates(month) }
    val offset = remember(month) { PayrollCalculator.startDayOffset(month) }
    val byDate = remember(attendance) { attendance.associateBy { it.date } }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item { MonthSwitcherRow(month, onMonthChange) }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa").forEach { d ->
                            Text(
                                text = d,
                                modifier = Modifier.weight(1f),
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    val totalCells = offset + dates.size
                    val rows = (totalCells + 6) / 7
                    for (r in 0 until rows) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            for (c in 0..6) {
                                val idx = r * 7 + c - offset
                                if (idx < 0 || idx >= dates.size) {
                                    Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                                } else {
                                    val ymd = dates[idx]
                                    val dayNum = ymd.takeLast(2).toInt()
                                    val rec = byDate[ymd]
                                    val (bg, fg, code) = when (rec?.status) {
                                        AttendanceStatus.PRESENT -> Triple(MitraGreenSoft, MitraGreen, "P")
                                        AttendanceStatus.HALF_DAY -> Triple(MitraAmberSoft, MitraAmber, "H")
                                        AttendanceStatus.PAID_LEAVE -> Triple(MitraBlueSoft, MitraBlue, "L")
                                        AttendanceStatus.ABSENT -> Triple(MitraRedSoft, MitraRed, "A")
                                        null -> Triple(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f), MaterialTheme.colorScheme.onSurfaceVariant, "-")
                                    }
                                    Box(
                                        contentAlignment = Alignment.Center,
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .clip(RoundedCornerShape(8.dp))
                                            .background(bg)
                                            .clickable(enabled = rec != null) { if (rec != null) onInspectDay(rec) }
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("$dayNum", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = fg)
                                            Text(code, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.ExtraBold, color = fg)
                                            if (rec != null && rec.overtimeHours > 0) {
                                                Text("+${rec.overtimeHours.toInt()}h", style = MaterialTheme.typography.labelSmall, color = MitraOrange)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        items(attendance.sortedByDescending { it.date }) { rec ->
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onInspectDay(rec) }
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(rec.date, fontWeight = FontWeight.Bold)
                        Text(
                            "Hours: ${rec.hoursWorked}h • OT: ${rec.overtimeHours}h${if (rec.gpsVerified) " • GPS✓" else ""}",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        if (rec.editReason.isNotBlank()) {
                            Text("Reason: ${rec.editReason}", style = MaterialTheme.typography.labelSmall, color = MitraOrange)
                        }
                    }
                    AttendanceStatusChip(rec.status, compact = true)
                }
            }
        }
    }
}

@Composable
private fun WorkerLedgerTab(
    transactions: List<com.majdoor.mitra.model.FinancialTransaction>,
    strings: com.majdoor.mitra.util.AppStrings,
    modifier: Modifier = Modifier
) {
    var selectedCategory by remember { mutableStateOf<TransactionCategory?>(null) }
    val filtered = remember(transactions, selectedCategory) {
        if (selectedCategory == null) transactions else transactions.filter { it.category == selectedCategory }
    }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedCategory == null,
                    onClick = { selectedCategory = null },
                    label = { Text("All") }
                )
                listOf(
                    TransactionCategory.PAYMENT,
                    TransactionCategory.ADVANCE,
                    TransactionCategory.BONUS,
                    TransactionCategory.DEDUCTION
                ).forEach { cat ->
                    FilterChip(
                        selected = selectedCategory == cat,
                        onClick = { selectedCategory = cat },
                        label = { Text(strings.categoryLabel(cat)) }
                    )
                }
            }
        }
        if (filtered.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = strings.noDataTitle,
                        modifier = Modifier.padding(20.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            items(filtered) { tx ->
                TransactionItemCard(tx = tx, strings = strings)
            }
        }
    }
}

@Composable
private fun WorkerAlertsAndLeaveTab(
    worker: WorkerProfile,
    language: AppLanguage,
    notifications: List<com.majdoor.mitra.model.NotificationItem>,
    leaveRequests: List<com.majdoor.mitra.model.LeaveRequest>,
    strings: com.majdoor.mitra.util.AppStrings,
    isBusy: Boolean,
    onSubmitLeave: (WorkerProfile, String, String, String) -> Unit,
    onMarkRead: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var fromDate by remember { mutableStateOf(PayrollCalculator.shiftDateYmd(PayrollCalculator.todayYmd(), 1)) }
    var toDate by remember { mutableStateOf(PayrollCalculator.shiftDateYmd(PayrollCalculator.todayYmd(), 1)) }
    var reason by remember { mutableStateOf("") }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.EventAvailable, contentDescription = null, tint = MitraBlue)
                        Spacer(Modifier.width(8.dp))
                        Text(strings.submitLeave, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = fromDate,
                            onValueChange = { fromDate = it },
                            label = { Text(strings.fromDate) },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = toDate,
                            onValueChange = { toDate = it },
                            label = { Text(strings.toDate) },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text(strings.reasonLabel) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Button(
                        onClick = {
                            if (reason.isNotBlank()) {
                                onSubmitLeave(worker, fromDate.trim(), toDate.trim(), reason.trim())
                                reason = ""
                            }
                        },
                        enabled = !isBusy && reason.isNotBlank() && fromDate.length == 10 && toDate.length == 10,
                        colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.submitLeave, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (leaveRequests.isNotEmpty()) {
            item {
                Text(strings.pendingLeaves, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            items(leaveRequests) { lv ->
                val (bg, fg) = when (lv.status) {
                    LeaveStatus.APPROVED -> MitraGreenSoft to MitraGreen
                    LeaveStatus.REJECTED -> MitraRedSoft to MitraRed
                    LeaveStatus.PENDING -> MitraAmberSoft to MitraAmber
                }
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("${lv.fromDate} → ${lv.toDate}", fontWeight = FontWeight.Bold)
                            Text(lv.reason, style = MaterialTheme.typography.bodyMedium)
                            if (lv.ownerNote.isNotBlank()) {
                                Text("Owner Note: ${lv.ownerNote}", style = MaterialTheme.typography.labelSmall, color = MitraBlue)
                            }
                        }
                        Surface(color = bg, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                text = strings.leaveLabel(lv.status),
                                color = fg,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelMedium,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }

        item {
            Text(strings.unreadAlerts, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        if (notifications.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(strings.noDataTitle, modifier = Modifier.padding(16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            items(notifications) { notif ->
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (notif.isRead) MaterialTheme.colorScheme.surface else MitraBlueSoft.copy(alpha = 0.35f)
                    ),
                    border = if (!notif.isRead) BorderStroke(1.dp, MitraBlue) else null,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (language == AppLanguage.HI) notif.titleHi else notif.titleEn,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (language == AppLanguage.HI) notif.messageHi else notif.messageEn,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        if (!notif.isRead) {
                            TextButton(onClick = { onMarkRead(notif.id) }) {
                                Text(strings.markRead)
                            }
                        }
                    }
                }
            }
        }
    }
}
