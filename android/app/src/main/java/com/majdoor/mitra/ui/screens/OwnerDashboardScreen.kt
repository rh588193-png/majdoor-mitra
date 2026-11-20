package com.majdoor.mitra.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Assessment
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Domain
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Restore
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.TableView
import androidx.compose.material.icons.filled.Today
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.material3.Switch
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.majdoor.mitra.data.AppWorkspaceData
import com.majdoor.mitra.data.AttendanceMarkInput
import com.majdoor.mitra.data.SiteInput
import com.majdoor.mitra.data.TransactionInput
import com.majdoor.mitra.data.WorkerInput
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AppThemeMode
import com.majdoor.mitra.model.AttendanceRecord
import com.majdoor.mitra.model.AttendanceStatus
import com.majdoor.mitra.model.LeaveRequest
import com.majdoor.mitra.model.LeaveStatus
import com.majdoor.mitra.model.PaymentMode
import com.majdoor.mitra.model.PayrollCalculator
import com.majdoor.mitra.model.SiteStatus
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.model.WageType
import com.majdoor.mitra.model.WorkSite
import com.majdoor.mitra.model.WorkerProfile
import com.majdoor.mitra.model.WorkerStatus
import com.majdoor.mitra.ui.components.AttendanceStatusChip
import com.majdoor.mitra.ui.components.KpiStatCard
import com.majdoor.mitra.ui.components.MitraTopAppBar
import com.majdoor.mitra.ui.components.SalaryFormulaCard
import com.majdoor.mitra.ui.components.TransactionItemCard
import com.majdoor.mitra.ui.components.WhatsAppPreviewDialog
import com.majdoor.mitra.ui.components.WorkerAvatar
import com.majdoor.mitra.ui.theme.MitraAmber
import com.majdoor.mitra.ui.theme.MitraBlue
import com.majdoor.mitra.ui.theme.MitraBlueSoft
import com.majdoor.mitra.ui.theme.MitraGreen
import com.majdoor.mitra.ui.theme.MitraGreenSoft
import com.majdoor.mitra.ui.theme.MitraOrange
import com.majdoor.mitra.ui.theme.MitraRed
import com.majdoor.mitra.ui.theme.MitraRedSoft
import com.majdoor.mitra.util.AppStrings
import com.majdoor.mitra.util.ExportHelper
import com.majdoor.mitra.util.Strings
import java.io.ByteArrayOutputStream

enum class ReportPeriod { DAILY, WEEKLY, MONTHLY }

