package com.example.pallas.ui.components

import android.graphics.Matrix
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.graphics.shapes.CornerRounding
import androidx.graphics.shapes.Morph
import androidx.graphics.shapes.RoundedPolygon
import androidx.graphics.shapes.circle
import androidx.graphics.shapes.star
import androidx.graphics.shapes.toPath

/**
 * Custom Compose Shape that morphs between two RoundedPolygons
 * according to the progress ratio (0f..1f).
 */
class MorphPolygonShape(
    private val morph: Morph,
    private val progress: Float
) : Shape {
    private val matrix = Matrix()

    override fun createOutline(
        size: Size,
        layoutDirection: LayoutDirection,
        density: Density
    ): Outline {
        matrix.reset()
        matrix.setScale(size.width / 2f, size.height / 2f)
        matrix.postTranslate(size.width / 2f, size.height / 2f)
        val androidPath = morph.toPath(progress)
        androidPath.transform(matrix)
        return Outline.Generic(androidPath.asComposePath())
    }
}

/**
 * Predefined Material 3 Expressive shapes for Pallas.
 */
object PallasExpressiveShapes {
    val Circle: RoundedPolygon by lazy {
        RoundedPolygon.circle()
    }

    val OctagramStar: RoundedPolygon by lazy {
        RoundedPolygon.star(
            numVerticesPerRadius = 8,
            innerRadius = 0.72f,
            rounding = CornerRounding(0.25f)
        )
    }

    val DodecagramSunburst: RoundedPolygon by lazy {
        RoundedPolygon.star(
            numVerticesPerRadius = 12,
            innerRadius = 0.82f,
            rounding = CornerRounding(0.18f)
        )
    }

    val HexagonPill: RoundedPolygon by lazy {
        RoundedPolygon.star(
            numVerticesPerRadius = 6,
            innerRadius = 0.88f,
            rounding = CornerRounding(0.35f)
        )
    }

    // Morph pairs
    val FastingMorph: Morph by lazy {
        Morph(Circle, DodecagramSunburst)
    }

    val HeroBadgeMorph: Morph by lazy {
        Morph(Circle, OctagramStar)
    }

    val HexMorph: Morph by lazy {
        Morph(Circle, HexagonPill)
    }
}

/**
 * Expressive morphing container badge that pulses between organic geometric shapes.
 */
@Composable
fun MorphingBadge(
    modifier: Modifier = Modifier,
    size: Dp = 64.dp,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer,
    isPulsing: Boolean = true,
    targetProgress: Float = 1f,
    content: @Composable () -> Unit = {}
) {
    val progress = remember { Animatable(0f) }

    LaunchedEffect(isPulsing, targetProgress) {
        if (isPulsing) {
            progress.animateTo(
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(2800, easing = FastOutSlowInEasing),
                    repeatMode = RepeatMode.Reverse
                )
            )
        } else {
            progress.animateTo(
                targetValue = targetProgress,
                animationSpec = spring(dampingRatio = 0.65f, stiffness = 300f)
            )
        }
    }

    val shape = remember(progress.value) {
        MorphPolygonShape(PallasExpressiveShapes.FastingMorph, progress.value)
    }

    Surface(
        modifier = modifier.size(size),
        shape = shape,
        color = containerColor,
        tonalElevation = 6.dp
    ) {
        Box(contentAlignment = Alignment.Center) {
            content()
        }
    }
}
