package com.majdoor.mitra.ui.components

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AppThemeMode
import com.majdoor.mitra.model.AttendanceStatus
import com.majdoor.mitra.model.FinancialTransaction
import com.majdoor.mitra.model.PayrollCalculator
import com.majdoor.mitra.model.SalarySummary
import com.majdoor.mitra.model.TransactionCategory
import com.majdoor.mitra.ui.theme.MitraAmber
import com.majdoor.mitra.ui.theme.MitraAmberSoft
import com.majdoor.mitra.ui.theme.MitraBlue
import com.majdoor.mitra.ui.theme.MitraBlueSoft
import com.majdoor.mitra.ui.theme.MitraGreen
import com.majdoor.mitra.ui.theme.MitraGreenSoft
import com.majdoor.mitra.ui.theme.MitraOrange
import com.majdoor.mitra.ui.theme.MitraOrangeSoft
import com.majdoor.mitra.ui.theme.MitraRed
import com.majdoor.mitra.ui.theme.MitraRedSoft
import com.majdoor.mitra.util.AppStrings

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MitraTopAppBar(
    title: String,
    subtitle: String,
    isDemo: Boolean,
    language: AppLanguage,
    themeMode: AppThemeMode,
    strings: AppStrings,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onSignOut: () -> Unit
) {
    TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MitraBlue,
            titleContentColor = Color.White,
            actionIconContentColor = Color.White
        ),
        title = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        color = if (isDemo) MitraOrange else Color(0xFF16A34A),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = if (isDemo) strings.demoBadge else strings.liveBadge,
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
                if (subtitle.isNotBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelMedium,
                        color = Color(0xFFDBEAFE),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        },
        actions = {
            TextButton(onClick = onToggleLanguage) {
                Icon(Icons.Default.Translate, contentDescription = "Language", tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(
                    text = if (language == AppLanguage.HI) "EN" else "हिं",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
            IconButton(onClick = onToggleTheme) {
                Icon(
                    imageVector = if (themeMode == AppThemeMode.DARK) Icons.Default.LightMode else Icons.Default.DarkMode,
                    contentDescription = "Theme"
                )
            }
            IconButton(onClick = onSignOut) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = strings.logout)
            }
        }
    )
}

@Composable
fun KpiStatCard(
    label: String,
    value: String,
    accent: Color,
    modifier: Modifier = Modifier,
    subtext: String? = null
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = accent,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (!subtext.isNullOrBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subtext,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun WorkerAvatar(
    name: String,
    photoUrl: String,
    size: Dp = 44.dp
) {
    val bitmap = remember(photoUrl) {
        if (photoUrl.startsWith("data:image") && photoUrl.contains(",")) {
            runCatching {
                val b64 = photoUrl.substringAfter(",")
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
            }.getOrNull()
        } else null
    }
    if (bitmap != null) {
        Image(
            bitmap = bitmap,
            contentDescription = name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .border(1.5.dp, MitraBlue, CircleShape)
        )
    } else {
        val initials = name.trim().split(" ").filter { it.isNotBlank() }.take(2)
            .joinToString("") { it.first().uppercaseChar().toString() }.ifBlank { "M" }
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(size)
                .clip(CircleShape)
                .background(MitraBlueSoft)
                .border(1.5.dp, MitraBlue, CircleShape)
        ) {
            Text(
                text = initials,
                color = MitraBlue,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.titleMedium
            )
        }
    }
}

@Composable
fun AttendanceStatusChip(
    status: AttendanceStatus,
    compact: Boolean = false,
    onClick: (() -> Unit)? = null
) {
    val (bg, fg, label) = when (status) {
        AttendanceStatus.PRESENT -> Triple(MitraGreenSoft, MitraGreen, if (compact) "P" else "Present (P)")
        AttendanceStatus.HALF_DAY -> Triple(MitraAmberSoft, MitraAmber, if (compact) "H" else "Half Day (H)")
        AttendanceStatus.PAID_LEAVE -> Triple(MitraBlueSoft, MitraBlue, if (compact) "L" else "Paid Leave (L)")
        AttendanceStatus.ABSENT -> Triple(MitraRedSoft, MitraRed, if (compact) "A" else "Absent (A)")
    }
    Surface(
        color = bg,
        shape = RoundedCornerShape(8.dp),
        modifier = if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier
    ) {
        Text(
            text = label,
            color = fg,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = if (compact) 10.dp else 10.dp, vertical = 5.dp)
        )
    }
}