@Composable
fun OwnerDashboardScreen(
    workspace: AppWorkspaceData,
    isDemo: Boolean,
    isBusy: Boolean,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit,
    onSaveWorker: (existing: WorkerProfile?, input: WorkerInput) -> Unit,
    onDeleteWorker: (workerId: String) -> Unit,
    onMarkAttendance: (worker: WorkerProfile, existing: AttendanceRecord?, input: AttendanceMarkInput) -> Unit,
    onBulkMarkPresent: (date: String, siteWorkers: List<WorkerProfile>) -> Unit,
    onRecordTransaction: (TransactionInput) -> Unit,
    onSaveSite: (existingId: String?, input: SiteInput) -> Unit,
    onDeleteSite: (siteId: String) -> Unit,
    onRespondLeave: (leave: LeaveRequest, status: LeaveStatus, note: String) -> Unit,
    onUpdateOrg: (businessName: String, ownerName: String, address: String) -> Unit,
    onExportBackupJson: () -> String,
    onRestoreBackupJson: (jsonString: String) -> Unit,
    onShowMessage: (String) -> Unit
) {
    val context = LocalContext.current
    val strings = Strings.of(workspace.account.language)
    var selectedTab by remember { mutableIntStateOf(0) }
    var selectedDate by remember { mutableStateOf(PayrollCalculator.todayYmd()) }
    var selectedSiteFilter by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }

    // Modal state
    var showWorkerDialog by remember { mutableStateOf(false) }
    var editingWorker by remember { mutableStateOf<WorkerProfile?>(null) }

    var attendanceEditTarget by remember { mutableStateOf<Pair<WorkerProfile, AttendanceRecord?>?>(null) }
    var inspectedWorker by remember { mutableStateOf<WorkerProfile?>(null) }

    var showTxDialog by remember { mutableStateOf<TransactionCategory?>(null) }
    var preselectedTxWorkerId by remember { mutableStateOf("") }

    var showSiteDialog by remember { mutableStateOf(false) }
    var editingSite by remember { mutableStateOf<WorkSite?>(null) }

    var whatsAppPreviewMsg by remember { mutableStateOf<Pair<String, String>?>(null) }

    val activeWorkers = remember(workspace.workers, selectedSiteFilter) {
        workspace.workers.filter { w ->
            (selectedSiteFilter.isBlank() || w.siteId == selectedSiteFilter)
        }
    }
    val pendingLeavesCount = workspace.leaveRequests.count { it.status == LeaveStatus.PENDING }

    // Backup & Restore document launchers
    val backupLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/json")
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                val json = onExportBackupJson()
                context.contentResolver.openOutputStream(uri)?.use { out ->
                    out.write(json.toByteArray(Charsets.UTF_8))
                }
            }.onSuccess {
                onShowMessage("Backup saved successfully.")
            }.onFailure {
                onShowMessage(it.message ?: "Backup failed")
            }
        }
    }

    val restoreLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }.orEmpty()
            }.onSuccess { json ->
                if (json.isNotBlank()) onRestoreBackupJson(json)
            }.onFailure {
                onShowMessage(it.message ?: "Restore failed")
            }
        }
    }

    // Dialogs
    if (showWorkerDialog) {
        WorkerFormDialog(
            existing = editingWorker,
            sites = workspace.workSites,
            strings = strings,
            isBusy = isBusy,
            onDismiss = { showWorkerDialog = false },
            onSave = { input ->
                onSaveWorker(editingWorker, input)
                showWorkerDialog = false
            }
        )
    }

    attendanceEditTarget?.let { (worker, existingRec) ->
        AttendanceEditDialog(
            worker = worker,
            date = selectedDate,
            existing = existingRec,
            strings = strings,
            isBusy = isBusy,
            onDismiss = { attendanceEditTarget = null },
            onSave = { input ->
                onMarkAttendance(worker, existingRec, input)
                attendanceEditTarget = null
            }
        )
    }

    inspectedWorker?.let { w ->
        val ym = PayrollCalculator.currentYm()
        val sal = PayrollCalculator.recomputeSalary(w, ym, workspace.attendance, workspace.transactions)
        AlertDialog(
            onDismissRequest = { inspectedWorker = null },
            title = { Text("${w.name} (${w.uniqueWorkerId})", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("${w.skillRole} • ${w.siteName} • ${w.mobileE164}", style = MaterialTheme.typography.bodySmall)
                    SalaryFormulaCard(salary = sal, overtimeRate = w.overtimeRate, strings = strings)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        OutlinedButton(
                            onClick = {
                                val file = ExportHelper.generateWorkerSalaryPdf(
                                    context = context,
                                    worker = w,
                                    salary = sal,
                                    businessName = workspace.employerOrg?.businessName ?: workspace.account.name,
                                    attendance = workspace.attendance,
                                    transactions = workspace.transactions,
                                    lang = workspace.account.language
                                )
                                ExportHelper.openFile(context, ExportHelper.getShareUri(context, file), "application/pdf", strings.downloadPdf)
                            },
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("PDF")
                        }
                        Button(
                            onClick = {
                                val msg = PayrollCalculator.formatSalaryWhatsAppMessage(
                                    worker = w,
                                    salary = sal,
                                    lang = workspace.account.language,
                                    businessName = workspace.employerOrg?.businessName ?: workspace.account.name
                                )
                                whatsAppPreviewMsg = strings.shareWhatsApp to msg
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("WhatsApp")
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { inspectedWorker = null }) { Text("Close") }
            }
        )
    }

    showTxDialog?.let { cat ->
        TransactionFormDialog(
            initialCategory = cat,
            preselectedWorkerId = preselectedTxWorkerId,
            workers = workspace.workers,
            sites = workspace.workSites,
            strings = strings,
            isBusy = isBusy,
            onDismiss = { showTxDialog = null },
            onSave = { input ->
                onRecordTransaction(input)
                showTxDialog = null
            }
        )
    }

    if (showSiteDialog) {
        WorkSiteFormDialog(
            existing = editingSite,
            strings = strings,
            isBusy = isBusy,
            onShowMessage = onShowMessage,
            onDismiss = { showSiteDialog = false },
            onSave = { input ->
                onSaveSite(editingSite?.id, input)
                showSiteDialog = false
            }
        )
    }

    whatsAppPreviewMsg?.let { (title, msg) ->
        WhatsAppPreviewDialog(
            title = title,
            message = msg,
            strings = strings,
            onShare = {
                whatsAppPreviewMsg = null
                ExportHelper.shareToWhatsApp(context, msg)
            },
            onDismiss = { whatsAppPreviewMsg = null }
        )
    }

    Scaffold(
        topBar = {
            MitraTopAppBar(
                title = workspace.employerOrg?.businessName?.ifBlank { strings.appName } ?: strings.appName,
                subtitle = "${workspace.account.name} • ${workspace.workers.size} Workers",
                isDemo = isDemo,
                language = workspace.account.language,
                themeMode = workspace.account.theme,
                strings = strings,
                onToggleLanguage = onToggleLanguage,
                onToggleTheme = onToggleTheme,
                onSignOut = onSignOut
            )
        },
        floatingActionButton = {
            if (selectedTab == 1) {
                FloatingActionButton(
                    onClick = {
                        editingWorker = null
                        showWorkerDialog = true
                    },
                    containerColor = MitraOrange,
                    contentColor = Color.White
                ) {
                    Icon(Icons.Default.Add, contentDescription = strings.addWorker)
                }
            }
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Today, contentDescription = null) },
                    label = { Text(strings.tabAttendance, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Groups, contentDescription = null) },
                    label = { Text(strings.tabWorkers, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = null) },
                    label = { Text(strings.tabAccounts, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = {
                        BadgedBox(badge = {
                            if (pendingLeavesCount > 0) Badge { Text("$pendingLeavesCount") }
                        }) {
                            Icon(Icons.Default.Assessment, contentDescription = null)
                        }
                    },
                    label = { Text(strings.tabReports, maxLines = 1) }
                )
                NavigationBarItem(
                    selected = selectedTab == 4,
                    onClick = { selectedTab = 4 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text(strings.tabSettings, maxLines = 1) }
                )
            }
        }
    ) { padding ->
        when (selectedTab) {
            0 -> OwnerAttendanceTab(
                date = selectedDate,
                onDateChange = { selectedDate = it },
                sites = workspace.workSites,
                selectedSiteId = selectedSiteFilter,
                onSiteSelect = { selectedSiteFilter = it },
                workers = activeWorkers.filter { it.status == WorkerStatus.ACTIVE },
                attendance = workspace.attendance,
                strings = strings,
                isBusy = isBusy,
                onBulkMarkPresent = { onBulkMarkPresent(selectedDate, activeWorkers) },
                onQuickMark = { worker, status ->
                    onMarkAttendance(
                        worker,
                        null,
                        AttendanceMarkInput(
                            workerId = worker.id,
                            date = selectedDate,
                            status = status,
                            hoursWorked = when (status) {
                                AttendanceStatus.PRESENT, AttendanceStatus.PAID_LEAVE -> 8.0
                                AttendanceStatus.HALF_DAY -> 4.0
                                AttendanceStatus.ABSENT -> 0.0
                            },
                            overtimeHours = 0.0,
                            editReason = "",
                            notes = ""
                        )
                    )
                },
                onOpenEdit = { worker, rec -> attendanceEditTarget = worker to rec },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            1 -> OwnerWorkersTab(
                searchQuery = searchQuery,
                onSearchChange = { searchQuery = it },
                workers = workspace.workers,
                attendance = workspace.attendance,
                transactions = workspace.transactions,
                strings = strings,
                onAddWorker = {
                    editingWorker = null
                    showWorkerDialog = true
                },
                onEditWorker = { w ->
                    editingWorker = w
                    showWorkerDialog = true
                },
                onInspectWorker = { inspectedWorker = it },
                onQuickPay = { w ->
                    preselectedTxWorkerId = w.id
                    showTxDialog = TransactionCategory.PAYMENT
                },
                onDeleteWorker = onDeleteWorker,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            2 -> OwnerAccountsTab(
                workers = workspace.workers,
                attendance = workspace.attendance,
                transactions = workspace.transactions,
                strings = strings,
                onOpenTxModal = { cat ->
                    preselectedTxWorkerId = workspace.workers.firstOrNull()?.id ?: ""
                    showTxDialog = cat
                },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            3 -> OwnerSitesAndReportsTab(
                workspace = workspace,
                strings = strings,
                isBusy = isBusy,
                onAddSite = {
                    editingSite = null
                    showSiteDialog = true
                },
                onEditSite = { site ->
                    editingSite = site
                    showSiteDialog = true
                },
                onDeleteSite = onDeleteSite,
                onRespondLeave = onRespondLeave,
                onPreviewWhatsApp = { msg -> whatsAppPreviewMsg = strings.shareWhatsApp to msg },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )

            4 -> OwnerSettingsAndAuditTab(
                workspace = workspace,
                strings = strings,
                isBusy = isBusy,
                onToggleLanguage = onToggleLanguage,
                onToggleTheme = onToggleTheme,
                onUpdateOrg = onUpdateOrg,
                onLaunchBackup = { backupLauncher.launch("majdoor-mitra-backup-${PayrollCalculator.todayYmd()}.json") },
                onLaunchRestore = { restoreLauncher.launch(arrayOf("application/json", "*/*")) },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            )
        }
    }
}

@Composable
private fun OwnerAttendanceTab(
    date: String,
    onDateChange: (String) -> Unit,
    sites: List<WorkSite>,
    selectedSiteId: String,
    onSiteSelect: (String) -> Unit,
    workers: List<WorkerProfile>,
    attendance: List<AttendanceRecord>,
    strings: AppStrings,
    isBusy: Boolean,
    onBulkMarkPresent: () -> Unit,
    onQuickMark: (WorkerProfile, AttendanceStatus) -> Unit,
    onOpenEdit: (WorkerProfile, AttendanceRecord?) -> Unit,
    modifier: Modifier = Modifier
) {
    val dateRecords = remember(attendance, date) {
        attendance.filter { it.date == date }.associateBy { it.workerId }
    }
    val presentCount = workers.count { dateRecords[it.id]?.status == AttendanceStatus.PRESENT }
    val halfLeaveCount = workers.count {
        val st = dateRecords[it.id]?.status
        st == AttendanceStatus.HALF_DAY || st == AttendanceStatus.PAID_LEAVE
    }
    val absentCount = workers.count { dateRecords[it.id]?.status == AttendanceStatus.ABSENT }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { onDateChange(PayrollCalculator.shiftDateYmd(date, -1)) }) {
                        Icon(Icons.Default.ChevronLeft, contentDescription = "Prev")
                    }
                    Text(date, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    IconButton(onClick = { onDateChange(PayrollCalculator.shiftDateYmd(date, +1)) }) {
                        Icon(Icons.Default.ChevronRight, contentDescription = "Next")
                    }
                }
            }
        }

        if (sites.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = selectedSiteId.isBlank(),
                        onClick = { onSiteSelect("") },
                        label = { Text("All Sites (${workers.size})") }
                    )
                    sites.forEach { site ->
                        FilterChip(
                            selected = selectedSiteId == site.id,
                            onClick = { onSiteSelect(site.id) },
                            label = { Text(site.name) }
                        )
                    }
                }
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                KpiStatCard("Present", "$presentCount", MitraGreen, modifier = Modifier.weight(1f))
                KpiStatCard("Half/Leave", "$halfLeaveCount", MitraAmber, modifier = Modifier.weight(1f))
                KpiStatCard("Absent", "$absentCount", MitraRed, modifier = Modifier.weight(1f))
            }
        }

        if (workers.isNotEmpty()) {
            item {
                Button(
                    onClick = onBulkMarkPresent,
                    enabled = !isBusy,
                    colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(strings.markAllPresent, fontWeight = FontWeight.Bold)
                }
            }
        }

        if (workers.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(strings.noDataTitle, modifier = Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            items(workers, key = { it.id }) { worker ->
                val rec = dateRecords[worker.id]
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            WorkerAvatar(name = worker.name, photoUrl = worker.photoUrl, size = 42.dp)
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(worker.name, fontWeight = FontWeight.Bold)
                                Text(
                                    "${worker.uniqueWorkerId} • ${worker.siteName.ifBlank { worker.skillRole }}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            if (rec != null) {
                                AttendanceStatusChip(rec.status, compact = true)
                            }
                        }

                        if (rec == null) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                AttendanceQuickButton("P", MitraGreen, Modifier.weight(1f), !isBusy) {
                                    onQuickMark(worker, AttendanceStatus.PRESENT)
                                }
                                AttendanceQuickButton("H", MitraAmber, Modifier.weight(1f), !isBusy) {
                                    onQuickMark(worker, AttendanceStatus.HALF_DAY)
                                }
                                AttendanceQuickButton("L", MitraBlue, Modifier.weight(1f), !isBusy) {
                                    onQuickMark(worker, AttendanceStatus.PAID_LEAVE)
                                }
                                AttendanceQuickButton("A", MitraRed, Modifier.weight(1f), !isBusy) {
                                    onQuickMark(worker, AttendanceStatus.ABSENT)
                                }
                                OutlinedButton(
                                    onClick = { onOpenEdit(worker, null) },
                                    contentPadding = PaddingValues(horizontal = 8.dp)
                                ) {
                                    Text("+OT")
                                }
                            }
                        } else {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Hours: ${rec.hoursWorked}h • OT: ${rec.overtimeHours}h${if (rec.gpsVerified) " • GPS✓" else ""}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                TextButton(onClick = { onOpenEdit(worker, rec) }) {
                                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(4.dp))
                                    Text("Edit / +OT")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AttendanceQuickButton(
    label: String,
    color: Color,
    modifier: Modifier,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        colors = ButtonDefaults.buttonColors(containerColor = color),
        contentPadding = PaddingValues(vertical = 6.dp),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
    ) {
        Text(label, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun OwnerWorkersTab(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    workers: List<WorkerProfile>,
    attendance: List<AttendanceRecord>,
    transactions: List<com.majdoor.mitra.model.FinancialTransaction>,
    strings: AppStrings,
    onAddWorker: () -> Unit,
    onEditWorker: (WorkerProfile) -> Unit,
    onInspectWorker: (WorkerProfile) -> Unit,
    onQuickPay: (WorkerProfile) -> Unit,
    onDeleteWorker: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val ym = PayrollCalculator.currentYm()
    val filtered = remember(workers, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) workers
        else workers.filter {
            it.name.lowercase().contains(q) ||
                it.uniqueWorkerId.lowercase().contains(q) ||
                it.mobile.contains(q) ||
                it.skillRole.lowercase().contains(q)
        }
    }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 84.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = onSearchChange,
                placeholder = { Text(strings.searchWorkersHint) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (filtered.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(strings.noDataTitle, fontWeight = FontWeight.Bold)
                        Button(onClick = onAddWorker, colors = ButtonDefaults.buttonColors(containerColor = MitraOrange)) {
                            Text(strings.addWorker)
                        }
                    }
                }
            }
        } else {
            items(filtered, key = { it.id }) { worker ->
                val sal = PayrollCalculator.recomputeSalary(worker, ym, attendance, transactions)
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onInspectWorker(worker) }
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            WorkerAvatar(name = worker.name, photoUrl = worker.photoUrl, size = 46.dp)
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(worker.name, fontWeight = FontWeight.Bold)
                                Text(
                                    "${worker.uniqueWorkerId} • ${worker.skillRole} • ${worker.mobile}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MitraBlue
                                )
                                Text(
                                    "${worker.siteName.ifBlank { "-" }} • Wage: ${PayrollCalculator.formatInr(sal.effectiveDailyWage)}/d",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("Due", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text(
                                    PayrollCalculator.formatInr(sal.remainingBalance),
                                    fontWeight = FontWeight.Bold,
                                    color = MitraOrange
                                )
                            }
                        }
                        HorizontalDivider()
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            TextButton(onClick = { onInspectWorker(worker) }) { Text("Hisab / PDF") }
                            TextButton(onClick = { onQuickPay(worker) }) { Text(strings.recordPayment, color = MitraGreen) }
                            IconButton(onClick = { onEditWorker(worker) }) { Icon(Icons.Default.Edit, contentDescription = strings.editWorker, tint = MitraBlue) }
                            IconButton(onClick = { onDeleteWorker(worker.id) }) { Icon(Icons.Default.Delete, contentDescription = strings.delete, tint = MitraRed) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OwnerAccountsTab(
    workers: List<WorkerProfile>,
    attendance: List<AttendanceRecord>,
    transactions: List<com.majdoor.mitra.model.FinancialTransaction>,
    strings: AppStrings,
    onOpenTxModal: (TransactionCategory) -> Unit,
    modifier: Modifier = Modifier
) {
    val ym = PayrollCalculator.currentYm()
    var filterCat by remember { mutableStateOf<TransactionCategory?>(null) }
    val filteredTx = remember(transactions, filterCat) {
        if (filterCat == null) transactions else transactions.filter { it.category == filterCat }
    }

    val totalPending = remember(workers, attendance, transactions) {
        workers.sumOf { PayrollCalculator.recomputeSalary(it, ym, attendance, transactions).remainingBalance }
    }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            KpiStatCard(
                label = "${strings.remainingBalance} (${ym})",
                value = PayrollCalculator.formatInr(totalPending),
                accent = MitraOrange,
                subtext = "${transactions.size} Total Ledger Entries",
                modifier = Modifier.fillMaxWidth()
            )
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(onClick = { onOpenTxModal(TransactionCategory.PAYMENT) }, colors = ButtonDefaults.buttonColors(containerColor = MitraGreen)) {
                    Text(strings.recordPayment)
                }
                Button(onClick = { onOpenTxModal(TransactionCategory.ADVANCE) }, colors = ButtonDefaults.buttonColors(containerColor = MitraOrange)) {
                    Text(strings.recordAdvance)
                }
                Button(onClick = { onOpenTxModal(TransactionCategory.BONUS) }, colors = ButtonDefaults.buttonColors(containerColor = MitraBlue)) {
                    Text(strings.addBonus)
                }
                Button(onClick = { onOpenTxModal(TransactionCategory.DEDUCTION) }, colors = ButtonDefaults.buttonColors(containerColor = MitraRed)) {
                    Text(strings.addDeduction)
                }
                OutlinedButton(onClick = { onOpenTxModal(TransactionCategory.EXPENSE) }) {
                    Text(strings.siteExpense)
                }
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(selected = filterCat == null, onClick = { filterCat = null }, label = { Text("All") })
                TransactionCategory.entries.forEach { cat ->
                    FilterChip(selected = filterCat == cat, onClick = { filterCat = cat }, label = { Text(strings.categoryLabel(cat)) })
                }
            }
        }

        if (filteredTx.isEmpty()) {
            item {
                Card(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Text(strings.noDataTitle, modifier = Modifier.padding(20.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        } else {
            items(filteredTx, key = { it.id }) { tx ->
                TransactionItemCard(tx = tx, strings = strings)
            }
        }
    }
}

@Composable
private fun OwnerSitesAndReportsTab(
    workspace: AppWorkspaceData,
    strings: AppStrings,
    isBusy: Boolean,
    onAddSite: () -> Unit,
    onEditSite: (WorkSite) -> Unit,
    onDeleteSite: (String) -> Unit,
    onRespondLeave: (LeaveRequest, LeaveStatus, String) -> Unit,
    onPreviewWhatsApp: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var period by remember { mutableStateOf(ReportPeriod.MONTHLY) }
    val today = PayrollCalculator.todayYmd()
    val ym = PayrollCalculator.currentYm()

    val (startDate, endDate, periodLabel) = remember(period, today, ym) {
        when (period) {
            ReportPeriod.DAILY -> Triple(today, today, today)
            ReportPeriod.WEEKLY -> Triple(PayrollCalculator.shiftDateYmd(today, -6), today, "Last 7 Days")
            ReportPeriod.MONTHLY -> Triple("$ym-01", "$ym-${PayrollCalculator.daysInMonth(ym)}", ym)
        }
    }

    val rows = remember(workspace.workers, workspace.attendance, workspace.transactions, startDate, endDate, ym) {
        PayrollCalculator.buildReportRows(workspace.workers, workspace.attendance, workspace.transactions, startDate, endDate, ym)
    }
    val totalPayroll = rows.sumOf { it.totalSalary }
    val totalPaid = rows.sumOf { it.paidTotal }
    val totalAdvance = rows.sumOf { it.advanceTotal }
    val totalPending = rows.sumOf { it.remainingBalance }
    val orgName = workspace.employerOrg?.businessName?.ifBlank { workspace.account.name } ?: workspace.account.name

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = period == ReportPeriod.DAILY, onClick = { period = ReportPeriod.DAILY }, label = { Text(strings.daily) })
                FilterChip(selected = period == ReportPeriod.WEEKLY, onClick = { period = ReportPeriod.WEEKLY }, label = { Text(strings.weekly) })
                FilterChip(selected = period == ReportPeriod.MONTHLY, onClick = { period = ReportPeriod.MONTHLY }, label = { Text(strings.monthly) })
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiStatCard("Payroll ($periodLabel)", PayrollCalculator.formatInr(totalPayroll), MitraBlue, modifier = Modifier.weight(1f))
                KpiStatCard(strings.remainingBalance, PayrollCalculator.formatInr(totalPending), MitraOrange, modifier = Modifier.weight(1f))
            }
        }

        item {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        val file = ExportHelper.generateOwnerReportPdf(
                            context = context,
                            businessName = orgName,
                            periodTitle = periodLabel,
                            rows = rows,
                            totalPayroll = totalPayroll,
                            totalPaid = totalPaid,
                            totalAdvance = totalAdvance,
                            totalPending = totalPending
                        )
                        ExportHelper.openFile(context, ExportHelper.getShareUri(context, file), "application/pdf", "Export PDF")
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.PictureAsPdf, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("PDF", maxLines = 1)
                }
                Button(
                    onClick = {
                        val file = ExportHelper.generateOwnerReportExcel(
                            context = context,
                            businessName = orgName,
                            periodTitle = periodLabel,
                            rows = rows,
                            attendance = workspace.attendance,
                            transactions = workspace.transactions
                        )
                        ExportHelper.shareFile(context, ExportHelper.getShareUri(context, file), "application/vnd.ms-excel", strings.exportExcel)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MitraGreen),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.TableView, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Excel", maxLines = 1)
                }
                Button(
                    onClick = {
                        val msg = PayrollCalculator.formatOwnerReportWhatsAppMessage(
                            businessName = orgName,
                            periodLabel = periodLabel,
                            totalWorkers = rows.size,
                            totalPayroll = totalPayroll,
                            totalPaid = totalPaid,
                            totalAdvance = totalAdvance,
                            totalPending = totalPending,
                            lang = workspace.account.language
                        )
                        onPreviewWhatsApp(msg)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A)),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("WA", maxLines = 1)
                }
            }
        }

        // Pending Leave Requests
        val pendingLeaves = workspace.leaveRequests.filter { it.status == LeaveStatus.PENDING }
        if (pendingLeaves.isNotEmpty()) {
            item {
                Text(strings.pendingLeaves, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            items(pendingLeaves, key = { it.id }) { lv ->
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${lv.workerName} (${lv.uniqueWorkerId})", fontWeight = FontWeight.Bold)
                        Text("${lv.fromDate} → ${lv.toDate} • ${lv.reason}", style = MaterialTheme.typography.bodyMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { onRespondLeave(lv, LeaveStatus.APPROVED, "Approved") },
                                enabled = !isBusy,
                                colors = ButtonDefaults.buttonColors(containerColor = MitraGreen),
                                modifier = Modifier.weight(1f)
                            ) { Text(strings.approve) }
                            OutlinedButton(
                                onClick = { onRespondLeave(lv, LeaveStatus.REJECTED, "Site work urgent") },
                                enabled = !isBusy,
                                border = BorderStroke(1.dp, MitraRed),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MitraRed),
                                modifier = Modifier.weight(1f)
                            ) { Text(strings.reject) }
                        }
                    }
                }
            }
        }

        // Work Sites Management
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Work Sites (${workspace.workSites.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Button(onClick = onAddSite, colors = ButtonDefaults.buttonColors(containerColor = MitraOrange)) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(strings.addSite)
                }
            }
        }

        items(workspace.workSites, key = { it.id }) { site ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Domain, contentDescription = null, tint = MitraBlue)
                    Spacer(Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(site.name, fontWeight = FontWeight.Bold)
                        Text(site.location, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = if (site.latitude != null) "GPS: %.4f, %.4f (${site.radiusMeters.toInt()}m)".format(site.latitude, site.longitude)
                            else "No GPS geofence (${site.radiusMeters.toInt()}m)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MitraGreen
                        )
                    }
                    IconButton(onClick = { onEditSite(site) }) { Icon(Icons.Default.Edit, contentDescription = "Edit") }
                    IconButton(onClick = { onDeleteSite(site.id) }) { Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MitraRed) }
                }
            }
        }

        // Report Rows Summary
        item {
            Text("Worker Breakdown ($periodLabel)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        items(rows, key = { it.worker.id }) { row ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(12.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("${row.worker.name} (${row.worker.uniqueWorkerId})", fontWeight = FontWeight.Bold)
                        Text("${row.workingDays}d • OT ${row.overtimeHours}h • Adv ${PayrollCalculator.formatInr(row.advanceTotal)}", style = MaterialTheme.typography.labelSmall)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Sal ${PayrollCalculator.formatInr(row.totalSalary)}", style = MaterialTheme.typography.labelMedium, color = MitraBlue, fontWeight = FontWeight.Bold)
                        Text("Due ${PayrollCalculator.formatInr(row.remainingBalance)}", style = MaterialTheme.typography.bodyMedium, color = MitraOrange, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun OwnerSettingsAndAuditTab(
    workspace: AppWorkspaceData,
    strings: AppStrings,
    isBusy: Boolean,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onUpdateOrg: (String, String, String) -> Unit,
    onLaunchBackup: () -> Unit,
    onLaunchRestore: () -> Unit,
    modifier: Modifier = Modifier
) {
    var bizName by remember(workspace.employerOrg) { mutableStateOf(workspace.employerOrg?.businessName ?: "") }
    var ownerName by remember(workspace.employerOrg) { mutableStateOf(workspace.employerOrg?.ownerName ?: workspace.account.name) }
    var address by remember(workspace.employerOrg) { mutableStateOf(workspace.employerOrg?.address ?: "") }

    LazyColumn(
        modifier = modifier,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(14.dp)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(strings.businessName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(value = bizName, onValueChange = { bizName = it }, label = { Text(strings.businessName) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = ownerName, onValueChange = { ownerName = it }, label = { Text(strings.fullName) }, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(value = address, onValueChange = { address = it }, label = { Text(strings.addressOptional) }, modifier = Modifier.fillMaxWidth())
                    Button(
                        onClick = { onUpdateOrg(bizName, ownerName, address) },
                        enabled = !isBusy && bizName.isNotBlank() && ownerName.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.save, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(14.dp)) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(if (workspace.account.language == AppLanguage.HI) "भाषा: हिन्दी (Hindi)" else "Language: English", fontWeight = FontWeight.SemiBold)
                        OutlinedButton(onClick = onToggleLanguage) { Text("Switch / बदलें") }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(if (workspace.account.theme == AppThemeMode.DARK) "Theme: Dark Mode" else "Theme: Light Mode", fontWeight = FontWeight.SemiBold)
                        Switch(checked = workspace.account.theme == AppThemeMode.DARK, onCheckedChange = { onToggleTheme() })
                    }
                    HorizontalDivider()
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = onLaunchBackup,
                            colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Backup, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(strings.backupJson, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        OutlinedButton(
                            onClick = onLaunchRestore,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.Restore, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(strings.restoreJson, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }

        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.History, contentDescription = null, tint = MitraBlue)
                Spacer(Modifier.width(6.dp))
                Text("${strings.auditLogsTitle} (${workspace.auditLogs.size})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
        }
        items(workspace.auditLogs.take(30), key = { it.id }) { log ->
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), shape = RoundedCornerShape(10.dp)) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("${log.action} • ${log.actorName}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                    Text(log.summary, style = MaterialTheme.typography.bodySmall)
                    if (log.reason.isNotBlank()) {
                        Text("Reason: ${log.reason}", style = MaterialTheme.typography.labelSmall, color = MitraOrange)
                    }
                }
            }
        }
    }
}

@Composable
private fun WorkerFormDialog(
    existing: WorkerProfile?,
    sites: List<WorkSite>,
    strings: AppStrings,
    isBusy: Boolean,
    onDismiss: () -> Unit,
    onSave: (WorkerInput) -> Unit
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(existing?.name ?: "") }
    var mobile by remember { mutableStateOf(existing?.mobile ?: "") }
    var skillRole by remember { mutableStateOf(existing?.skillRole ?: "Mason / Helper") }
    var siteId by remember { mutableStateOf(existing?.siteId ?: sites.firstOrNull()?.id ?: "") }
    var wageType by remember { mutableStateOf(existing?.wageType ?: WageType.DAILY) }
    var dailyWage by remember { mutableStateOf(existing?.dailyWage?.takeIf { it > 0 }?.toInt()?.toString() ?: "700") }
    var monthlySalary by remember { mutableStateOf(existing?.monthlySalary?.takeIf { it > 0 }?.toInt()?.toString() ?: "18000") }
    var overtimeRate by remember { mutableStateOf(existing?.overtimeRate?.takeIf { it > 0 }?.toInt()?.toString() ?: "100") }
    var photoUrl by remember { mutableStateOf(existing?.photoUrl ?: "") }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            runCatching {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    val bmp = BitmapFactory.decodeStream(stream)
                    val scaled = Bitmap.createScaledBitmap(bmp, 160, 160, true)
                    val baos = ByteArrayOutputStream()
                    scaled.compress(Bitmap.CompressFormat.JPEG, 70, baos)
                    val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
                    photoUrl = "data:image/jpeg;base64,$b64"
                }
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) strings.addWorker else strings.editWorker, fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    WorkerAvatar(name = name.ifBlank { "W" }, photoUrl = photoUrl, size = 48.dp)
                    OutlinedButton(onClick = { photoPicker.launch("image/*") }) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(strings.pickPhoto)
                    }
                }
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text(strings.fullName) }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = mobile,
                    onValueChange = { v -> mobile = v.filter { it.isDigit() }.take(10) },
                    label = { Text("Mobile (10 digits)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(value = skillRole, onValueChange = { skillRole = it }, label = { Text("Trade / Skill") }, singleLine = true, modifier = Modifier.fillMaxWidth())

                if (sites.isNotEmpty()) {
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        sites.forEach { site ->
                            FilterChip(selected = siteId == site.id, onClick = { siteId = site.id }, label = { Text(site.name) })
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = wageType == WageType.DAILY, onClick = { wageType = WageType.DAILY }, label = { Text("Daily Wage") })
                    FilterChip(selected = wageType == WageType.MONTHLY, onClick = { wageType = WageType.MONTHLY }, label = { Text("Monthly Salary") })
                }

                if (wageType == WageType.DAILY) {
                    OutlinedTextField(
                        value = dailyWage,
                        onValueChange = { v -> dailyWage = v.filter { it.isDigit() } },
                        label = { Text(strings.dailyWageLabel) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    OutlinedTextField(
                        value = monthlySalary,
                        onValueChange = { v -> monthlySalary = v.filter { it.isDigit() } },
                        label = { Text(strings.monthlySalaryLabel) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                OutlinedTextField(
                    value = overtimeRate,
                    onValueChange = { v -> overtimeRate = v.filter { it.isDigit() } },
                    label = { Text(strings.overtimeRateLabel) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        WorkerInput(
                            name = name,
                            mobile = mobile,
                            skillRole = skillRole,
                            siteId = siteId,
                            wageType = wageType,
                            dailyWage = dailyWage.toDoubleOrNull() ?: 0.0,
                            monthlySalary = monthlySalary.toDoubleOrNull() ?: 0.0,
                            overtimeRate = overtimeRate.toDoubleOrNull() ?: 0.0,
                            photoUrl = photoUrl,
                            status = existing?.status ?: WorkerStatus.ACTIVE
                        )
                    )
                },
                enabled = !isBusy && name.isNotBlank() && mobile.length == 10
            ) {
                Text(strings.save)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } }
    )
}

@Composable
private fun AttendanceEditDialog(
    worker: WorkerProfile,
    date: String,
    existing: AttendanceRecord?,
    strings: AppStrings,
    isBusy: Boolean,
    onDismiss: () -> Unit,
    onSave: (AttendanceMarkInput) -> Unit
) {
    var status by remember { mutableStateOf(existing?.status ?: AttendanceStatus.PRESENT) }
    var hours by remember { mutableStateOf((existing?.hoursWorked ?: 8.0).toString()) }
    var otHours by remember { mutableStateOf((existing?.overtimeHours ?: 0.0).toString()) }
    var reason by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf(existing?.notes ?: "") }
    val requiresReason = existing != null

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${worker.name} ($date)", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    AttendanceStatus.entries.forEach { st ->
                        FilterChip(
                            selected = status == st,
                            onClick = {
                                status = st
                                hours = when (st) {
                                    AttendanceStatus.PRESENT, AttendanceStatus.PAID_LEAVE -> "8.0"
                                    AttendanceStatus.HALF_DAY -> "4.0"
                                    AttendanceStatus.ABSENT -> "0.0"
                                }
                            },
                            label = { Text(st.apiValue) }
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = hours,
                        onValueChange = { hours = it },
                        label = { Text("Hours") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = otHours,
                        onValueChange = { otHours = it },
                        label = { Text("Overtime (hrs)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text(if (requiresReason) strings.editReasonRequired else "Reason (optional)") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(value = notes, onValueChange = { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        AttendanceMarkInput(
                            workerId = worker.id,
                            date = date,
                            status = status,
                            hoursWorked = hours.toDoubleOrNull() ?: 8.0,
                            overtimeHours = otHours.toDoubleOrNull() ?: 0.0,
                            editReason = reason.trim(),
                            notes = notes.trim()
                        )
                    )
                },
                enabled = !isBusy && (!requiresReason || reason.isNotBlank())
            ) {
                Text(strings.save)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } }
    )
}

