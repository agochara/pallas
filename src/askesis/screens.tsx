import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Line, Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import {
  Exercise,
  EXERCISES,
  LiftRecord,
  Fast,
  WeightEntry,
  setLift,
  deleteLift,
  getActiveFast,
  startFast,
  endFast,
  insertManualFast,
  updateFast,
  deleteFast,
  getFastHistory,
  getMaxLift,
  getWeights,
  getLatestWeight,
  insertWeight,
  updateWeight,
  deleteWeight,
} from '../database/db';

import { useM3Theme, m3Shape, m3Type, motionSprings, M3Theme } from '../themes/theme';
import {
  M3Card,
  M3Pressable,
  M3FilledButton,
  M3TonalButton,
  M3ErrorButton,
  M3SegmentedButton,
  M3BottomSheet,
  M3TopAppBar,
} from '../themes/m3-components';

export { useM3Theme, m3Shape, m3Type, motionSprings, M3Theme };
export { M3Card, M3Pressable, M3FilledButton, M3TonalButton, M3ErrorButton, M3SegmentedButton, M3BottomSheet, M3TopAppBar };

// ============================================================================
// FORMATTING & CALENDAR TIME-SPLITTING HELPERS
// ============================================================================

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatHM(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
}

function fmtWeight(w: number): string {
  return `${w}`;
}

function hoursToM3Color(hours: number, emptyColor: string, m3: M3Theme): string {
  if (hours === 0) return emptyColor;
  if (hours >= 24) return m3.fasting24plus;
  if (hours >= 16) return m3.fasting16to24;
  if (hours >= 12) return m3.fasting12to16;
  return m3.fastingUnder12;
}


function getPast7Days(offsetWeeks: number = 0): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(today.getDate() + offsetWeeks * 7);

  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    days.push(d);
  }
  return days;
}

