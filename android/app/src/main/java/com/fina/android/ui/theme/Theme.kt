package com.fina.android.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val FinaColors = lightColorScheme(
    primary = Color(0xFF4F46E5), secondary = Color(0xFF0891B2),
    background = Color(0xFFF7F8FC), surface = Color.White,
    error = Color(0xFFDC2626)
)

@Composable fun FinaTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = FinaColors, typography = Typography(), content = content)