@Composable
private fun TransactionFormDialog(
    initialCategory: TransactionCategory,
    preselectedWorkerId: String,
    workers: List<WorkerProfile>,
    sites: List<WorkSite>,
    strings: AppStrings,
    isBusy: Boolean,
    onDismiss: () -> Unit,
    onSave: (TransactionInput) -> Unit
) {
    var category by remember { mutableStateOf(initialCategory) }
    var workerId by remember { mutableStateOf(preselectedWorkerId.ifBlank { workers.firstOrNull()?.id ?: "" }) }
    var siteId by remember { mutableStateOf(sites.firstOrNull()?.id ?: "") }
    var amount by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(PaymentMode.UPI) }
    var referenceNo by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(PayrollCalculator.todayYmd()) }
    var description by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.categoryLabel(category), fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TransactionCategory.entries.forEach { cat ->
                        FilterChip(selected = category == cat, onClick = { category = cat }, label = { Text(strings.categoryLabel(cat)) })
                    }
                }
                if (category != TransactionCategory.EXPENSE && workers.isNotEmpty()) {
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        workers.forEach { w ->
                            FilterChip(selected = workerId == w.id, onClick = { workerId = w.id }, label = { Text(w.name) })
                        }
                    }
                }
                OutlinedTextField(
                    value = amount,
                    onValueChange = { v -> amount = v.filter { it.isDigit() } },
                    label = { Text("Amount (₹)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    PaymentMode.entries.forEach { pm ->
                        FilterChip(selected = mode == pm, onClick = { mode = pm }, label = { Text(pm.apiValue) })
                    }
                }
                OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = referenceNo, onValueChange = { referenceNo = it }, label = { Text("Ref / Receipt No (optional)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text(strings.reasonLabel) }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            val amt = amount.toDoubleOrNull() ?: 0.0
            Button(
                onClick = {
                    onSave(
                        TransactionInput(
                            category = category,
                            workerId = if (category == TransactionCategory.EXPENSE) "" else workerId,
                            siteId = siteId,
                            amount = amt,
                            mode = mode,
                            referenceNo = referenceNo,
                            date = date,
                            description = description
                        )
                    )
                },
                enabled = !isBusy && amt > 0 && date.length == 10 && (category == TransactionCategory.EXPENSE || workerId.isNotBlank())
            ) {
                Text(strings.save)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } }
    )
}