function formatDateRange(days: Date[]): string {
  if (days.length === 0) return '';
  const first = days[0];
  const last = days[days.length - 1];

  const firstMonth = first.toLocaleDateString(undefined, { month: 'short' });
  const lastMonth = last.toLocaleDateString(undefined, { month: 'short' });

  if (first.getFullYear() !== last.getFullYear()) {
    return `${firstMonth} ${first.getDate()} '${String(first.getFullYear()).slice(-2)} – ${lastMonth} ${last.getDate()} '${String(last.getFullYear()).slice(-2)}`;
  }

  if (firstMonth !== lastMonth) {
    return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}`;
  }

  return `${firstMonth} ${first.getDate()} – ${last.getDate()}`;
}

function getFastingForDay(
  d: Date,
  fasts: Fast[]
): { totalHours: number; fasts: Fast[]; primaryFast: Fast | null } {
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();

  let totalMs = 0;
  const overlapping: { fast: Fast; overlapMs: number }[] = [];

  for (const f of fasts) {
    if (!f.end_time) continue;
    const fStart = new Date(f.start_time).getTime();
    const fEnd = new Date(f.end_time).getTime();
    if (isNaN(fStart) || isNaN(fEnd) || fEnd <= fStart) continue;

    const overlapStart = Math.max(fStart, startOfDay);
    const overlapEnd = Math.min(fEnd, endOfDay);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > 0) {
      totalMs += overlap;
      overlapping.push({ fast: f, overlapMs: overlap });
    }
  }

  overlapping.sort((a, b) => b.overlapMs - a.overlapMs);

  return {
    totalHours: totalMs / 3600000,
    fasts: overlapping.map((o) => o.fast),
    primaryFast: overlapping.length > 0 ? overlapping[0].fast : null,
  };
}



// DateTime & Date Inputs
function DateTimeField({
  label,
  value,
  onChange,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  maximumDate?: Date;
}) {
  const m3 = useM3Theme();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Pressable
          onPress={() => setShowDate(true)}
          style={[styles.m3DateField, { flex: 1, backgroundColor: m3.surfaceContainerHighest }]}
        >
          <Text style={[m3Type.bodyMedium, { color: m3.onSurface }]}>
            {value.toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowTime(true)}
          style={[styles.m3DateField, { flex: 1, backgroundColor: m3.surfaceContainerHighest }]}
        >
          <Text style={[m3Type.bodyMedium, { color: m3.onSurface }]}>
            {value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Pressable>
      </View>

      {showDate && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={maximumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event: any, selected?: Date) => {
            setShowDate(Platform.OS === 'ios');
            if (event.type === 'dismissed' || !selected) return;
            const next = new Date(value);
            next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
            onChange(next);
          }}
        />
      )}

      {showTime && (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: any, selected?: Date) => {
            setShowTime(Platform.OS === 'ios');
            if (event.type === 'dismissed' || !selected) return;
            const next = new Date(value);
            next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            onChange(next);
          }}
        />
      )}
    </View>
  );
}

function formatDateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStringToMs(dateStr: string): number {
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0).getTime();
}

function DateField({
  label = 'Date',
  value,
  onChange,
  maximumDate,
}: {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
  maximumDate?: Date;
}) {
  const m3 = useM3Theme();
  const [showPicker, setShowPicker] = useState(false);

  const clean = (value || formatDateToIso(new Date())).slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant, marginBottom: 6 }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={[
          styles.m3DateField,
          {
            backgroundColor: m3.surfaceContainerHighest,
            justifyContent: 'center',
            minHeight: 52,
          },
        ]}
      >
        <Text style={[m3Type.bodyMedium, { color: m3.onSurface }]}>
          {dateObj.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          maximumDate={maximumDate}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event: any, selected?: Date) => {
            setShowPicker(Platform.OS === 'ios');
            if (event.type === 'dismissed' || !selected) return;
            onChange(formatDateToIso(selected));
          }}
        />
      )}
    </View>
  );
}

// ============================================================================
// 1. WEIGHT MODULE (Material 3 Expressive)
// ============================================================================

type TimeRange = 'W' | 'M' | '3M' | 'Y';

type TimeWindow = {
  startMs: number;
  endMs: number;
  label: string;
  ticks: { label: string; timeMs: number }[];
};

function getTimeWindow(range: TimeRange, offset: number): TimeWindow {
  const now = new Date();

  if (range === 'W') {
    const endDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7);
    const startDay = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 6);

    const start = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0, 0);
    const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);

    const startStr = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const label = `${startStr} – ${endStr}`;

    const ticks: { label: string; timeMs: number }[] = [];
    const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12, 0, 0);
      ticks.push({
        label: DAY_NAMES[d.getDay()],
        timeMs: d.getTime(),
      });
    }

    return { startMs: start.getTime(), endMs: end.getTime(), label, ticks };
  }

  if (range === 'M') {
    const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();

    const start = new Date(m.getFullYear(), m.getMonth(), 1, 0, 0, 0);
    const end = new Date(m.getFullYear(), m.getMonth(), daysInMonth, 23, 59, 59, 999);

    const label = m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const ticks: { label: string; timeMs: number }[] = [];
    const step = Math.floor(daysInMonth / 4);
    const checkDays = [1, 1 + step, 1 + step * 2, 1 + step * 3, daysInMonth];
    for (const dayNum of checkDays) {
      const d = new Date(m.getFullYear(), m.getMonth(), dayNum, 12, 0, 0);
      ticks.push({
        label: String(dayNum),
        timeMs: d.getTime(),
      });
    }

    return { startMs: start.getTime(), endMs: end.getTime(), label, ticks };
  }

  if (range === '3M') {
    const endMonth = new Date(now.getFullYear(), now.getMonth() + offset * 3, 1);
    const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - 2, 1);
    const daysInEndMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0).getDate();

    const start = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1, 0, 0, 0);
    const end = new Date(endMonth.getFullYear(), endMonth.getMonth(), daysInEndMonth, 23, 59, 59, 999);

    const startStr = startMonth.toLocaleDateString(undefined, { month: 'short' });
    const endStr = endMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    const label = `${startStr} – ${endStr}`;

    const ticks: { label: string; timeMs: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const mDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 15, 12, 0, 0);
      ticks.push({
        label: mDate.toLocaleDateString(undefined, { month: 'short' }),
        timeMs: mDate.getTime(),
      });
    }

    return { startMs: start.getTime(), endMs: end.getTime(), label, ticks };
  }

  // range === 'Y' (12 Months window)
  const endMonth = new Date(now.getFullYear(), now.getMonth() + offset * 12, 1);
  const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1);
  const daysInEndMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0).getDate();

  const start = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1, 0, 0, 0);
  const end = new Date(endMonth.getFullYear(), endMonth.getMonth(), daysInEndMonth, 23, 59, 59, 999);

  const startStr = startMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const endStr = endMonth.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  const label = `${startStr} – ${endStr}`;

  const ticks: { label: string; timeMs: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const mDate = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 15, 12, 0, 0);
    const mInitial = mDate.toLocaleDateString(undefined, { month: 'narrow' });
    ticks.push({
      label: mInitial,
      timeMs: mDate.getTime(),
    });
  }

  return { startMs: start.getTime(), endMs: end.getTime(), label, ticks };
}

function WeightTimeSeriesChart({
  entries,
  window,
  onSelectEntry,
}: {
  entries: WeightEntry[];
  window: TimeWindow;
  onSelectEntry: (entry: WeightEntry) => void;
}) {
  const m3 = useM3Theme();
  const [chartWidth, setChartWidth] = useState(320);

  const chartHeight = 180;
  const padLeft = 14;
  const padRight = 36;
  const padTop = 16;
  const padBottom = 26;

  const drawWidth = Math.max(100, chartWidth - padLeft - padRight);
  const drawHeight = chartHeight - padTop - padBottom;
  const timeSpan = window.endMs - window.startMs || 1;

  const inWindow = entries
    .filter((e) => {
      const t = parseDateStringToMs(e.date);
      return t >= window.startMs && t <= window.endMs;
    })
    .sort((a, b) => parseDateStringToMs(a.date) - parseDateStringToMs(b.date));

  const weightsInWindow = inWindow.map((e) => e.weight);
  const rawMin = weightsInWindow.length > 0 ? Math.min(...weightsInWindow) : 70;
  const rawMax = weightsInWindow.length > 0 ? Math.max(...weightsInWindow) : 80;
  const pad = Math.max(2, (rawMax - rawMin) * 0.2);
  const minW = Math.floor(rawMin - pad);
  const maxW = Math.ceil(rawMax + pad);
  const yRange = maxW - minW || 1;

  const mappedPoints = inWindow.map((e) => {
    const t = parseDateStringToMs(e.date);
    const xPct = Math.max(0, Math.min(1, (t - window.startMs) / timeSpan));
    const x = padLeft + xPct * drawWidth;
    const y = padTop + ((maxW - e.weight) / yRange) * drawHeight;
    return { x, y, entry: e };
  });

  const polylinePoints = mappedPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const midW = Math.round((minW + maxW) / 2);
  const yTicks = [
    { value: maxW, y: padTop },
    { value: midW, y: padTop + drawHeight / 2 },
    { value: minW, y: padTop + drawHeight },
  ];

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setChartWidth(w);
      }}
      style={{ width: '100%', height: chartHeight }}
    >
      <Svg width={chartWidth} height={chartHeight}>
        {yTicks.map((tick, i) => (
          <G key={i}>
            <Line
              x1={padLeft}
              y1={tick.y}
              x2={chartWidth - padRight}
              y2={tick.y}
              stroke={m3.outlineVariant}
              strokeDasharray={i === yTicks.length - 1 ? undefined : '4,4'}
              strokeWidth={i === yTicks.length - 1 ? '1.5' : '1'}
            />
            <SvgText
              x={chartWidth - padRight + 6}
              y={tick.y + 4}
              fill={m3.onSurfaceVariant}
              fontSize="10"
              fontWeight="600"
              textAnchor="start"
            >
              {tick.value}
            </SvgText>
          </G>
        ))}

        {mappedPoints.length >= 2 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={m3.tertiary}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {mappedPoints.map((p, i) => (
          <G key={i}>
            {/* Expanded 48x48dp touch target */}
            <Circle
              cx={p.x}
              cy={p.y}
              r={24}
              fill="transparent"
              onPress={() => onSelectEntry(p.entry)}
            />
            {/* Visual point */}
            <Circle
              cx={p.x}
              cy={p.y}
              r={mappedPoints.length > 30 ? 3.5 : 5.5}
              fill={m3.surfaceContainer}
              stroke={m3.tertiary}
              strokeWidth="2.5"
              pointerEvents="none"
            />
          </G>
        ))}


        {window.ticks.map((tick, i) => {
          const xPct = Math.max(0, Math.min(1, (tick.timeMs - window.startMs) / timeSpan));
          const x = padLeft + xPct * drawWidth;
          return (
            <SvgText
              key={i}
              x={x}
              y={chartHeight - 6}
              fill={m3.onSurfaceVariant}
              fontSize="10"
              fontWeight="600"
              textAnchor="middle"
            >
              {tick.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function AddWeightModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const m3 = useM3Theme();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(formatDateToIso(new Date()));

  useEffect(() => {
    if (visible) {
      setWeight('');
      setDate(formatDateToIso(new Date()));
    }
  }, [visible]);

  async function handleSave() {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    await insertWeight(val, date);
    onSaved();
    onClose();
  }

  return (
    <M3BottomSheet visible={visible} title="Log Weight" onClose={onClose}>
      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>Weight (kg)</Text>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        placeholder="e.g. 78.5"
        placeholderTextColor={m3.onSurfaceVariant}
        keyboardType="decimal-pad"
        autoFocus
        style={[
          styles.m3TextInput,
          {
            backgroundColor: m3.surfaceContainerHighest,
            color: m3.onSurface,
          },
        ]}
      />

      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

      <View style={{ marginTop: 24 }}>
        <M3FilledButton label="Save Weight" onPress={handleSave} />
      </View>
    </M3BottomSheet>
  );
}

function EditWeightModal({
  visible,
  entry,
  onClose,
  onSaved,
}: {
  visible: boolean;
  entry: WeightEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const m3 = useM3Theme();
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(formatDateToIso(new Date()));

  useEffect(() => {
    if (visible && entry) {
      setWeight(String(entry.weight));
      setDate(entry.date.slice(0, 10));
    }
  }, [visible, entry]);

  async function handleSave() {
    if (!entry) return;
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    await updateWeight(entry.id, val, date);
    onSaved();
    onClose();
  }

  function handleDelete() {
    if (!entry) return;
    Alert.alert(
      'Delete measurement?',
      'This weight entry will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWeight(entry.id);
            onSaved();
            onClose();
          },
        },
      ]
    );
  }

  if (!entry) return null;

  return (
    <M3BottomSheet visible={visible} title="Edit Weight" onClose={onClose}>
      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>Weight (kg)</Text>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        style={[
          styles.m3TextInput,
          {
            backgroundColor: m3.surfaceContainerHighest,
            color: m3.onSurface,
          },
        ]}
      />

      <DateField label="Date" value={date} onChange={setDate} maximumDate={new Date()} />

      <View style={{ marginTop: 24, gap: 12 }}>
        <M3FilledButton label="Save Changes" onPress={handleSave} />
        <M3ErrorButton label="Delete Measurement" onPress={handleDelete} />
      </View>
    </M3BottomSheet>
  );
}

export function WeightScreen() {
  const m3 = useM3Theme();
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [latestGlobalWeight, setLatestGlobalWeight] = useState<WeightEntry | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('Y');
  const [rangeOffset, setRangeOffset] = useState<number>(0);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<WeightEntry | null>(null);

  const load = useCallback(async () => {
    const list = await getWeights();
    setWeights(list);
    setLatestGlobalWeight(await getLatestWeight());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const window = getTimeWindow(timeRange, rangeOffset);

  const inWindow = weights
    .filter((e) => {
      const t = parseDateStringToMs(e.date);
      return t >= window.startMs && t <= window.endMs;
    })
    .sort((a, b) => parseDateStringToMs(a.date) - parseDateStringToMs(b.date));

  const firstInWindow = inWindow[0] ?? null;
  const lastInWindow = inWindow[inWindow.length - 1] ?? null;
  const delta =
    firstInWindow && lastInWindow && inWindow.length >= 2
      ? lastInWindow.weight - firstInWindow.weight
      : null;

  let deltaText = '';
  if (inWindow.length === 0) {
    deltaText = 'No measurements in this period';
  } else if (inWindow.length === 1) {
    deltaText = `1 measurement recorded (${inWindow[0].weight} kg)`;
  } else if (delta !== null) {
    if (delta < 0) {
      deltaText = `${Math.abs(delta).toFixed(1)} kg lost over period`;
    } else if (delta > 0) {
      deltaText = `${delta.toFixed(1)} kg gained over period`;
    } else {
      deltaText = 'No net change over period';
    }
  }

  const RANGES: { key: TimeRange; label: string }[] = [
    { key: 'W', label: 'W' },
    { key: 'M', label: 'M' },
    { key: '3M', label: '3M' },
    { key: 'Y', label: 'Y' },
  ];

  const historyDesc = [...weights].reverse();

  return (
    <ScrollView
      style={{ backgroundColor: m3.surface }}
      contentContainerStyle={styles.m3ScreenPad}
      showsVerticalScrollIndicator={false}
    >
      {/* Title & Log Pill Button */}
      <View style={styles.m3TitleRow}>
        <View>
          <Text style={[m3Type.headlineLarge, { color: m3.onSurface }]}>Weight</Text>
        </View>

        <M3Pressable
          onPress={() => setShowAdd(true)}
          scaleTo={0.96}
          style={[styles.m3ActionPill, { backgroundColor: m3.primary }]}
        >
          <Text style={[m3Type.labelMedium, { color: m3.onPrimary }]}>+ LOG</Text>
        </M3Pressable>
      </View>

      {/* Main Chart Card */}
      <M3Card shape="extraLarge" style={{ marginBottom: 20 }}>
        {/* Connected M3 Segmented Buttons */}
        <M3SegmentedButton
          options={RANGES}
          selected={timeRange}
          onSelect={(r) => {
            setTimeRange(r);
            setRangeOffset(0);
          }}
        />

        {/* Date Range Header with Prev/Next Controls */}
        <View style={styles.m3RangeHeader}>
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>{window.label}</Text>

          <View style={{ flexDirection: 'row', gap: 6 }}>
            <M3Pressable
              onPress={() => setRangeOffset((o) => o - 1)}
              hitSlop={10}
              scaleTo={0.92}
              style={[styles.m3IconNavBtn, { backgroundColor: m3.surfaceContainerHighest }]}
            >
              <Text style={{ color: m3.onSurface, fontSize: 18, fontWeight: '700' }}>‹</Text>
            </M3Pressable>
            <M3Pressable
              onPress={() => setRangeOffset((o) => Math.min(0, o + 1))}
              disabled={rangeOffset >= 0}
              hitSlop={10}
              scaleTo={0.92}
              style={[
                styles.m3IconNavBtn,
                {
                  backgroundColor: m3.surfaceContainerHighest,
                  opacity: rangeOffset >= 0 ? 0.35 : 1,
                },
              ]}
            >
              <Text style={{ color: m3.onSurface, fontSize: 18, fontWeight: '700' }}>›</Text>
            </M3Pressable>
            {rangeOffset < 0 && (
              <M3Pressable
                onPress={() => setRangeOffset(0)}
                hitSlop={10}
                scaleTo={0.92}
                style={[styles.m3IconNavBtn, { backgroundColor: m3.surfaceContainerHighest }]}
              >
                <Text style={{ color: m3.primary, fontSize: 14, fontWeight: '700' }}>↺</Text>
              </M3Pressable>
            )}
          </View>
        </View>

        {/* Hero Current Weight Display (DisplaySmall: 36sp) */}
        <View style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={[m3Type.displaySmall, { color: m3.onSurface }]}>
              {latestGlobalWeight ? latestGlobalWeight.weight.toFixed(1) : '--'}
            </Text>
            <Text style={[m3Type.titleMedium, { color: m3.onSurfaceVariant, marginLeft: 6 }]}>kg</Text>
          </View>
          <Text style={[m3Type.bodySmall, { color: m3.tertiary, marginTop: 2, fontWeight: '500' }]}>{deltaText}</Text>
        </View>


        {/* Continuous Time-Series Chart */}
        <WeightTimeSeriesChart
          entries={weights}
          window={window}
          onSelectEntry={setEditing}
        />
      </M3Card>

      {/* History Section */}
      <Text style={[m3Type.titleLarge, { color: m3.onSurface, marginBottom: 12, marginTop: 8 }]}>
        History
      </Text>
      {historyDesc.length === 0 ? (
        <View style={styles.m3EmptyWrap}>
          <Text style={[m3Type.bodyMedium, { color: m3.onSurfaceVariant }]}>No weight entries recorded yet</Text>
        </View>
      ) : (
        historyDesc.map((w) => (
          <Pressable key={w.id} onPress={() => setEditing(w)}>
            <View style={[styles.m3ListRow, { backgroundColor: m3.surfaceContainerLow }]}>
              <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>{w.weight} kg</Text>
              <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>{w.date}</Text>
            </View>
          </Pressable>
        ))
      )}

      <AddWeightModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={load}
      />
      <EditWeightModal
        visible={!!editing}
        entry={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </ScrollView>
  );
}

// ============================================================================
// 2. STRENGTH MODULE (Material 3 Expressive - Semantic Content Hierarchy)
// ============================================================================

function EditLiftModal({
  visible,
  exercise,
  currentRecord,
  onClose,
  onSaved,
}: {
  visible: boolean;
  exercise: Exercise | null;
  currentRecord: LiftRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const m3 = useM3Theme();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    if (visible && exercise) {
      setWeight(currentRecord ? `${currentRecord.weight}` : '');
      setReps(currentRecord ? `${currentRecord.reps}` : '');
    }
  }, [visible, exercise, currentRecord]);

  async function handleSave() {
    if (!exercise) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || w < 0 || r <= 0) {
      Alert.alert('Invalid input', 'Please enter valid numbers for weight and reps.');
      return;
    }
    await setLift(exercise, w, r);
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!exercise) return;
    Alert.alert(
      'Clear Record?',
      `Clear the maximum record for ${exercise}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await deleteLift(exercise);
            onSaved();
            onClose();
          },
        },
      ]
    );
  }

  if (!exercise) return null;

  return (
    <M3BottomSheet visible={visible} title={`Record ${exercise}`} onClose={onClose}>
      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>
        Weight added (kg) · Enter 0 for bodyweight
      </Text>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        placeholder="0"
        placeholderTextColor={m3.onSurfaceVariant}
        keyboardType="decimal-pad"
        style={[
          styles.m3TextInput,
          {
            backgroundColor: m3.surfaceContainerHighest,
            color: m3.onSurface,
          },
        ]}
      />

      <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant, marginTop: 14 }]}>
        Repetitions
      </Text>
      <TextInput
        value={reps}
        onChangeText={setReps}
        placeholder="e.g. 5"
        placeholderTextColor={m3.onSurfaceVariant}
        keyboardType="number-pad"
        style={[
          styles.m3TextInput,
          {
            backgroundColor: m3.surfaceContainerHighest,
            color: m3.onSurface,
          },
        ]}
      />

      <View style={{ marginTop: 24, gap: 12 }}>
        <M3FilledButton label="Save Record" onPress={handleSave} />
        {currentRecord && (
          <M3ErrorButton label="Clear Record" onPress={handleDelete} />
        )}
      </View>
    </M3BottomSheet>
  );
}

