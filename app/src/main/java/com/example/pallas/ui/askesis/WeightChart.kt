package com.example.pallas.ui.askesis

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.db.WeightEntry
import com.example.pallas.ui.components.chartDragScrubber
import com.example.pallas.util.DateFormats
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.roundToInt

// ---------------------------------------------------------------- data

/** day = whole days relative to a fixed base; a measurement is plotted at day + 0.5 (slot centre). */
private data class Pt(val id: Long, val day: Float, val weight: Double)
private data class XTick(val label: String, val t: Float, val leftAligned: Boolean = false)
private data class AxisSpec(val yTicks: List<Double>, val yStep: Double, val xTicks: List<XTick>)

private class Trend(
    val t: FloatArray,
    val w: FloatArray,
    val leftW: Float,
    val rightW: Float,
    val tFirst: Float,
    val tLast: Float
)

private class Series(val pts: List<Pt>) {
    val days = DoubleArray(pts.size) { pts[it].day + 0.5 }
    val vals = DoubleArray(pts.size) { pts[it].weight }

    /** Gaussian-kernel smoothing, weights taken relative to the nearest point so gaps never underflow. */
    fun trendAt(t: Double, bw: Double): Double {
        var minD2 = Double.MAX_VALUE
        for (d in days) {
            val dt = t - d
            val d2 = dt * dt
            if (d2 < minD2) minD2 = d2
        }
        val v2 = 2.0 * bw * bw
        var sw = 0.0
        var sy = 0.0
        for (i in days.indices) {
            val dt = t - days[i]
            val x = (dt * dt - minD2) / v2
            if (x > 30.0) continue
            val w = exp(-x)
            sw += w
            sy += w * vals[i]
        }
        return sy / sw
    }

    fun computeTrend(vs: Float, ve: Float, bw: Float): Trend? {
        if (pts.isEmpty()) return null
        val tFirst = days.first().toFloat()
        val tLast = days.last().toFloat()
        val bwd = bw.toDouble().coerceAtLeast(0.5)
        val leftW = trendAt(vs.toDouble().coerceIn(tFirst.toDouble(), tLast.toDouble()), bwd).toFloat()
        val rightW = trendAt(ve.toDouble().coerceIn(tFirst.toDouble(), tLast.toDouble()), bwd).toFloat()
        val from = maxOf(tFirst, vs)
        val to = minOf(tLast, ve)
        if (to - from < 1e-3f) return Trend(FloatArray(0), FloatArray(0), leftW, rightW, tFirst, tLast)
        val n = (((to - from) / (ve - vs)) * 220f).toInt().coerceIn(2, 220)
        val ts = FloatArray(n + 1) { from + (to - from) * it / n }
        val ws = FloatArray(n + 1) { trendAt(ts[it].toDouble(), bwd).toFloat() }
        return Trend(ts, ws, leftW, rightW, tFirst, tLast)
    }
}

private fun relDay(d: LocalDate, base: Long): Float = (d.toEpochDay() - base).toFloat()

// ---------------------------------------------------------------- axes

internal fun computeNiceYBounds(minVal: Double, maxVal: Double, targetSteps: Int = 4): Triple<Double, Double, Double> {
    val span = (maxVal - minVal).coerceAtLeast(1.0)
    val rawStep = span / targetSteps
    val magnitude = 10.0.pow(floor(log10(rawStep)))
    val normalized = rawStep / magnitude
    val niceStep = when {
        normalized <= 1.0 -> 1.0 * magnitude
        normalized <= 2.0 -> 2.0 * magnitude
        normalized <= 5.0 -> 5.0 * magnitude
        else -> 10.0 * magnitude
    }
    val niceMin = floor(minVal / niceStep) * niceStep
    var niceMax = ceil(maxVal / niceStep) * niceStep
    if (niceMax <= niceMin) niceMax = niceMin + niceStep * targetSteps
    return Triple(niceMin, niceMax, niceStep)
}

private fun formatKg(v: Double, step: Double): String = when {
    step >= 1.0 && step % 1.0 == 0.0 -> String.format(Locale.US, "%.0f kg", v)
    step >= 0.1 -> String.format(Locale.US, "%.1f kg", v)
    else -> String.format(Locale.US, "%.2f kg", v)
}

