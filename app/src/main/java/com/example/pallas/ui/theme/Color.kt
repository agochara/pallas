package com.example.pallas.ui.theme

import androidx.compose.ui.graphics.Color

// Material 3 Expressive Light Color Palette (High-Chroma Expressive Tonal Surfaces)
val LightPrimary = Color(0xFF005691)
val LightOnPrimary = Color(0xFFFFFFFF)
val LightPrimaryContainer = Color(0xFFA6D0FF) // High-chroma saturated expressive blue
val LightOnPrimaryContainer = Color(0xFF001D36)

val LightSecondary = Color(0xFF1E6C38)
val LightOnSecondary = Color(0xFFFFFFFF)
val LightSecondaryContainer = Color(0xFFA6F2BA) // Saturated expressive mint-green
val LightOnSecondaryContainer = Color(0xFF00210B)

val LightTertiary = Color(0xFF823A63)
val LightOnTertiary = Color(0xFFFFFFFF)
val LightTertiaryContainer = Color(0xFFFFD7E8) // Saturated expressive coral-rose
val LightOnTertiaryContainer = Color(0xFF350024)

val LightError = Color(0xFFBA1A1A)
val LightOnError = Color(0xFFFFFFFF)
val LightErrorContainer = Color(0xFFFFDAD6)
val LightOnErrorContainer = Color(0xFF410002)

val LightBackground = Color(0xFFF8F9FE)
val LightOnBackground = Color(0xFF191C20)
val LightSurface = Color(0xFFF8F9FE)
val LightOnSurface = Color(0xFF191C20)
val LightSurfaceVariant = Color(0xFFDFE3EB)
val LightOnSurfaceVariant = Color(0xFF42474E)
val LightOutline = Color(0xFF72777F)
val LightOutlineVariant = Color(0xFFC2C7CF)

val LightSurfaceContainerLowest = Color(0xFFFFFFFF)
val LightSurfaceContainerLow = Color(0xFFF2F4F9)
val LightSurfaceContainer = Color(0xFFEBEEF4)
val LightSurfaceContainerHigh = Color(0xFFE4E8EE)
val LightSurfaceContainerHighest = Color(0xFFDEE2E8)

// Material 3 Expressive Dark Color Palette
val DarkPrimary = Color(0xFF88C5FF)
val DarkOnPrimary = Color(0xFF003053)
val DarkPrimaryContainer = Color(0xFF004477)
val DarkOnPrimaryContainer = Color(0xFFCEE5FF)

val DarkSecondary = Color(0xFF8BD59F)
val DarkOnSecondary = Color(0xFF003916)
val DarkSecondaryContainer = Color(0xFF005224)
val DarkOnSecondaryContainer = Color(0xFFA6F2BA)

val DarkTertiary = Color(0xFFF3AFDC)
val DarkOnTertiary = Color(0xFF4E0B35)
val DarkTertiaryContainer = Color(0xFF67234B)
val DarkOnTertiaryContainer = Color(0xFFFFD7E8)

val DarkError = Color(0xFFFFB4AB)
val DarkOnError = Color(0xFF690005)
val DarkErrorContainer = Color(0xFF93000A)
val DarkOnErrorContainer = Color(0xFFFFDAD6)

val DarkBackground = Color(0xFF111418)
val DarkOnBackground = Color(0xFFE1E2E8)
val DarkSurface = Color(0xFF111418)
val DarkOnSurface = Color(0xFFE1E2E8)
val DarkSurfaceVariant = Color(0xFF42474E)
val DarkOnSurfaceVariant = Color(0xFFC2C7CF)
val DarkOutline = Color(0xFF8C9199)
val DarkOutlineVariant = Color(0xFF42474E)

val DarkSurfaceContainerLowest = Color(0xFF0B0E12)
val DarkSurfaceContainerLow = Color(0xFF181C20)
val DarkSurfaceContainer = Color(0xFF1C2024)
val DarkSurfaceContainerHigh = Color(0xFF272A2F)
val DarkSurfaceContainerHighest = Color(0xFF31353A)

// Dedicated Vade Mecum Parchment & Ink Palette
object VadePalette {
    data class Colors(
        val background: Color,
        val text: Color,
        val textSecondary: Color,
        val separator: Color,
        val accent: Color,
        val highlight: Color,
        val highlightActive: Color
    )

    val Light = Colors(
        background = Color(0xFFF3EBDD),
        text = Color(0xFF29251F),
        textSecondary = Color(0xFF756E62),
        separator = Color(0xFFD8CFBF),
        accent = Color(0xFF5E5244),
        highlight = Color(0xFFE7D7A8),
        highlightActive = Color(0xFFD8BE72)
    )

    val Dark = Colors(
        background = Color(0xFF211F1B),
        text = Color(0xFFE8E0D2),
        textSecondary = Color(0xFF9D9588),
        separator = Color(0xFF3B3730),
        accent = Color(0xFFC4B59D),
        highlight = Color(0xFF4A4230),
        highlightActive = Color(0xFF6E5C33)
    )
}