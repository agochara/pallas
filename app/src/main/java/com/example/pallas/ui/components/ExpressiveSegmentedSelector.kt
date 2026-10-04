package com.example.pallas.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Material 3 Expressive Segmented Range Selector matching Google Health Connect / Fitbit design.
 * Features:
 * - Fluid spring-based corner morphing: unselected squircle (12.dp) -> selected pill (24.dp).
 * - Saturated, high-contrast M3 Expressive tonal color transitions.
 * - Tactile spring-physics bounce interaction on touch.
 */
@Composable
fun <T> ExpressiveSegmentedSelector(
    items: List<T>,
    selectedItem: T,
    onItemSelected: (T) -> Unit,
    label: (T) -> String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        items.forEach { item ->
            val isSelected = item == selectedItem

            // Organic M3 Expressive morph from rounded squircle (12.dp) to full pill capsule (24.dp)
            val cornerRadius by animateDpAsState(
                targetValue = if (isSelected) 24.dp else 12.dp,
                animationSpec = spring(
                    dampingRatio = 0.72f,
                    stiffness = 420f
                ),
                label = "SegmentCornerMorph"
            )

            val containerColor by animateColorAsState(
                targetValue = if (isSelected) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.surfaceContainerHigh
                },
                animationSpec = tween(durationMillis = 200),
                label = "SegmentContainerColor"
            )

            val contentColor by animateColorAsState(
                targetValue = if (isSelected) {
                    MaterialTheme.colorScheme.onPrimary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
                animationSpec = tween(durationMillis = 200),
                label = "SegmentContentColor"
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(44.dp)
                    .clip(RoundedCornerShape(cornerRadius))
                    .background(containerColor)
                    .selectable(
                        selected = isSelected,
                        role = Role.RadioButton,
                        onClick = { onItemSelected(item) }
                    )
                    .bounceClick(scaleDown = 0.93f) {
                        onItemSelected(item)
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = label(item),
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 15.sp,
                        letterSpacing = 0.2.sp
                    ),
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = contentColor,
                    maxLines = 1
                )
            }
        }
    }
}
