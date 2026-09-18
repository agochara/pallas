import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G, Path, Circle } from 'react-native-svg';

import {
  useM3Theme,
  m3Shape,
  m3Type,
} from '../themes/theme';
import {
  M3Card,
  M3Pressable,
  M3SegmentedButton,
} from '../themes/m3-components';
import { CoachStep } from '../database/db';
import { syncStepsFromHealthConnect, ensureStepsBackfill } from '../coach/backgroundTask';
import {
  getCachedSteps,
  hasStepsCache,
  loadStepsFromDb,
  stepsSignature,
} from './stepsStore';

type StepsRange = 'W' | 'M' | 'Y';

const RANGE_DAYS: Record<StepsRange, number> = { W: 7, M: 30, Y: 365 };

const STEP_RANGES: { key: StepsRange; label: string }[] = [
  { key: 'W', label: 'Week' },
  { key: 'M', label: 'Month' },
  { key: 'Y', label: 'Year' },
];

// Helper to get local date string YYYY-MM-DD
function toLocalIso(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatFullDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface DayStepData {
  dateStr: string;
  endDateStr: string;
  label: string;
  date: Date;
  steps: number;
  hasRecord: boolean;
  isToday: boolean;
  isBucket: boolean;
}

// Generate the past `n` days ending today.
function getPastDays(n: number): { dateStr: string; label: string; date: Date; isToday: boolean }[] {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalIso(today);

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dateStr = toLocalIso(d);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    days.push({
      dateStr,
      label,
      date: d,
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

// Collapse daily points into roughly `target` equal buckets (used for the year
// view so the bars stay legible). Each bucket reports its average daily steps.
function buildBuckets(daily: DayStepData[], target: number): DayStepData[] {
  const buckets: DayStepData[] = [];
  const size = Math.max(1, Math.ceil(daily.length / target));
  for (let end = daily.length - 1; end >= 0; end -= size) {
    const start = Math.max(0, end - size + 1);
    const slice = daily.slice(start, end + 1);
    const recorded = slice.filter((d) => d.hasRecord);
    const total = recorded.reduce((acc, d) => acc + d.steps, 0);
    const average = recorded.length > 0 ? Math.round(total / recorded.length) : 0;
    const first = slice[0];
    const last = slice[slice.length - 1];

    buckets.unshift({
      dateStr: first.dateStr,
      endDateStr: last.dateStr,
      label: first.label,
      date: first.date,
      steps: average,
      hasRecord: recorded.length > 0,
      isToday: last.isToday,
      isBucket: true,
    });
  }
  return buckets;
}

// Roughly five evenly spaced x-axis labels regardless of bar count.
function getLabelIndices(length: number): number[] {
  if (length <= 7) {
    return Array.from({ length }, (_, i) => i);
  }
  const target = 5;
  const indices = new Set<number>();
  for (let i = 0; i < target; i++) {
    indices.add(Math.round((i * (length - 1)) / (target - 1)));
  }
  return [...indices].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// STEP TREND SVG BAR CHART (daily or weekly buckets)
// ---------------------------------------------------------------------------
function StepsTrendChart({
  data,
  averageSteps,
  selectedIndex,
  onSelectIndex,
}: {
  data: DayStepData[];
  averageSteps: number;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
}) {
  const m3 = useM3Theme();
  // 0 until measured: drawing at a guessed width caused the chart to overflow
  // and visibly snap into place on first render.
  const [chartWidth, setChartWidth] = useState(0);

  const chartHeight = 200;
  const padLeft = 32;
  const padRight = 14;
  const padTop = 22;
  const padBottom = 26;

  const drawWidth = Math.max(100, chartWidth - padLeft - padRight);
  const drawHeight = chartHeight - padTop - padBottom;

  const maxStepVal = Math.max(...data.map((d) => d.steps), averageSteps, 6000);
  const stepMagnitude = maxStepVal > 15000 ? 5000 : 2000;
  const maxY = Math.ceil((maxStepVal * 1.12) / stepMagnitude) * stepMagnitude;

  const slotWidth = drawWidth / Math.max(1, data.length);
  const barWidth = Math.max(2.5, Math.min(8, slotWidth - 2.5));

  // Ticks for Y-Axis (0, mid, max)
  const yTicks = [
    { value: maxY, y: padTop },
    { value: Math.round(maxY / 2), y: padTop + drawHeight / 2 },
    { value: 0, y: padTop + drawHeight },
  ];

  const xLabelIndices = getLabelIndices(data.length);

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setChartWidth(w);
      }}
      style={{ width: '100%', height: chartHeight }}
    >
      {chartWidth > 0 && (
        <Svg width={chartWidth} height={chartHeight}>
        {/* Horizontal gridlines and Y-axis values */}
        {yTicks.map((tick, i) => (
          <G key={i}>
            <Line
              x1={padLeft}
              y1={tick.y}
              x2={chartWidth - padRight}
              y2={tick.y}
              stroke={m3.outlineVariant}
              strokeDasharray={tick.value === 0 ? undefined : '3,3'}
              strokeWidth={tick.value === 0 ? 1.5 : 1}
              opacity={tick.value === 0 ? 0.7 : 0.4}
            />
            <SvgText
              x={padLeft - 6}
              y={tick.y + 3}
              fill={m3.onSurfaceVariant}
              fontSize="9"
              fontWeight="600"
              textAnchor="end"
            >
              {tick.value >= 1000 ? `${Math.round(tick.value / 1000)}k` : tick.value}
            </SvgText>
          </G>
        ))}

        {/* Daily / weekly step bars */}
        {data.map((item, index) => {
          const isSelected = selectedIndex === index;
          const barHeight = maxY > 0 ? (item.steps / maxY) * drawHeight : 0;
          const barX = padLeft + index * slotWidth + (slotWidth - barWidth) / 2;
          const barY = padTop + drawHeight - barHeight;

          let barColor = m3.primaryContainer;
          let opacity = 0.85;

          if (isSelected) {
            barColor = m3.tertiary;
            opacity = 1;
          } else if (item.isToday) {
            barColor = m3.primary;
            opacity = 1;
          } else if (averageSteps > 0 && item.steps >= averageSteps) {
            barColor = m3.primary;
            opacity = 0.8;
          }

          return (
            <G key={item.dateStr}>
              {barHeight > 0 && (
                <Rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={Math.max(3, barHeight)}
                  rx={barWidth / 2}
                  ry={barWidth / 2}
                  fill={barColor}
                  opacity={opacity}
                />
              )}

              {/* Days with no synced record get a faint baseline tick so they
                  are not confused with genuine zero-step days. */}
              {!item.hasRecord && (
                <Rect
                  x={barX}
                  y={padTop + drawHeight - 1}
                  width={barWidth}
                  height={1.5}
                  rx={0.75}
                  ry={0.75}
                  fill={m3.outlineVariant}
                />
              )}

              {/* Selection indicator under baseline */}
              {isSelected && (
                <Circle
                  cx={barX + barWidth / 2}
                  cy={padTop + drawHeight + 5}
                  r={2.5}
                  fill={m3.tertiary}
                />
              )}
            </G>
          );
        })}

        {/* X-Axis Date Labels */}
        {xLabelIndices.map((idx) => {
          const item = data[idx];
          if (!item) return null;
          const x = padLeft + idx * slotWidth + slotWidth / 2;
          const isToday = item.isToday;

          return (
            <SvgText
              key={idx}
              x={x}
              y={chartHeight - 6}
              fill={isToday ? m3.primary : m3.onSurfaceVariant}
              fontSize="9"
              fontWeight={isToday ? '700' : '500'}
              textAnchor="middle"
            >
              {isToday ? 'Today' : item.label}
            </SvgText>
          );
        })}
        </Svg>
      )}

      {/* Invisible Touch Layer for Bar Selection */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            left: padLeft,
            right: padRight,
            top: padTop,
            bottom: padBottom,
            flexDirection: 'row',
          },
        ]}
      >
        {data.map((_, index) => (
          <Pressable
            key={index}
            style={{ flex: 1 }}
            onPress={() => onSelectIndex(index)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// MAIN STEPS SCREEN COMPONENT
// ---------------------------------------------------------------------------
export function StepsScreen() {
  const m3 = useM3Theme();
  const [range, setRange] = useState<StepsRange>('M');
  const [coachSteps, setCoachSteps] = useState<CoachStep[]>(() => getCachedSteps() ?? []);
  const [loading, setLoading] = useState<boolean>(() => !hasStepsCache());
  const [selectedIndex, setSelectedIndex] = useState<number>(-1); // -1 = latest
  const [syncing, setSyncing] = useState(false);

  // Merge a fresh list into state without re-rendering when it is unchanged.
  const applyList = useCallback((list: CoachStep[]) => {
    setCoachSteps((prev) => (stepsSignature(prev) === stepsSignature(list) ? prev : list));
  }, []);

  // Revalidate the cache from SQLite (stale-while-revalidate).
  const revalidate = useCallback(async () => {
    try {
      const list = await loadStepsFromDb();
      applyList(list);
    } catch (e) {
      console.error('Error loading coach steps:', e);
    } finally {
      setLoading(false);
    }
  }, [applyList]);

  useEffect(() => {
    revalidate();
  }, [revalidate]);

  // Background syncs land in SQLite while the app is paused; revalidate when
  // the user returns so the graph reflects them.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') revalidate();
    });
    return () => sub.remove();
  }, [revalidate]);

  // Sync from Health Connect on user request
  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncStepsFromHealthConnect(30);
      if (res.success) {
        // If this is the first time we have permission, seed the year of
        // history so the wider ranges are populated.
        await ensureStepsBackfill();
        await revalidate();
      } else if (res.hasPermission) {
        Alert.alert(
          'Health Connect Error',
          res.error ?? 'Could not sync steps from Health Connect.',
          [{ text: 'OK' }]
        );
      } else if (Platform.OS === 'android') {
        Alert.alert(
          'Health Connect Permission',
          'Step permissions have not been granted. Grant permission in Coach tab (/hc) or Android Settings to sync automatically.',
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      console.warn('Health Connect sync warning:', e);
    } finally {
      setSyncing(false);
    }
  }, [syncing, revalidate]);

  // Calendar days for the selected range.
  const days = useMemo(() => getPastDays(RANGE_DAYS[range]), [range]);

  const stepMap = useMemo(() => {
    const map = new Map<string, number>();
    coachSteps.forEach((s) => map.set(s.date, s.steps));
    return map;
  }, [coachSteps]);

  const dailyPoints: DayStepData[] = useMemo(
    () =>
      days.map((d) => ({
        dateStr: d.dateStr,
        endDateStr: d.dateStr,
        label: d.label,
        date: d.date,
        steps: stepMap.get(d.dateStr) ?? 0,
        hasRecord: stepMap.has(d.dateStr),
        isToday: d.isToday,
        isBucket: false,
      })),
    [days, stepMap]
  );

  // Year view is bucketed into ~24 bars; week/month render every day.
  const chartPoints: DayStepData[] = useMemo(
    () => (range === 'Y' ? buildBuckets(dailyPoints, 24) : dailyPoints),
    [range, dailyPoints]
  );

  const lastIndex = Math.max(0, chartPoints.length - 1);
  const activeIndex = selectedIndex < 0 ? lastIndex : Math.min(selectedIndex, lastIndex);
  const selectedDay = chartPoints[activeIndex];

  // Stats are always computed from daily data, even when the chart is bucketed.
  const totalSteps = useMemo(
    () => dailyPoints.reduce((acc, curr) => acc + curr.steps, 0),
    [dailyPoints]
  );

  const averageSteps = useMemo(() => {
    const recorded = dailyPoints.filter((d) => d.hasRecord);
    if (recorded.length === 0) return 0;
    return Math.round(recorded.reduce((acc, d) => acc + d.steps, 0) / recorded.length);
  }, [dailyPoints]);

  const todaySteps = useMemo(() => {
    const today = dailyPoints.find((d) => d.isToday);
    return today ? today.steps : 0;
  }, [dailyPoints]);

  const bestDay = useMemo(() => {
    let max = 0;
    let bestLabel = '';
    dailyPoints.forEach((d) => {
      if (d.steps > max) {
        max = d.steps;
        bestLabel = d.label;
      }
    });
    return { steps: max, label: bestLabel };
  }, [dailyPoints]);

  const rangeLabel = useMemo(() => {
    if (dailyPoints.length === 0) return '';
    const first = dailyPoints[0].label;
    const last = dailyPoints[dailyPoints.length - 1].label;
    return `${first} – ${last}`;
  }, [dailyPoints]);

  const totalLabel =
    range === 'W' ? '7-Day Total' : range === 'M' ? '30-Day Total' : 'Year Total';

  const showInitialLoading = loading && coachSteps.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: m3.surface }}>
      <ScrollView
        contentContainerStyle={styles.screenScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header Row */}
        <View style={styles.titleRow}>
          <Text style={[m3Type.headlineLargeEmphasized, { color: m3.onSurface }]}>
            Steps
          </Text>

          {/* Health Connect Sync Button */}
          <M3Pressable
            onPress={handleSync}
            hitSlop={8}
            scaleTo={0.92}
            style={[styles.actionIconBtn, { backgroundColor: m3.surfaceContainerHighest }]}
          >
            {syncing ? (
              <ActivityIndicator size="small" color={m3.primary} />
            ) : (
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"
                  stroke={m3.onSurface}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </M3Pressable>
        </View>

        {/* ------------------------------------------------------------------ */}
        {/* TOP HERO CARD: DAILY AVERAGE & RANGE STATS */}
        {/* ------------------------------------------------------------------ */}
        <M3Card shape="extraLarge" style={{ marginBottom: 24 }}>
          {/* Range Selector */}
          <M3SegmentedButton
            options={STEP_RANGES}
            selected={range}
            onSelect={(r) => {
              setRange(r);
              setSelectedIndex(-1);
            }}
            style={{ marginBottom: 16 }}
          />

          {/* Average Header */}
          <View style={{ marginBottom: 14 }}>
            {/* Hero Number Display */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={[m3Type.displaySmallEmphasized, { color: m3.onSurface }]}>
                {formatNumber(todaySteps)}
              </Text>
              <Text style={[m3Type.titleMedium, { color: m3.onSurfaceVariant, marginLeft: 8 }]}>
                steps
              </Text>
            </View>
          </View>

          {/* Quick Metrics Bar */}
          <View
            style={[
              styles.quickMetricsRow,
              { backgroundColor: m3.surfaceContainerLow, borderRadius: m3Shape.large },
            ]}
          >
            {/* Average */}
            <View style={styles.metricCol}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>Average</Text>
              <Text style={[m3Type.titleMediumEmphasized, { color: m3.primary }]}>
                {formatNumber(averageSteps)}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: m3.outlineVariant }]} />

            {/* Range Total */}
            <View style={styles.metricCol}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>{totalLabel}</Text>
              <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
                {formatNumber(totalSteps)}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: m3.outlineVariant }]} />

            {/* Best Day */}
            <View style={styles.metricCol}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>Best Day</Text>
              <Text style={[m3Type.titleMediumEmphasized, { color: m3.tertiary }]}>
                {bestDay.steps > 0 ? formatNumber(bestDay.steps) : '--'}
              </Text>
              {bestDay.steps > 0 && (
                <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>
                  {bestDay.label}
                </Text>
              )}
            </View>
          </View>

          {/* ---------------------------------------------------------------- */}
          {/* STEP GRAPH */}
          {/* ---------------------------------------------------------------- */}
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[m3Type.titleSmallEmphasized, { color: m3.onSurface }]}>
                Daily Steps
              </Text>
              <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>
                {range === 'Y' ? 'Tap bar to inspect' : 'Tap bar to inspect'}
              </Text>
            </View>

            {showInitialLoading ? (
              <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={m3.primary} />
              </View>
            ) : (
              <StepsTrendChart
                data={chartPoints}
                averageSteps={averageSteps}
                selectedIndex={activeIndex}
                onSelectIndex={setSelectedIndex}
              />
            )}

            <Text
              style={[
                m3Type.labelSmall,
                { color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 2 },
              ]}
            >
              {rangeLabel}
            </Text>
          </View>

          {/* Selected Day Inspection Footer */}
          {selectedDay && (
            <View
              style={[
                styles.inspectContainer,
                {
                  backgroundColor: m3.surfaceContainerHighest,
                  borderRadius: m3Shape.large,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>
                  {selectedDay.isBucket
                    ? `Week of ${formatShortDate(selectedDay.dateStr)} – ${formatShortDate(selectedDay.endDateStr)}`
                    : formatFullDate(selectedDay.dateStr)}{' '}
                  {selectedDay.isToday ? '· Today' : ''}
                </Text>
                {selectedDay.hasRecord ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                      <Text style={[m3Type.titleLargeEmphasized, { color: m3.onSurface }]}>
                        {formatNumber(selectedDay.steps)}
                      </Text>
                      <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginLeft: 6 }]}>
                        {selectedDay.isBucket ? 'avg steps/day' : 'steps'}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 4 }]}>
                    No data synced for this day.
                  </Text>
                )}
              </View>
            </View>
          )}
        </M3Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenScroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  quickMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  inspectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
});
