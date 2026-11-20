package com.majdoor.mitra.ui

import android.app.Activity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.majdoor.mitra.data.AppWorkspaceData
import com.majdoor.mitra.data.DemoRepository
import com.majdoor.mitra.data.FirebaseRepository
import com.majdoor.mitra.data.MajdoorRepository
import com.majdoor.mitra.data.OtpSendResult
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AppThemeMode
import com.majdoor.mitra.model.UserAccount
import com.majdoor.mitra.model.UserRole
import com.majdoor.mitra.ui.screens.AuthScreen
import com.majdoor.mitra.ui.screens.OwnerDashboardScreen
import com.majdoor.mitra.ui.screens.WorkerDashboardScreen
import com.majdoor.mitra.ui.theme.MajdoorMitraTheme
import kotlinx.coroutines.launch

private object Routes {
    const val BOOT = "boot"
    const val AUTH = "auth"
    const val WORKER = "worker"
    const val OWNER = "owner"
}

@Composable
fun MajdoorMitraRoot(activity: Activity) {
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val firebaseRepo = remember { FirebaseRepository() }
    var activeRepo by remember { mutableStateOf<MajdoorRepository>(firebaseRepo) }

    var language by remember { mutableStateOf(AppLanguage.HI) }
    var themeMode by remember { mutableStateOf(AppThemeMode.LIGHT) }
    var isBusy by remember { mutableStateOf(false) }
    var verificationId by remember { mutableStateOf<String?>(null) }
    var authError by remember { mutableStateOf<String?>(null) }
    var workspace by remember { mutableStateOf<AppWorkspaceData?>(null) }

    fun showToast(msg: String) {
        scope.launch {
            snackbarHostState.showSnackbar(msg)
        }
    }

    suspend fun reloadWorkspace(repo: MajdoorRepository, account: UserAccount) {
        isBusy = true
        repo.loadWorkspace(account)
            .onSuccess { data ->
                workspace = data
                language = data.account.language
                themeMode = data.account.theme
                val target = if (data.account.role == UserRole.OWNER) Routes.OWNER else Routes.WORKER
                navController.navigate(target) {
                    popUpTo(0) { inclusive = true }
                }
            }
            .onFailure { err ->
                authError = err.message ?: "Failed to load workspace"
                showToast(authError!!)
            }
        isBusy = false
    }

    LaunchedEffect(Unit) {
        val current = firebaseRepo.getCurrentAccount()
        if (current != null) {
            reloadWorkspace(firebaseRepo, current)
        } else {
            navController.navigate(Routes.AUTH) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    fun toggleLanguage() {
        val next = if (language == AppLanguage.HI) AppLanguage.EN else AppLanguage.HI
        language = next
        val ws = workspace
        if (ws != null) {
            scope.launch {
                activeRepo.updatePreferences(ws.account, next, themeMode).onSuccess { updated ->
                    workspace = ws.copy(account = updated)
                }
            }
        }
    }

    fun toggleTheme() {
        val next = if (themeMode == AppThemeMode.LIGHT) AppThemeMode.DARK else AppThemeMode.LIGHT
        themeMode = next
        val ws = workspace
        if (ws != null) {
            scope.launch {
                activeRepo.updatePreferences(ws.account, language, next).onSuccess { updated ->
                    workspace = ws.copy(account = updated)
                }
            }
        }
    }

    MajdoorMitraTheme(darkTheme = themeMode == AppThemeMode.DARK) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                NavHost(navController = navController, startDestination = Routes.BOOT) {
                    composable(Routes.BOOT) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }

                    composable(Routes.AUTH) {
                        AuthScreen(
                            language = language,
                            themeMode = themeMode,
                            isBusy = isBusy,
                            verificationId = verificationId,
                            errorMessage = authError,
                            onToggleLanguage = ::toggleLanguage,
                            onToggleTheme = ::toggleTheme,
                            onSendOtp = { mobile, role, name, bizName, addr ->
                                scope.launch {
                                    isBusy = true
                                    authError = null
                                    when (val res = firebaseRepo.sendPhoneOtp(activity, mobile, role, name, bizName, addr, language, themeMode)) {
                                        is OtpSendResult.CodeSent -> {
                                            if (res.verificationId.startsWith("AUTO_VERIFIED:")) {
                                                firebaseRepo.verifyPhoneOtp(res.verificationId, "", mobile, role, name, bizName, addr, language, themeMode)
                                                    .onSuccess { acc ->
                                                        activeRepo = firebaseRepo
                                                        reloadWorkspace(firebaseRepo, acc)
                                                    }
                                                    .onFailure { authError = it.message }
                                            } else {
                                                verificationId = res.verificationId
                                            }
                                        }
                                        is OtpSendResult.AutoVerified -> {
                                            activeRepo = firebaseRepo
                                            reloadWorkspace(firebaseRepo, res.account)
                                        }
                                        is OtpSendResult.Error -> {
                                            authError = res.message
                                        }
                                    }
                                    isBusy = false
                                }
                            },
                            onVerifyOtp = { code, mobile, role, name, bizName, addr ->
                                val vid = verificationId ?: return@AuthScreen
                                scope.launch {
                                    isBusy = true
                                    authError = null
                                    firebaseRepo.verifyPhoneOtp(vid, code, mobile, role, name, bizName, addr, language, themeMode)
                                        .onSuccess { acc ->
                                            verificationId = null
                                            activeRepo = firebaseRepo
                                            reloadWorkspace(firebaseRepo, acc)
                                        }
                                        .onFailure { err ->
                                            authError = err.message ?: "Invalid OTP"
                                        }
                                    isBusy = false
                                }
                            },
                            onResetOtp = {
                                verificationId = null
                                authError = null
                            },
                            onEnterDemo = { demoRole ->
                                scope.launch {
                                    val demo = DemoRepository(demoRole)
                                    activeRepo = demo
                                    val acc = demo.getCurrentAccount()
                                    reloadWorkspace(demo, acc)
                                }
                            }
                        )
                    }

                    composable(Routes.WORKER) {
                        val ws = workspace
                        if (ws != null) {
                            WorkerDashboardScreen(
                                workspace = ws,
                                isDemo = activeRepo.isDemo,
                                isBusy = isBusy,
                                onToggleLanguage = ::toggleLanguage,
                                onToggleTheme = ::toggleTheme,
                                onSignOut = {
                                    scope.launch {
                                        activeRepo.signOut()
                                        activeRepo = firebaseRepo
                                        workspace = null
                                        verificationId = null
                                        navController.navigate(Routes.AUTH) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    }
                                },
                                onGpsCheckIn = { worker, lat, lng, verified ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.submitWorkerGpsCheckIn(
                                            account = ws.account,
                                            worker = worker,
                                            date = com.majdoor.mitra.model.PayrollCalculator.todayYmd(),
                                            gpsLat = lat,
                                            gpsLng = lng,
                                            gpsVerified = verified,
                                            allAttendance = ws.attendance,
                                            allTransactions = ws.transactions
                                        ).onSuccess {
                                            showToast("GPS Check-In recorded!")
                                            reloadWorkspace(activeRepo, ws.account)
                                        }.onFailure {
                                            showToast(it.message ?: "GPS check-in failed")
                                        }
                                        isBusy = false
                                    }
                                },
                                onSubmitLeave = { worker, from, to, reason ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.submitLeaveRequest(ws.account, worker, from, to, reason)
                                            .onSuccess {
                                                showToast("Leave request submitted.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Leave submit failed") }
                                        isBusy = false
                                    }
                                },
                                onMarkNotificationRead = { notifId ->
                                    scope.launch {
                                        activeRepo.markNotificationRead(notifId)
                                        reloadWorkspace(activeRepo, ws.account)
                                    }
                                },
                                onShowMessage = ::showToast
                            )
                        }
                    }

                    composable(Routes.OWNER) {
                        val ws = workspace
                        if (ws != null) {
                            OwnerDashboardScreen(
                                workspace = ws,
                                isDemo = activeRepo.isDemo,
                                isBusy = isBusy,
                                onToggleLanguage = ::toggleLanguage,
                                onToggleTheme = ::toggleTheme,
                                onSignOut = {
                                    scope.launch {
                                        activeRepo.signOut()
                                        activeRepo = firebaseRepo
                                        workspace = null
                                        verificationId = null
                                        navController.navigate(Routes.AUTH) {
                                            popUpTo(0) { inclusive = true }
                                        }
                                    }
                                },
                                onSaveWorker = { existing, input ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.upsertWorker(ws.account, ws.employerOrg, ws.workSites, existing, input)
                                            .onSuccess {
                                                showToast("Worker saved.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Save worker failed") }
                                        isBusy = false
                                    }
                                },
                                onDeleteWorker = { workerId ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.deleteWorker(ws.account, workerId)
                                            .onSuccess {
                                                showToast("Worker removed.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Delete failed") }
                                        isBusy = false
                                    }
                                },
                                onMarkAttendance = { worker, existing, input ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.markOrEditAttendance(ws.account, worker, existing, input, ws.attendance, ws.transactions)
                                            .onSuccess {
                                                showToast("Attendance saved.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Attendance update failed") }
                                        isBusy = false
                                    }
                                },
                                onBulkMarkPresent = { date, siteWorkers ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.bulkMarkPresent(ws.account, siteWorkers, date, ws.attendance, ws.transactions)
                                            .onSuccess { count ->
                                                showToast("Marked $count workers Present.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Bulk mark failed") }
                                        isBusy = false
                                    }
                                },
                                onRecordTransaction = { input ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.recordTransaction(ws.account, ws.workers, input, ws.attendance, ws.transactions)
                                            .onSuccess {
                                                showToast("Transaction recorded.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Transaction failed") }
                                        isBusy = false
                                    }
                                },
                                onSaveSite = { existingId, input ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.upsertWorkSite(ws.account, existingId, input)
                                            .onSuccess {
                                                showToast("Work site saved.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Save site failed") }
                                        isBusy = false
                                    }
                                },
                                onDeleteSite = { siteId ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.deleteWorkSite(ws.account, siteId)
                                            .onSuccess {
                                                showToast("Site deleted.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Delete site failed") }
                                        isBusy = false
                                    }
                                },
                                onRespondLeave = { leave, status, note ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.respondToLeave(ws.account, leave, status, note)
                                            .onSuccess {
                                                showToast("Leave updated: ${status.apiValue}")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Leave update failed") }
                                        isBusy = false
                                    }
                                },
                                onUpdateOrg = { biz, owner, addr ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.updateEmployerOrg(ws.account, biz, owner, addr)
                                            .onSuccess {
                                                showToast("Organization updated.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Org update failed") }
                                        isBusy = false
                                    }
                                },
                                onExportBackupJson = { com.majdoor.mitra.util.ExportHelper.buildBackupJson(ws) },
                                onRestoreBackupJson = { json ->
                                    scope.launch {
                                        isBusy = true
                                        activeRepo.importBackupJson(ws.account, json)
                                            .onSuccess { count ->
                                                showToast("Restored $count records.")
                                                reloadWorkspace(activeRepo, ws.account)
                                            }
                                            .onFailure { showToast(it.message ?: "Restore failed") }
                                        isBusy = false
                                    }
                                },
                                onShowMessage = ::showToast
                            )
                        }
                    }
                }
            }
        }
    }
}