export function StrengthScreen() {
  const m3 = useM3Theme();
  const [maxLifts, setMaxLifts] =
    useState<Record<Exercise, LiftRecord | null> | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    const entries = await Promise.all(
      EXERCISES.map(async (ex) => [ex, await getMaxLift(ex)] as const)
    );

    setMaxLifts(
      Object.fromEntries(entries) as Record<
        Exercise,
        LiftRecord | null
      >
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-stack non-empty recorded cards at top, and empty unrecorded cards at bottom
  const recordedExercises = EXERCISES.filter((ex) => !!maxLifts?.[ex]);
  const unrecordedExercises = EXERCISES.filter((ex) => !maxLifts?.[ex]);
  const sortedExercises = [...recordedExercises, ...unrecordedExercises];

  return (
    <ScrollView
      style={{ backgroundColor: m3.surface }}
      contentContainerStyle={styles.m3ScreenPad}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.m3TitleRow}>
        <View>
          <Text style={[m3Type.headlineLarge, { color: m3.onSurface }]}>Strength</Text>
        </View>
      </View>

      {sortedExercises.map((ex) => {
        const rec = maxLifts?.[ex];
        const hasRecord = !!rec;

        return (
          <Pressable key={ex} onPress={() => setEditingExercise(ex)}>
            {hasRecord ? (
              /* Elevated Active Record Card */
              <M3Card
                shape="large"
                containerLevel="surfaceContainer"
                style={{ marginBottom: 12, padding: 18 }}
              >
                <View style={styles.m3ExerciseHeaderRow}>
                  <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
                    {ex}
                  </Text>
                  <View style={[styles.m3TonalChip, { backgroundColor: m3.secondaryContainer }]}>
                    <Text style={[m3Type.labelSmall, { color: m3.onSecondaryContainer }]}>
                      EDIT
                    </Text>
                  </View>
                </View>

                <Text style={[m3Type.headlineMedium, { color: m3.pallasBlue, marginTop: 4, fontWeight: '600' }]}>
                  {rec.weight === 0
                    ? `Bodyweight × ${rec.reps}`
                    : `${fmtWeight(rec.weight)} kg × ${rec.reps}`}
                </Text>
              </M3Card>

            ) : (
              /* Compact Subtle Unrecorded Row */
              <View
                style={[
                  styles.m3EmptyExerciseRow,
                  {
                    backgroundColor: m3.surfaceContainerLowest,
                    borderColor: m3.outlineVariant,
                  },
                ]}
              >
                <View>
                  <Text style={[m3Type.titleSmall, { color: m3.onSurface }]}>
                    {ex}
                  </Text>
                  <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
                    No record set
                  </Text>
                </View>

                <View style={[styles.m3TonalChip, { backgroundColor: m3.surfaceContainerHighest }]}>
                  <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>
                    + LOG
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}

      <EditLiftModal
        visible={!!editingExercise}
        exercise={editingExercise}
        currentRecord={editingExercise ? maxLifts?.[editingExercise] ?? null : null}
        onClose={() => setEditingExercise(null)}
        onSaved={load}
      />
    </ScrollView>
  );
}


// ============================================================================
// 3. FASTING MODULE (Material 3 Expressive)
// ============================================================================

function FastCalendar({
  fasts,
  onSelectFast,
}: {
  fasts: Fast[];
  onSelectFast: (fast: Fast) => void;
}) {
  const m3 = useM3Theme();
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const days = getPast7Days(offsetWeeks);
  const dateRangeLabel = formatDateRange(days);

  const dayData = days.map((d) => {
    const { totalHours, fasts: dayFasts, primaryFast } = getFastingForDay(d, fasts);
    return {
      date: d,
      hours: totalHours,
      fasts: dayFasts,
      primaryFast,
    };
  });

  const fastingDays = dayData.filter((d) => d.hours > 0);
  const totalWeekHours = dayData.reduce((sum, d) => sum + d.hours, 0);
  const avgHours = fastingDays.length > 0 ? totalWeekHours / fastingDays.length : 0;
  const avgText = fastingDays.length > 0 ? formatHM(avgHours * 3600000) : '--';

  const maxDayHours = Math.max(...dayData.map((d) => d.hours), 0);
  const maxY = maxDayHours > 24 ? Math.ceil(maxDayHours / 6) * 6 : 24;
  const yTicks = [maxY, Math.round(maxY * 0.66), Math.round(maxY * 0.33), 0];

  const BAR_AREA_HEIGHT = 130;

  return (
    <M3Card shape="extraLarge" style={{ marginBottom: 20 }}>
      {/* Header with Average and Date Range Navigation */}
      <View style={styles.m3CalendarHeader}>
        <View>
          <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant }]}>Daily Average</Text>
          <Text style={[m3Type.headlineLarge, { color: m3.onSurface }]}>{avgText}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <M3Pressable
            onPress={() => setOffsetWeeks((w) => w - 1)}
            hitSlop={10}
            scaleTo={0.92}
            style={[styles.m3IconNavBtn, { backgroundColor: m3.surfaceContainerHighest }]}
          >
            <Text style={{ color: m3.onSurface, fontSize: 18, fontWeight: '700' }}>‹</Text>
          </M3Pressable>
          <Text style={[m3Type.titleSmall, { color: m3.onSurface, marginHorizontal: 4 }]}>
            {dateRangeLabel}
          </Text>
          <M3Pressable
            onPress={() => setOffsetWeeks((w) => Math.min(0, w + 1))}
            disabled={offsetWeeks >= 0}
            hitSlop={10}
            scaleTo={0.92}
            style={[
              styles.m3IconNavBtn,
              {
                backgroundColor: m3.surfaceContainerHighest,
                opacity: offsetWeeks >= 0 ? 0.35 : 1,
              },
            ]}
          >
            <Text style={{ color: m3.onSurface, fontSize: 18, fontWeight: '700' }}>›</Text>
          </M3Pressable>
        </View>
      </View>

      {/* Chart Section */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 16 }}>
        {/* Y-Axis Labels */}
        <View
          style={{
            width: 28,
            height: BAR_AREA_HEIGHT,
            marginTop: 20,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {yTicks.map((tick, i) => (
            <Text
              key={i}
              style={{
                fontSize: 10,
                color: m3.onSurfaceVariant,
                fontWeight: '600',
              }}
            >
              {tick}h
            </Text>
          ))}
        </View>

        {/* 7-Day Vertical Bars */}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
          {dayData.map((d, i) => {
            const barHeight =
              d.hours > 0
                ? Math.min(BAR_AREA_HEIGHT, Math.max(8, (d.hours / maxY) * BAR_AREA_HEIGHT))
                : 0;
            const barColor = hoursToM3Color(d.hours, m3.surfaceContainerHighest, m3);
            const dateStr = `${d.date.getMonth() + 1}/${d.date.getDate()}`;

            return (
              <Pressable
                key={i}
                onPress={() => {
                  if (d.primaryFast) {
                    onSelectFast(d.primaryFast);
                  }
                }}
                disabled={!d.primaryFast}
                style={{ flex: 1, alignItems: 'center' }}
              >
                {/* Duration above bar */}
                <View style={{ height: 20, justifyContent: 'center', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: d.hours > 0 ? '700' : '500',
                      color: d.hours > 0 ? m3.onSurface : m3.onSurfaceVariant,
                    }}
                  >
                    {d.hours > 0 ? `${Math.round(d.hours)}h` : '0h'}
                  </Text>
                </View>

                {/* Vertical Bar & Track */}
                <View
                  style={{
                    height: BAR_AREA_HEIGHT,
                    width: 16,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: m3.outlineVariant,
                    }}
                  />

                  {/* Filled bar pill */}
                  {d.hours > 0 && (
                    <View
                      style={{
                        width: 14,
                        height: barHeight,
                        borderRadius: 7,
                        backgroundColor: barColor,
                      }}
                    />
                  )}
                </View>

                {/* Date label under bar */}
                <Text
                  style={{
                    fontSize: 11,
                    color: m3.onSurfaceVariant,
                    marginTop: 6,
                    fontWeight: '600',
                  }}
                >
                  {dateStr}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.m3LegendRow}>
        <View style={styles.m3LegendItem}>
          <View style={[styles.m3LegendDot, { backgroundColor: m3.fastingUnder12 }]} />
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>&lt;12h</Text>
        </View>
        <View style={styles.m3LegendItem}>
          <View style={[styles.m3LegendDot, { backgroundColor: m3.fasting12to16 }]} />
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>12–16h</Text>
        </View>
        <View style={styles.m3LegendItem}>
          <View style={[styles.m3LegendDot, { backgroundColor: m3.fasting16to24 }]} />
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>16–24h</Text>
        </View>
        <View style={styles.m3LegendItem}>
          <View style={[styles.m3LegendDot, { backgroundColor: m3.fasting24plus }]} />
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>24h+</Text>
        </View>
      </View>
    </M3Card>

  );
}

function StartFastModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState(new Date());

  useEffect(() => {
    if (visible) setStartTime(new Date());
  }, [visible]);

  async function handleStart() {
    await startFast(startTime.toISOString());
    onSaved();
    onClose();
  }

  return (
    <M3BottomSheet visible={visible} title="Start Fast" onClose={onClose}>
      <DateTimeField
        label="Start Time"
        value={startTime}
        onChange={setStartTime}
        maximumDate={new Date()}
      />
      <View style={{ marginTop: 24 }}>
        <M3FilledButton label="Begin Fast" onPress={handleStart} />
      </View>
    </M3BottomSheet>
  );
}

function ManualFastModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState(new Date(Date.now() - 16 * 3600000));
  const [endTime, setEndTime] = useState(new Date());

  useEffect(() => {
    if (visible) {
      setStartTime(new Date(Date.now() - 16 * 3600000));
      setEndTime(new Date());
    }
  }, [visible]);

  async function handleSave() {
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert('Invalid fast', 'End time must be after start time.');
      return;
    }
    await insertManualFast(startTime.toISOString(), endTime.toISOString());
    onSaved();
    onClose();
  }

  return (
    <M3BottomSheet visible={visible} title="Enter Past Fast" onClose={onClose}>
      <DateTimeField
        label="Start Time"
        value={startTime}
        onChange={setStartTime}
        maximumDate={new Date()}
      />
      <DateTimeField
        label="End Time"
        value={endTime}
        onChange={setEndTime}
        maximumDate={new Date()}
      />
      <View style={{ marginTop: 24 }}>
        <M3FilledButton label="Save Fast" onPress={handleSave} />
      </View>
    </M3BottomSheet>
  );
}

function EndFastModal({
  visible,
  fast,
  onClose,
  onSaved,
}: {
  visible: boolean;
  fast: Fast;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [endTime, setEndTime] = useState(new Date());

  useEffect(() => {
    if (visible) setEndTime(new Date());
  }, [visible]);

  async function handleEnd() {
    await endFast(fast.id, endTime.toISOString());
    onSaved();
    onClose();
  }

  return (
    <M3BottomSheet visible={visible} title="End Active Fast" onClose={onClose}>
      <DateTimeField
        label="End Time"
        value={endTime}
        onChange={setEndTime}
        maximumDate={new Date()}
      />
      <View style={{ marginTop: 24 }}>
        <M3FilledButton label="End Fast" onPress={handleEnd} />
      </View>
    </M3BottomSheet>
  );
}

function EditFastModal({
  visible,
  fast,
  onClose,
  onSaved,
}: {
  visible: boolean;
  fast: Fast | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());

  useEffect(() => {
    if (visible && fast) {
      setStartTime(new Date(fast.start_time));
      setEndTime(fast.end_time ? new Date(fast.end_time) : new Date());
    }
  }, [visible, fast]);

  async function handleSave() {
    if (!fast) return;
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert('Invalid fast', 'End time must be after start time.');
      return;
    }
    await updateFast(fast.id, startTime.toISOString(), endTime.toISOString());
    onSaved();
    onClose();
  }

  function handleDelete() {
    if (!fast) return;
    Alert.alert('Delete fast?', 'This fast record will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFast(fast.id);
          onSaved();
          onClose();
        },
      },
    ]);
  }

  if (!fast) return null;

  return (
    <M3BottomSheet visible={visible} title="Edit Fast Record" onClose={onClose}>
      <DateTimeField
        label="Start Time"
        value={startTime}
        onChange={setStartTime}
        maximumDate={new Date()}
      />
      <DateTimeField
        label="End Time"
        value={endTime}
        onChange={setEndTime}
        maximumDate={new Date()}
      />
      <View style={{ marginTop: 24, gap: 12 }}>
        <M3FilledButton label="Save Changes" onPress={handleSave} />
        <M3ErrorButton label="Delete Fast" onPress={handleDelete} />
      </View>
    </M3BottomSheet>
  );
}

