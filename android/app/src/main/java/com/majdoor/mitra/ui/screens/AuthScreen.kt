package com.majdoor.mitra.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Engineering
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PhoneAndroid
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.majdoor.mitra.model.AppLanguage
import com.majdoor.mitra.model.AppThemeMode
import com.majdoor.mitra.model.UserRole
import com.majdoor.mitra.ui.theme.MitraBlue
import com.majdoor.mitra.ui.theme.MitraBlueDark
import com.majdoor.mitra.ui.theme.MitraBlueSoft
import com.majdoor.mitra.ui.theme.MitraOrange
import com.majdoor.mitra.ui.theme.MitraOrangeSoft
import com.majdoor.mitra.util.Strings

@Composable
fun AuthScreen(
    language: AppLanguage,
    themeMode: AppThemeMode,
    isBusy: Boolean,
    verificationId: String?,
    errorMessage: String?,
    onToggleLanguage: () -> Unit,
    onToggleTheme: () -> Unit,
    onSendOtp: (mobile10: String, role: UserRole, name: String, businessName: String, address: String) -> Unit,
    onVerifyOtp: (otpCode: String, mobile10: String, role: UserRole, name: String, businessName: String, address: String) -> Unit,
    onResetOtp: () -> Unit,
    onEnterDemo: (UserRole) -> Unit
) {
    val strings = Strings.of(language)
    var selectedRole by remember { mutableStateOf(UserRole.WORKER) }
    var mobile by remember { mutableStateOf("") }
    var fullName by remember { mutableStateOf("") }
    var businessName by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var otpCode by remember { mutableStateOf("") }

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
        ) {
            // Hero Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.linearGradient(listOf(MitraBlueDark, MitraBlue)))
                    .padding(horizontal = 20.dp, vertical = 22.dp)
            ) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(MitraOrange),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Engineering,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(26.dp)
                                )
                            }
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text(
                                    text = strings.appName,
                                    style = MaterialTheme.typography.headlineSmall,
                                    color = Color.White,
                                    fontWeight = FontWeight.ExtraBold
                                )
                                Text(
                                    text = strings.tagline,
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color(0xFFFFEDD5)
                                )
                            }
                        }
                        Row {
                            IconButton(onClick = onToggleLanguage) {
                                Icon(Icons.Default.Translate, contentDescription = "Language", tint = Color.White)
                            }
                            IconButton(onClick = onToggleTheme) {
                                Icon(
                                    imageVector = if (themeMode == AppThemeMode.DARK) Icons.Default.LightMode else Icons.Default.DarkMode,
                                    contentDescription = "Theme",
                                    tint = Color.White
                                )
                            }
                        }
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Role Selection Cards
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    RoleCard(
                        title = strings.workerRole,
                        subtitle = strings.workerRoleSub,
                        selected = selectedRole == UserRole.WORKER,
                        accent = MitraBlue,
                        icon = { Icon(Icons.Default.Build, contentDescription = null, tint = if (selectedRole == UserRole.WORKER) MitraBlue else MaterialTheme.colorScheme.onSurfaceVariant) },
                        modifier = Modifier.weight(1f),
                        onClick = { if (verificationId == null) selectedRole = UserRole.WORKER }
                    )
                    RoleCard(
                        title = strings.ownerRole,
                        subtitle = strings.ownerRoleSub,
                        selected = selectedRole == UserRole.OWNER,
                        accent = MitraOrange,
                        icon = { Icon(Icons.Default.Business, contentDescription = null, tint = if (selectedRole == UserRole.OWNER) MitraOrange else MaterialTheme.colorScheme.onSurfaceVariant) },
                        modifier = Modifier.weight(1f),
                        onClick = { if (verificationId == null) selectedRole = UserRole.OWNER }
                    )
                }

                // Auth Form Card
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Text(
                            text = if (verificationId == null) strings.enterMobileTitle else strings.verifyOtpTitle,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )

                        if (errorMessage != null) {
                            Surface(
                                color = MaterialTheme.colorScheme.error.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = errorMessage,
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }

                        if (verificationId == null) {
                            OutlinedTextField(
                                value = mobile,
                                onValueChange = { input -> mobile = input.filter { it.isDigit() }.take(10) },
                                label = { Text(strings.mobileHint) },
                                leadingIcon = { Icon(Icons.Default.PhoneAndroid, contentDescription = null) },
                                prefix = { Text("+91 ", fontWeight = FontWeight.Bold) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            OutlinedTextField(
                                value = fullName,
                                onValueChange = { fullName = it },
                                label = { Text(strings.fullName) },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            if (selectedRole == UserRole.OWNER) {
                                OutlinedTextField(
                                    value = businessName,
                                    onValueChange = { businessName = it },
                                    label = { Text(strings.businessName) },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = address,
                                    onValueChange = { address = it },
                                    label = { Text(strings.addressOptional) },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }

                            Button(
                                onClick = { onSendOtp(mobile, selectedRole, fullName, businessName, address) },
                                enabled = !isBusy && mobile.length == 10,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (selectedRole == UserRole.OWNER) MitraOrange else MitraBlue
                                ),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp)
                            ) {
                                if (isBusy) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text(strings.sendingOtp)
                                } else {
                                    Text(strings.sendOtp, fontWeight = FontWeight.Bold)
                                }
                            }
                        } else {
                            Surface(
                                color = MitraBlueSoft,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "OTP sent to +91 $mobile",
                                    color = MitraBlueDark,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }

                            OutlinedTextField(
                                value = otpCode,
                                onValueChange = { input -> otpCode = input.filter { it.isDigit() }.take(6) },
                                label = { Text(strings.enterOtpHint) },
                                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )

                            Button(
                                onClick = { onVerifyOtp(otpCode, mobile, selectedRole, fullName, businessName, address) },
                                enabled = !isBusy && otpCode.length == 6,
                                colors = ButtonDefaults.buttonColors(containerColor = MitraBlue),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(50.dp)
                            ) {
                                if (isBusy) {
                                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text(strings.verifying)
                                } else {
                                    Text(strings.verifyAndContinue, fontWeight = FontWeight.Bold)
                                }
                            }

                            TextButton(
                                onClick = onResetOtp,
                                enabled = !isBusy,
                                modifier = Modifier.align(Alignment.CenterHorizontally)
                            ) {
                                Text(strings.resendOrChange)
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = strings.firebaseNote,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }

                // Instant Demo Mode Preview
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = strings.demoBannerTitle,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = MitraOrange
                        )
                        HorizontalDivider()
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                onClick = { onEnterDemo(UserRole.OWNER) },
                                border = BorderStroke(1.5.dp, MitraOrange),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MitraOrange),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(strings.tryOwnerDemo, fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(
                                onClick = { onEnterDemo(UserRole.WORKER) },
                                border = BorderStroke(1.5.dp, MitraBlue),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MitraBlue),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(strings.tryWorkerDemo, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun RoleCard(
    title: String,
    subtitle: String,
    selected: Boolean,
    accent: Color,
    icon: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (selected) accent.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) accent else MaterialTheme.colorScheme.outline),
        modifier = modifier.clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                icon()
                Spacer(Modifier.width(8.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = if (selected) accent else MaterialTheme.colorScheme.onSurface
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                minLines = 2
            )
        }
    }
}
