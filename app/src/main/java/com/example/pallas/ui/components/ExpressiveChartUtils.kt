package com.example.pallas.ui.components

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText

/**
 * Reusable Canvas utilities for drawing Material 3 Expressive compliant charts
 * with explicit dual axes, accessible contrast, smooth cubic curves, and gradient fills.
 */
object ExpressiveChartUtils {

    /**
     * Builds a smooth cubic Bezier curve through a series of points.
     */
    fun createSmoothPath(points: List<Offset>): Path {
        val path = Path()
        if (points.isEmpty()) return path
        path.moveTo(points[0].x, points[0].y)
        if (points.size == 1) return path

        for (i in 0 until points.size - 1) {
            val p0 = points[i]
            val p1 = points[i + 1]
            val midX = (p0.x + p1.x) / 2f
            // Smooth horizontal tangent cubic curve
            path.cubicTo(
                x1 = midX, y1 = p0.y,
                x2 = midX, y2 = p1.y,
                x3 = p1.x, y3 = p1.y
            )
        }
        return path
    }

    /**
     * Creates a closed area path from a smooth curve down to the baseline.
     */
    fun createClosedAreaPath(points: List<Offset>, baselineY: Float): Path {
        val path = createSmoothPath(points)
        if (points.size >= 2) {
            path.lineTo(points.last().x, baselineY)
            path.lineTo(points.first().x, baselineY)
            path.close()
        }
        return path
    }

    /**
     * Draws horizontal Y-axis dotted gridlines and text labels.
     * Returns the maximum width of the rendered Y-axis labels for overlap prevention.
     */
    fun DrawScope.drawYAxis(
        minVal: Double,
        maxVal: Double,
        divisions: Int,
        chartLeft: Float,
        chartRight: Float,
        chartTop: Float,
        chartBottom: Float,
        gridColor: Color,
        labelColor: Color,
        textMeasurer: TextMeasurer,
        labelStyle: TextStyle,
        labelFormatter: (Double) -> String
    ): Float {
        val range = (maxVal - minVal).coerceAtLeast(0.001)
        val height = chartBottom - chartTop
        var maxLabelWidth = 0f

        for (i in 0..divisions) {
            val ratio = i.toFloat() / divisions
            val y = chartBottom - (ratio * height)
            val value = minVal + (ratio * range)
            val labelText = labelFormatter(value)

            // Dotted grid line
            drawLine(
                color = gridColor,
                start = Offset(chartLeft, y),
                end = Offset(chartRight, y),
                strokeWidth = 1f,
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)
            )

            // Draw Y-axis tick label
            val textLayout = textMeasurer.measure(text = labelText, style = labelStyle)
            if (textLayout.size.width > maxLabelWidth) {
                maxLabelWidth = textLayout.size.width.toFloat()
            }
            val textX = (chartLeft - textLayout.size.width - 8f).coerceAtLeast(0f)
            val textY = y - (textLayout.size.height / 2f)
            drawText(
                textLayoutResult = textLayout,
                topLeft = Offset(textX, textY),
                color = labelColor
            )
        }
        return maxLabelWidth
    }

    /**
     * Draws X-axis date / category labels along the bottom baseline.
     * Enforces a minimum left boundary so the first X-axis label never overlaps the Y-axis label,
     * and checks for inter-label collision so adjacent labels never overlap.
     */
    fun DrawScope.drawXAxisLabels(
        labelsWithX: List<Pair<String, Float>>,
        baselineY: Float,
        labelColor: Color,
        textMeasurer: TextMeasurer,
        labelStyle: TextStyle,
        minLeftGap: Float = 0f,
        minLabelSpacing: Float = 14f
    ) {
        var lastDrawnRight = minLeftGap
        labelsWithX.forEach { (text, centerX) ->
            val layout = textMeasurer.measure(text = text, style = labelStyle)
            val textWidth = layout.size.width.toFloat()
            var x = centerX - textWidth / 2f
            if (x < minLeftGap) {
                x = minLeftGap + 4f
            }
            // Only draw if there is clearance from the previous label to prevent collisions
            if (x >= lastDrawnRight + minLabelSpacing) {
                val y = baselineY + 6f
                drawText(
                    textLayoutResult = layout,
                    topLeft = Offset(x, y),
                    color = labelColor
                )
                lastDrawnRight = x + textWidth
            }
        }
    }
}