export function FastingScreen() {
  const m3 = useM3Theme();
  const [activeFast, setActiveFastState] = useState<Fast | null>(null);
  const [history, setHistory] = useState<Fast[]>([]);
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<Fast | null>(null);
  const [showStartFast, setShowStartFast] = useState(false);
  const [showManualFast, setShowManualFast] = useState(false);
  const [showEndFast, setShowEndFast] = useState(false);

  const load = useCallback(async () => {
    setActiveFastState(await getActiveFast());
    setHistory(await getFastHistory());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeFast) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeFast]);

  const elapsed = activeFast ? now - new Date(activeFast.start_time).getTime() : 0;

  return (
    <ScrollView
      style={{ backgroundColor: m3.surface }}
      contentContainerStyle={styles.m3ScreenPad}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.m3TitleRow}>
        <View>
          <Text style={[m3Type.headlineLarge, { color: m3.onSurface }]}>Fasting</Text>
        </View>
      </View>

      {/* Hero Active / Inactive Fast Card */}
      <M3Card shape="extraLarge" style={{ marginBottom: 20 }}>
        {activeFast ? (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.m3StatusBadge, { backgroundColor: m3.primaryContainer }]}>
              <Text style={[m3Type.labelSmall, { color: m3.onPrimaryContainer }]}>
                ● ACTIVE FAST
              </Text>
            </View>

            <Text style={[styles.m3TimerText, { color: m3.onSurface }]}>
              {formatHMS(elapsed)}
            </Text>

            <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginBottom: 20 }]}>
              Started {formatTime(activeFast.start_time)}
            </Text>

            <M3FilledButton
              label="End Fast"
              onPress={() => setShowEndFast(true)}
              style={{ width: '100%' }}
            />
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.m3StatusBadge, { backgroundColor: m3.surfaceContainerHighest }]}>
              <Text style={[m3Type.labelSmall, { color: m3.onSurfaceVariant }]}>
                NOT FASTING
              </Text>
            </View>

            <View style={{ height: 16 }} />

            <M3FilledButton
              label="Start Fast"
              onPress={() => setShowStartFast(true)}
              style={{ width: '100%', marginBottom: 10 }}
            />
            <M3TonalButton
              label="Enter fast manually"
              onPress={() => setShowManualFast(true)}
              style={{ width: '100%' }}
            />
          </View>
        )}
      </M3Card>

      <FastCalendar fasts={history} onSelectFast={setEditing} />

      <Text style={[m3Type.titleLarge, { color: m3.onSurface, marginBottom: 12, marginTop: 8 }]}>
        History
      </Text>
      {history.length === 0 ? (
        <View style={styles.m3EmptyWrap}>
          <Text style={[m3Type.bodyMedium, { color: m3.onSurfaceVariant }]}>No fasts recorded yet</Text>
        </View>
      ) : (
        history.map((f) => (
          <Pressable key={f.id} onPress={() => setEditing(f)}>
            <View style={[styles.m3ListRow, { backgroundColor: m3.surfaceContainerLow }]}>
              <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
                {f.end_time
                  ? formatHM(new Date(f.end_time).getTime() - new Date(f.start_time).getTime())
                  : ''}
              </Text>
              <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant }]}>
                {formatShortDate(f.start_time)}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <StartFastModal
        visible={showStartFast}
        onClose={() => setShowStartFast(false)}
        onSaved={load}
      />
      <ManualFastModal
        visible={showManualFast}
        onClose={() => setShowManualFast(false)}
        onSaved={load}
      />
      {activeFast && (
        <EndFastModal
          visible={showEndFast}
          fast={activeFast}
          onClose={() => setShowEndFast(false)}
          onSaved={load}
        />
      )}
      <EditFastModal
        visible={!!editing}
        fast={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  m3ScreenPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  m3TitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  m3ActionPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  m3RangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  m3IconNavBtn: {
    width: 32,
    height: 32,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  m3ListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: m3Shape.large,
    marginBottom: 8,
  },
  m3ExerciseHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  m3EmptyExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: m3Shape.large,
    borderWidth: 1,
    marginBottom: 10,
  },
  m3TonalChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: m3Shape.small,
  },
  m3StatusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: m3Shape.full,
    marginBottom: 12,
  },
  m3TimerText: {
    fontSize: 46,
    fontWeight: '300',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
    marginVertical: 6,
  },
  m3CalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  m3LegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  m3LegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  m3LegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  m3ModalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  m3Sheet: {
    borderTopLeftRadius: m3Shape.extraLarge,
    borderTopRightRadius: m3Shape.extraLarge,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  m3DragHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.4,
  },
  m3SheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  m3CloseBtn: {
    width: 32,
    height: 32,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  m3TextInput: {
    height: 52,
    borderRadius: m3Shape.medium,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  m3DateField: {
    height: 52,
    borderRadius: m3Shape.medium,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  m3EmptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});