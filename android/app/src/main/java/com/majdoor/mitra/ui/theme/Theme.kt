package com.majdoor.mitra.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val MitraBlue = Color(0xFF1D4ED8)
val MitraBlueDark = Color(0xFF1E3A8A)
val MitraBlueSoft = Color(0xFFDBEAFE)
val MitraOrange = Color(0xFFEA580C)
val MitraOrangeSoft = Color(0xFFFFEDD5)
val MitraGreen = Color(0xFF15803D)
val MitraGreenSoft = Color(0xFFDCFCE7)
val MitraRed = Color(0xFFDC2626)
val MitraRedSoft = Color(0xFFFEE2E2)
val MitraAmber = Color(0xFFD97706)
val MitraAmberSoft = Color(0xFFFEF3C7)

private val LightColors = lightColorScheme(
    primary = MitraBlue,
    onPrimary = Color.White,
    primaryContainer = MitraBlueSoft,
    onPrimaryContainer = Color(0xFF0F172A),
    secondary = MitraOrange,
    onSecondary = Color.White,
    secondaryContainer = MitraOrangeSoft,
    onSecondaryContainer = Color(0xFF7C2D12),
    background = Color(0xFFF1F5F9),
    onBackground = Color(0xFF0F172A),
    surface = Color.White,
    onSurface = Color(0xFF0F172A),
    surfaceVariant = Color(0xFFE2E8F0),
    onSurfaceVariant = Color(0xFF475569),
    outline = Color(0xFFCBD5E1),
    error = MitraRed,
    onError = Color.White
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF60A5FA),
    onPrimary = Color(0xFF0B1F4D),
    primaryContainer = Color(0xFF1E3A8A),
    onPrimaryContainer = Color(0xFFDBEAFE),
    secondary = Color(0xFFFB923C),
    onSecondary = Color(0xFF431407),
    secondaryContainer = Color(0xFF7C2D12),
    onSecondaryContainer = Color(0xFFFFEDD5),
    background = Color(0xFF0F172A),
    onBackground = Color(0xFFF8FAFC),
    surface = Color(0xFF1E293B),
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF334155),
    onSurfaceVariant = Color(0xFFCBD5E1),
    outline = Color(0xFF475569),
    error = Color(0xFFF87171),
    onError = Color(0xFF450A0A)
)

private val MitraTypography = Typography(
    headlineSmall = TextStyle(fontSize = 21.sp, fontWeight = FontWeight.Bold, lineHeight = 27.sp),
    titleLarge = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.Bold, lineHeight = 24.sp),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Normal, lineHeight = 21.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.SemiBold, lineHeight = 18.sp),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, lineHeight = 16.sp)
)

@Composable
fun MajdoorMitraTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = MitraTypography,
        content = content
    )
}