@Composable
private fun WorkSiteFormDialog(
    existing: WorkSite?,
    strings: AppStrings,
    isBusy: Boolean,
    onShowMessage: (String) -> Unit,
    onDismiss: () -> Unit,
    onSave: (SiteInput) -> Unit
) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(existing?.name ?: "") }
    var location by remember { mutableStateOf(existing?.location ?: "") }
    var latitude by remember { mutableStateOf(existing?.latitude) }
    var longitude by remember { mutableStateOf(existing?.longitude) }
    var radius by remember { mutableStateOf((existing?.radiusMeters ?: 300.0).toInt().toString()) }

    @SuppressLint("MissingPermission")
    fun captureGps() {
        LocationServices.getFusedLocationProviderClient(context)
            .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { loc ->
                if (loc != null) {
                    latitude = loc.latitude
                    longitude = loc.longitude
                } else {
                    onShowMessage("Unable to fetch GPS coordinates.")
                }
            }
            .addOnFailureListener { onShowMessage(it.message ?: "GPS error") }
    }

    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
        if (perms[Manifest.permission.ACCESS_FINE_LOCATION] == true || perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            captureGps()
        } else {
            onShowMessage("Location permission denied.")
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.addSite, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Site Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = location, onValueChange = { location = it }, label = { Text("Address / Area") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = radius,
                    onValueChange = { v -> radius = v.filter { it.isDigit() } },
                    label = { Text("GPS Radius (meters, 50-50000)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedButton(
                    onClick = {
                        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                        if (granted) captureGps()
                        else permLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.MyLocation, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(strings.useCurrentGps)
                }
                if (latitude != null && longitude != null) {
                    Text(
                        text = "Captured: %.5f, %.5f".format(latitude, longitude),
                        color = MitraGreen,
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        SiteInput(
                            name = name,
                            location = location,
                            latitude = latitude,
                            longitude = longitude,
                            radiusMeters = (radius.toDoubleOrNull() ?: 300.0).coerceIn(50.0, 50000.0),
                            status = existing?.status ?: SiteStatus.ACTIVE
                        )
                    )
                },
                enabled = !isBusy && name.isNotBlank()
            ) {
                Text(strings.save)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(strings.cancel) } }
    )
}
