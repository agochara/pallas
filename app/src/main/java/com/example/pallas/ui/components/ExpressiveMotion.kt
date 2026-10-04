package com.example.pallas.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.launch

/**
 * Material 3 Expressive press-scale modifier.
 * Provides organic spring-physics scale feedback on press without overriding
 * component onClick handlers, ripples, or accessibility semantics.
 */
fun Modifier.pressScale(
    scaleDown: Float = 0.95f
): Modifier = composed {
    val scale = remember { Animatable(1f) }
    val scope = rememberCoroutineScope()

    this
        .scale(scale.value)
        .pointerInput(Unit) {
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed = false)
                scope.launch {
                    scale.animateTo(
                        scaleDown,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessMedium
                        )
                    )
                }
                do {
                    val event = awaitPointerEvent()
                } while (event.changes.any { it.pressed })

                scope.launch {
                    scale.animateTo(
                        1f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessMedium
                        )
                    )
                }
            }
        }
}

/**
 * Backward-compatible bounce click modifier.
 */
fun Modifier.bounceClick(
    scaleDown: Float = 0.94f,
    onClick: (() -> Unit)? = null
): Modifier = if (onClick != null) {
    this.pressScale(scaleDown).clickable(onClick = onClick)
} else {
    this.pressScale(scaleDown)
}

/**
 * Continuous pointer gesture detector supporting immediate tap inspection and
 * horizontal drag scrubbing across chart canvases without blocking vertical page scrolling.
 */
fun Modifier.chartDragScrubber(
    onPositionChanged: (offset: Offset, totalWidth: Float) -> Unit
): Modifier = this
    .pointerInput(Unit) {
        detectTapGestures { offset ->
            onPositionChanged(offset, size.width.toFloat())
        }
    }
    .pointerInput(Unit) {
        detectHorizontalDragGestures(
            onDragStart = { offset ->
                onPositionChanged(offset, size.width.toFloat())
            },
            onHorizontalDrag = { change, _ ->
                onPositionChanged(change.position, size.width.toFloat())
                change.consume()
            }
        )
    }