@Composable
fun SalaryFormulaCard(
    salary: SalarySummary,
    overtimeRate: Double,
    strings: AppStrings
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = strings.formulaLine,
                style = MaterialTheme.typography.labelMedium,
                color = MitraBlue,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(10.dp))
            FormulaRow(
                "${strings.attendanceEarnings} (${salary.totalWorkingDays}d × ${PayrollCalculator.formatInr(salary.effectiveDailyWage)})",
                PayrollCalculator.formatInr(salary.attendanceEarnings)
            )
            FormulaRow(
                "${strings.overtimeEarnings} (${salary.overtimeHours}h × ${PayrollCalculator.formatInr(overtimeRate)})",
                "+${PayrollCalculator.formatInr(salary.overtimeEarnings)}",
                MitraGreen
            )
            FormulaRow(
                strings.bonusLabel,
                "+${PayrollCalculator.formatInr(salary.bonusTotal)}",
                MitraGreen
            )
            FormulaRow(
                strings.deductionLabel,
                "-${PayrollCalculator.formatInr(salary.deductionTotal)}",
                MitraRed
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            FormulaRow(
                strings.totalSalary,
                PayrollCalculator.formatInr(salary.totalSalary),
                MaterialTheme.colorScheme.primary,
                bold = true
            )
            Spacer(Modifier.height(6.dp))
            FormulaRow(
                strings.advancesLabel,
                "-${PayrollCalculator.formatInr(salary.advanceTotal)}",
                MitraOrange
            )
            FormulaRow(
                strings.paidLabel,
                "-${PayrollCalculator.formatInr(salary.paidTotal)}",
                MitraGreen
            )
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            FormulaRow(
                strings.remainingBalance,
                PayrollCalculator.formatInr(salary.remainingBalance),
                if (salary.remainingBalance >= 0) MitraOrange else MitraRed,
                bold = true
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = strings.remainingFormulaLine,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FormulaRow(
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface,
    bold: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal,
            color = if (bold) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold,
            color = valueColor
        )
    }
}

@Composable
fun TransactionItemCard(
    tx: FinancialTransaction,
    strings: AppStrings
) {
    val (bg, fg) = when (tx.category) {
        TransactionCategory.PAYMENT -> MitraGreenSoft to MitraGreen
        TransactionCategory.ADVANCE -> MitraOrangeSoft to MitraOrange
        TransactionCategory.BONUS -> MitraBlueSoft to MitraBlue
        TransactionCategory.DEDUCTION -> MitraRedSoft to MitraRed
        TransactionCategory.EXPENSE -> MitraAmberSoft to MitraAmber
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
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(color = bg, shape = RoundedCornerShape(8.dp)) {
                Text(
                    text = strings.categoryLabel(tx.category),
                    color = fg,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
            Spacer(Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tx.workerName.ifBlank { "Site Expense" },
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${tx.date} ${tx.time} • ${tx.mode.apiValue}${if (tx.description.isNotBlank()) " • ${tx.description}" else ""}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Spacer(Modifier.width(8.dp))
            Text(
                text = PayrollCalculator.formatInr(tx.amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = fg
            )
        }
    }
}

@Composable
fun WhatsAppPreviewDialog(
    title: String,
    message: String,
    strings: AppStrings,
    onShare: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = {
            Surface(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(12.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onShare,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A))
            ) {
                Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text(strings.shareWhatsApp)
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(strings.cancel)
            }
        }
    )
}