private fun buildXTicks(range: WeightTimeRange, start: LocalDate, end: LocalDate, base: Long): List<XTick> {
    val out = ArrayList<XTick>()
    when (range) {
        WeightTimeRange.W -> {
            var d = start
            while (!d.isAfter(end)) {
                out += XTick(d.dayOfWeek.name.take(1), relDay(d, base) + 0.5f)
                d = d.plusDays(1)
            }
        }
        WeightTimeRange.M -> {
            var d = end
            while (!d.isBefore(start)) {
                out += XTick(d.dayOfMonth.toString(), relDay(d, base) + 0.5f)
                d = d.minusDays(7)
            }
            out.reverse()
        }
        WeightTimeRange.THREE_M -> {
            var m = YearMonth.from(start)
            val last = YearMonth.from(end)
            while (!m.isAfter(last)) {
                val first = m.atDay(1)
                if (!first.isBefore(start)) {
                    out += XTick(DateFormats.SHORT_MONTH.format(first), relDay(first, base), leftAligned = true)
                }
                m = m.plusMonths(1)
            }
        }
        WeightTimeRange.Y -> {
            var m = YearMonth.from(start)
            val last = YearMonth.from(end)
            while (!m.isAfter(last)) {
                val a = m.atDay(1).let { if (it.isBefore(start)) start else it }
                val b = m.atEndOfMonth().let { if (it.isAfter(end)) end else it }
                out += XTick(m.month.name.take(1), (relDay(a, base) + relDay(b, base) + 1f) / 2f)
                m = m.plusMonths(1)
            }
        }
    }
    return out
}

// ---------------------------------------------------------------- chart

