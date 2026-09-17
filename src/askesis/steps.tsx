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
} from '../themes/m3-components';
import {
  getPastSteps,
  CoachStep,
} from '../database/db';
import { syncStepsFromHealthConnect } from '../coach/backgroundTask';

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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface DayStepData {
  dateStr: string;
  label: string;
  date: Date;
  steps: number;
  hasRecord: boolean;
  isToday: boolean;
}

// Generate the list of the past 30 days ending today
function getPast30Days(): { dateStr: string; label: string; date: Date; isToday: boolean }[] {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalIso(today);

  for (let i = 29; i >= 0; i--) {
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

// ---------------------------------------------------------------------------
// 30-DAY SVG TIME-SERIES BAR CHART
// ---------------------------------------------------------------------------
function Steps30DayChart({
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
  const [chartWidth, setChartWidth] = useState(330);

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

  const slotWidth = drawWidth / 30;
  const barWidth = Math.max(3.5, Math.min(8, slotWidth - 2.5));

  // Average line Y coordinate
  const avgY = maxY > 0 ? padTop + drawHeight - (averageSteps / maxY) * drawHeight : padTop + drawHeight;

  // Ticks for Y-Axis (0, mid, max)
  const yTicks = [
    { value: maxY, y: padTop },
    { value: Math.round(maxY / 2), y: padTop + drawHeight / 2 },
    { value: 0, y: padTop + drawHeight },
  ];

  // X-axis label indices (e.g. day 0, 7, 14, 21, 29)
  const xLabelIndices = [0, 7, 14, 21, 29];

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setChartWidth(w);
      }}
      style={{ width: '100%', height: chartHeight }}
    >
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

        {/* 30-Day Average Reference Line */}
        {averageSteps > 0 && avgY >= padTop && avgY <= padTop + drawHeight && (
          <G>
            <Line
              x1={padLeft}
              y1={avgY}
              x2={chartWidth - padRight}
              y2={avgY}
              stroke={m3.tertiary}
              strokeDasharray="4,4"
              strokeWidth={1.8}
            />
            <SvgText
              x={chartWidth - padRight - 2}
              y={avgY - 4}
              fill={m3.tertiary}
              fontSize="9"
              fontWeight="700"
              textAnchor="end"
            >
              AVG {averageSteps >= 1000 ? `${(averageSteps / 1000).toFixed(1)}k` : averageSteps}
            </SvgText>
          </G>
        )}

        {/* 30 Daily Step Bars */}
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
  const [coachSteps, setCoachSteps] = useState<CoachStep[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(29); // Default to today (index 29)
  const [syncing, setSyncing] = useState(false);

  // Load steps from SQLite
  const loadData = useCallback(async () => {
    try {
      const list = await getPastSteps(30);
      setCoachSteps(list);
    } catch (e) {
      console.error('Error loading coach steps:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync from Health Connect on mount or user request
  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncStepsFromHealthConnect(30);
      if (res.success) {
        await loadData();
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
  }, [syncing, loadData]);

  // Generate 30 days dataset mapped to database records
  const past30Days = useMemo(() => getPast30Days(), []);

  const dataPoints: DayStepData[] = useMemo(() => {
    const stepMap = new Map<string, number>();
    coachSteps.forEach((s) => stepMap.set(s.date, s.steps));

    return past30Days.map((d) => ({
      dateStr: d.dateStr,
      label: d.label,
      date: d.date,
      steps: stepMap.get(d.dateStr) ?? 0,
      hasRecord: stepMap.has(d.dateStr),
      isToday: d.isToday,
    }));
  }, [past30Days, coachSteps]);

  // 1. Total steps in past 30 days
  const totalSteps = useMemo(() => {
    return dataPoints.reduce((acc, curr) => acc + curr.steps, 0);
  }, [dataPoints]);

  // 2. Average steps walked in the past 30 days:
  // When recorded history is shorter than 30 days, divisor scales to recorded days for an honest daily rate.
  const averageSteps = useMemo(() => {
    const recordedDays = dataPoints.filter((d) => d.hasRecord);
    const divisor = recordedDays.length > 0 ? recordedDays.length : 30;
    return Math.round(totalSteps / divisor);
  }, [dataPoints, totalSteps]);

  // 3. Today's steps
  const todaySteps = useMemo(() => {
    const today = dataPoints.find((d) => d.isToday);
    return today ? today.steps : 0;
  }, [dataPoints]);

  // 4. Best day in the 30-day window
  const bestDay = useMemo(() => {
    let max = 0;
    let bestDate = '';
    dataPoints.forEach((d) => {
      if (d.steps > max) {
        max = d.steps;
        bestDate = d.label;
      }
    });
    return { steps: max, label: bestDate };
  }, [dataPoints]);

  // Selected Day Details
  const selectedDay = dataPoints[selectedIndex] ?? dataPoints[29];
  const diffFromAvg = selectedDay ? selectedDay.steps - averageSteps : 0;
  const pctFromAvg = averageSteps > 0 ? Math.round((diffFromAvg / averageSteps) * 100) : 0;

  // Date range label
  const rangeLabel = useMemo(() => {
    if (dataPoints.length === 0) return '';
    const first = dataPoints[0].label;
    const last = dataPoints[dataPoints.length - 1].label;
    return `${first} – ${last}`;
  }, [dataPoints]);

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
        {/* TOP HERO CARD: DAILY AVERAGE & PAST 30 DAYS STATS */}
        {/* ------------------------------------------------------------------ */}
        <M3Card shape="extraLarge" style={{ marginBottom: 24 }}>
          {/* Average Header */}
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>
                Daily Average (Past 30 Days)
              </Text>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: m3.surfaceContainerHighest, borderRadius: m3Shape.full },
                ]}
              >
                <Text style={[m3Type.labelSmallEmphasized, { color: m3.onSurfaceVariant }]}>
                  {rangeLabel}
                </Text>
              </View>
            </View>

            {/* Hero Number Display */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text style={[m3Type.displaySmallEmphasized, { color: m3.onSurface }]}>
                {formatNumber(averageSteps)}
              </Text>
              <Text style={[m3Type.titleMedium, { color: m3.onSurfaceVariant, marginLeft: 8 }]}>
                steps / day
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
            {/* Today */}
            <View style={styles.metricCol}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>Today</Text>
              <Text style={[m3Type.titleMediumEmphasized, { color: m3.primary }]}>
                {formatNumber(todaySteps)}
              </Text>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: m3.outlineVariant }]} />

            {/* 30-Day Total */}
            <View style={styles.metricCol}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>30-Day Total</Text>
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
          {/* 30-DAY STEP GRAPH */}
          {/* ---------------------------------------------------------------- */}
          <View style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[m3Type.titleSmallEmphasized, { color: m3.onSurface }]}>
                Daily Steps Trend
              </Text>
              <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>
                Tap bar to inspect
              </Text>
            </View>

            <Steps30DayChart
              data={dataPoints}
              averageSteps={averageSteps}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
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
                  {formatFullDate(selectedDay.dateStr)} {selectedDay.isToday ? '· Today' : ''}
                </Text>
                {selectedDay.hasRecord ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 2 }}>
                      <Text style={[m3Type.titleLargeEmphasized, { color: m3.onSurface }]}>
                        {formatNumber(selectedDay.steps)}
                      </Text>
                      <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginLeft: 6 }]}>
                        steps
                      </Text>
                    </View>
                    {averageSteps > 0 && selectedDay.steps > 0 && (
                      <Text
                        style={[
                          m3Type.labelSmallEmphasized,
                          {
                            color: diffFromAvg >= 0 ? m3.primary : m3.error,
                            marginTop: 2,
                          },
                        ]}
                      >
                        {diffFromAvg >= 0 ? '+' : ''}
                        {formatNumber(diffFromAvg)} ({diffFromAvg >= 0 ? '+' : ''}
                        {pctFromAvg}%) vs 30-day avg
                      </Text>
                    )}
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