@Composable
fun WeightChart(
    weights: List<WeightEntry>,
    range: WeightTimeRange,
    windowStart: LocalDate,
    windowEnd: LocalDate,
    selectedId: Long?,
    onSelect: (Long?) -> Unit,
    modifier: Modifier = Modifier,
    description: String = "Weight chart",
    yLabelsOnRight: Boolean = false
) {
    val density = LocalDensity.current
    val baseEpoch = remember { LocalDate.now().toEpochDay() }

    val series = remember(weights) {
        Series(
            weights.mapNotNull { e ->
                runCatching { LocalDate.parse(e.date) }.getOrNull()
                    ?.let { Pt(e.id, relDay(it, baseEpoch), e.weight) }
            }.sortedBy { it.day }
        )
    }

    // ---- targets for the current window
    val tvs = relDay(windowStart, baseEpoch)
    val tve = relDay(windowEnd, baseEpoch) + 1f
    val bwTarget = when (range) {
        WeightTimeRange.W -> 1.5f
        WeightTimeRange.M -> 3.5f
        WeightTimeRange.THREE_M -> 8f
        WeightTimeRange.Y -> 20f
    }

    val yBounds = remember(series, tvs, tve) {
        val src = ArrayList<Double>()
        var pre: Pt? = null
        var post: Pt? = null
        for (p in series.pts) {
            val t = p.day + 0.5f
            if (t < tvs) pre = p
            else if (t > tve) { if (post == null) post = p }
            else src += p.weight
        }
        pre?.let { src += it.weight }
        post?.let { src += it.weight }
        if (src.isEmpty()) series.pts.forEach { src += it.weight }
        if (src.isEmpty()) Triple(60.0, 90.0, 10.0)
        else {
            val lo = src.min()
            val hi = src.max()
            val pad = ((hi - lo) * 0.06).coerceAtLeast(0.2)
            computeNiceYBounds(lo - pad, hi + pad, 4)
        }
    }

    val targetAxis = remember(yBounds, range, windowStart, windowEnd) {
        val (lo, hi, step) = yBounds
        val n = ((hi - lo) / step).roundToInt().coerceIn(1, 10)
        AxisSpec(List(n + 1) { lo + it * step }, step, buildXTicks(range, windowStart, windowEnd, baseEpoch))
    }

    val inWindowCount = remember(series, tvs, tve) { series.pts.count { it.day + 0.5f in tvs..tve } }

    // ---- animated viewport (this is the zoom / rescale)
    val vS = remember { Animatable(tvs) }
    val vE = remember { Animatable(tve) }
    val yLo = remember { Animatable(yBounds.first.toFloat()) }
    val yHi = remember { Animatable(yBounds.second.toFloat()) }
    val bw = remember { Animatable(bwTarget) }

    LaunchedEffect(tvs, tve, yBounds, bwTarget) {
        val spec = spring<Float>(dampingRatio = 0.9f, stiffness = 380f)
        launch { vS.animateTo(tvs, spec) }
        launch { vE.animateTo(tve, spec) }
        launch { yLo.animateTo(yBounds.first.toFloat(), spec) }
        launch { yHi.animateTo(yBounds.second.toFloat(), spec) }
        launch { bw.animateTo(bwTarget, spec) }
    }

    // ---- tick crossfade
    var axis by remember { mutableStateOf(targetAxis) }
    var prevAxis by remember { mutableStateOf<AxisSpec?>(null) }
    val axisFade = remember { Animatable(1f) }
    LaunchedEffect(targetAxis) {
        if (targetAxis != axis) {
            prevAxis = axis
            axis = targetAxis
            axisFade.snapTo(0f)
            axisFade.animateTo(1f, tween(260))
        }
    }

    // ---- trend lives in data space and is only recomputed while the viewport moves
    val trend by remember(series) {
        derivedStateOf { series.computeTrend(vS.value, vE.value, bw.value) }
    }

    // ---- input
    val leftPx = with(density) { (if (yLabelsOnRight) 8.dp else 48.dp).toPx() }
    val rightPx = with(density) { (if (yLabelsOnRight) 48.dp else 10.dp).toPx() }
    val scrub by rememberUpdatedState<(Offset, Float) -> Unit>({ offset, totalW ->
        val plotW = totalW - leftPx - rightPx
        if (plotW > 0f) {
            val t = vS.value + (offset.x - leftPx) / plotW * (vE.value - vS.value)
            var best: Pt? = null
            var bestD = Float.MAX_VALUE
            for (p in series.pts) {
                val pt = p.day + 0.5f
                if (pt < tvs || pt > tve) continue
                val d = abs(pt - t)
                if (d < bestD) { best = p; bestD = d }
            }
            onSelect(best?.id)
        }
    })

    // ---- colours / text
    val primary = MaterialTheme.colorScheme.primary
    val tertiary = MaterialTheme.colorScheme.tertiary
    val outline = MaterialTheme.colorScheme.outlineVariant
    val labelColor = MaterialTheme.colorScheme.onSurfaceVariant
    val labelStyle = MaterialTheme.typography.labelSmall.copy(fontSize = 11.sp)
    val textMeasurer = rememberTextMeasurer(cacheSize = 64)

    Box(
        modifier = modifier
            .semantics { contentDescription = description }
            .chartDragScrubber { offset, width -> scrub(offset, width) }
    ) {
        if (series.pts.isEmpty()) {
            Text(
                text = "No weight logged yet",
                style = MaterialTheme.typography.bodyMedium,
                color = labelColor,
                modifier = Modifier.align(Alignment.Center)
            )
        } else {
            Canvas(Modifier.fillMaxSize()) {
                val left = leftPx
                val right = size.width - rightPx
                val top = 14.dp.toPx()
                val bottom = size.height - 28.dp.toPx()
                val plotW = right - left
                val plotH = bottom - top
                val vs = vS.value
                val ve = vE.value
                val lo = yLo.value
                val hi = yHi.value
                if (plotW <= 0f || ve - vs < 0.5f || hi - lo < 0.01f) return@Canvas

                fun xOf(t: Float) = left + (t - vs) / (ve - vs) * plotW
                fun yOf(v: Float) = bottom - (v - lo) / (hi - lo) * plotH

                val gridEffect = PathEffect.dashPathEffect(floatArrayOf(8f, 8f), 0f)

                fun drawYAxis(spec: AxisSpec, alpha: Float) {
                    if (alpha <= 0.01f) return
                    for (v in spec.yTicks) {
                        val y = yOf(v.toFloat())
                        if (y < top - 1f || y > bottom + 1f) continue
                        drawLine(
                            color = outline.copy(alpha = 0.5f * alpha),
                            start = Offset(left, y),
                            end = Offset(right, y),
                            strokeWidth = 1f,
                            pathEffect = gridEffect
                        )
                        val layout = textMeasurer.measure(formatKg(v, spec.yStep), labelStyle)
                        val x = if (yLabelsOnRight) right + 6.dp.toPx()
                        else left - layout.size.width - 8.dp.toPx()
                        drawText(
                            textLayoutResult = layout,
                            color = labelColor.copy(alpha = alpha),
                            topLeft = Offset(x.coerceAtLeast(0f), y - layout.size.height / 2f)
                        )
                    }
                }

                fun drawXAxis(spec: AxisSpec, alpha: Float) {
                    if (alpha <= 0.01f) return
                    var lastRight = -Float.MAX_VALUE
                    for (tick in spec.xTicks) {
                        val cx = xOf(tick.t)
                        if (cx < left - 1f || cx > right + 1f) continue
                        val layout = textMeasurer.measure(tick.label, labelStyle)
                        val x = if (tick.leftAligned) cx + 2.dp.toPx() else cx - layout.size.width / 2f
                        if (x < lastRight + 6.dp.toPx()) continue
                        drawText(
                            textLayoutResult = layout,
                            color = labelColor.copy(alpha = alpha),
                            topLeft = Offset(x, bottom + 6.dp.toPx())
                        )
                        lastRight = x + layout.size.width
                    }
                }

                val fade = axisFade.value
                prevAxis?.let { drawYAxis(it, 1f - fade) }
                drawYAxis(axis, fade)

                // ---- data, clipped to the plot so nothing leaks over the labels
                clipRect(left = left, top = 0f, right = right, bottom = bottom) {
                    val tr = trend
                    if (tr != null) {
                        val hasSolid = tr.t.size >= 2
                        val leftDash = tr.tFirst > vs
                        val rightDash = tr.tLast < ve
                        val solid = if (hasSolid) List(tr.t.size) { Offset(xOf(tr.t[it]), yOf(tr.w[it])) }
                        else emptyList()

                        val leftSeg: Pair<Offset, Offset>? = when {
                            !hasSolid ->
                                if (leftDash || rightDash)
                                    Offset(xOf(vs), yOf(tr.leftW)) to Offset(xOf(ve), yOf(tr.leftW))
                                else null
                            leftDash -> Offset(xOf(vs), yOf(tr.leftW)) to solid.first()
                            else -> null
                        }
                        val rightSeg: Pair<Offset, Offset>? =
                            if (hasSolid && rightDash) solid.last() to Offset(xOf(ve), yOf(tr.rightW)) else null

                        // gradient area under the whole polyline, dashes included
                        val poly = ArrayList<Offset>()
                        if (!hasSolid) {
                            leftSeg?.let { poly += it.first; poly += it.second }
                        } else {
                            leftSeg?.let { poly += it.first }
                            poly += solid
                            rightSeg?.let { poly += it.second }
                        }
                        if (poly.size >= 2) {
                            val area = Path().apply {
                                moveTo(poly.first().x, bottom)
                                poly.forEach { lineTo(it.x, it.y) }
                                lineTo(poly.last().x, bottom)
                                close()
                            }
                            drawPath(
                                path = area,
                                brush = Brush.verticalGradient(
                                    colors = listOf(
                                        primary.copy(alpha = 0.22f),
                                        primary.copy(alpha = 0.02f),
                                        Color.Transparent
                                    ),
                                    startY = top,
                                    endY = bottom
                                )
                            )
                        }

                        // dashed = carried over, not measured
                        val dash = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 10.dp.toPx()))
                        listOfNotNull(leftSeg, rightSeg).forEach { seg ->
                            drawLine(
                                color = primary.copy(alpha = 0.55f),
                                start = seg.first,
                                end = seg.second,
                                strokeWidth = 2.dp.toPx(),
                                cap = StrokeCap.Round,
                                pathEffect = dash
                            )
                        }

                        if (hasSolid) {
                            val path = Path().apply {
                                moveTo(solid[0].x, solid[0].y)
                                for (i in 1 until solid.size) lineTo(solid[i].x, solid[i].y)
                            }
                            drawPath(
                                path = path,
                                color = primary,
                                style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round)
                            )
                        }
                    }

                    // raw measurements
                    val margin = 14.dp.toPx()
                    for (p in series.pts) {
                        val x = xOf(p.day + 0.5f)
                        if (x < left - margin || x > right + margin) continue
                        val c = Offset(x, yOf(p.weight.toFloat()))
                        if (p.id == selectedId) {
                            drawCircle(primary.copy(alpha = 0.25f), 12.dp.toPx(), c)
                            drawCircle(tertiary, 4.5.dp.toPx(), c)
                        } else {
                            drawCircle(primary.copy(alpha = 0.45f), 2.8.dp.toPx(), c)
                        }
                    }
                }

                drawLine(outline, Offset(left, bottom), Offset(right, bottom), strokeWidth = 1.5f)
                prevAxis?.let { drawXAxis(it, 1f - fade) }
                drawXAxis(axis, fade)
            }

            if (inWindowCount == 0) {
                Text(
                    text = "No measurements in this period",
                    style = MaterialTheme.typography.bodyMedium,
                    color = labelColor.copy(alpha = 0.8f),
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
    }
}
