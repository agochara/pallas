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
import { useTheme, spacing, radius, type, Colors } from '../themes/theme';
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

// ---------- formatting helpers ----------

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long' }).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFull(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${formatTime(iso)}`;
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
  return Number.isInteger(w) ? `${w}` : `${w}`;
}

// ---------- date / calendar helpers ----------

function getDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function getFastsForDay(d: Date, fasts: Fast[]): Fast[] {
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
  const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();

  return fasts.filter((f) => {
    if (!f.end_time) return false;
    const endMs = new Date(f.end_time).getTime();
    return endMs >= startOfDay && endMs <= endOfDay;
  });
}

const LIGHT_GREEN: [number, number, number] = [168, 230, 161];
const MID_GREEN: [number, number, number] = [56, 142, 60];
const BLUE: [number, number, number] = [66, 133, 244];

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): string {
  return `rgb(${lerp(c1[0], c2[0], t)}, ${lerp(c1[1], c2[1], t)}, ${lerp(c1[2], c2[2], t)})`;
}

// Below 12h stays grey (emptyColor). 12h-16h ramps light->mid green,
// 16h-24h ramps mid green->blue, 24h+ is solid blue.
function hoursToColor(hours: number, emptyColor: string): string {
  if (hours < 12) return emptyColor;
  if (hours >= 24) return `rgb(${BLUE.join(',')})`;
  if (hours < 16) {
    const t = (hours - 12) / 4;
    return lerpColor(LIGHT_GREEN, MID_GREEN, t);
  }
  const t = (hours - 16) / 8;
  return lerpColor(MID_GREEN, BLUE, t);
}

// ---------- shared bits ----------

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const c = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.card, borderRadius: radius.md, padding: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: c.accent,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[type.bodyMedium, { color: c.accentText }]}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { borderColor: c.separator, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[type.bodyMedium, { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}

function DangerButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { borderColor: '#D9534F', opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[type.bodyMedium, { color: '#D9534F' }]}>{label}</Text>
    </Pressable>
  );
}

function EmptyState({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
      <Text style={[type.body, { color: c.textSecondary }]}>{text}</Text>
    </View>
  );
}

// A tappable date + time pair backed by the native picker. Android shows
// each as its own dialog on tap; iOS shows an inline/spinner picker below.
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
  const c = useTheme();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[type.caption, { color: c.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
        <Pressable
          onPress={() => setShowDate(true)}
          style={[styles.dateChip, { borderColor: c.separator }]}
        >
          <Text style={[type.body, { color: c.text }]}>
            {value.toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowTime(true)}
          style={[styles.dateChip, { borderColor: c.separator, marginLeft: spacing.sm }]}
        >
          <Text style={[type.body, { color: c.text }]}>
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

// ---------- Weight Screen ----------

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

function formatDisplayDate(dateStr: string): string {
  const clean = dateStr.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);
  return dateObj.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  const c = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const clean = (value || formatDateToIso(new Date())).slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const dateObj = new Date(y, (m || 1) - 1, d || 1);

  return (
    <View style={{ marginTop: spacing.md }}>
      <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <Pressable
        onPress={() => setShowPicker(true)}
        style={[styles.dateChip, { borderColor: c.separator, alignItems: 'flex-start' }]}
      >
        <Text style={[type.body, { color: c.text }]}>
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
  const c = useTheme();
  const [chartWidth, setChartWidth] = useState(320);

  const chartHeight = 180;
  const padLeft = 14;
  const padRight = 36;
  const padTop = 16;
  const padBottom = 26;

  const drawWidth = Math.max(100, chartWidth - padLeft - padRight);
  const drawHeight = chartHeight - padTop - padBottom;
  const timeSpan = window.endMs - window.startMs || 1;

  // Filter entries in this window and map timestamps continuously
  const inWindow = entries
    .filter((e) => {
      const t = parseDateStringToMs(e.date);
      return t >= window.startMs && t <= window.endMs;
    })
    .sort((a, b) => parseDateStringToMs(a.date) - parseDateStringToMs(b.date));

  // Determine Y-scale range
  const weightsInWindow = inWindow.map((e) => e.weight);
  const rawMin = weightsInWindow.length > 0 ? Math.min(...weightsInWindow) : 70;
  const rawMax = weightsInWindow.length > 0 ? Math.max(...weightsInWindow) : 80;
  const pad = Math.max(2, (rawMax - rawMin) * 0.2);
  const minW = Math.floor(rawMin - pad);
  const maxW = Math.ceil(rawMax + pad);
  const yRange = maxW - minW || 1;

  // Continuous time mapping: screen coordinates proportional to real date
  const mappedPoints = inWindow.map((e) => {
    const t = parseDateStringToMs(e.date);
    const xPct = Math.max(0, Math.min(1, (t - window.startMs) / timeSpan));
    const x = padLeft + xPct * drawWidth;
    const y = padTop + ((maxW - e.weight) / yRange) * drawHeight;
    return { x, y, entry: e };
  });

  const polylinePoints = mappedPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Y-axis ticks on the right
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
        {/* Horizontal gridlines & Y-axis labels */}
        {yTicks.map((tick, i) => (
          <G key={i}>
            <Line
              x1={padLeft}
              y1={tick.y}
              x2={chartWidth - padRight}
              y2={tick.y}
              stroke={c.separator}
              strokeDasharray={i === yTicks.length - 1 ? undefined : '3,4'}
              strokeWidth={i === yTicks.length - 1 ? '1.5' : '1'}
              opacity={0.6}
            />
            <SvgText
              x={chartWidth - padRight + 6}
              y={tick.y + 4}
              fill={c.textSecondary}
              fontSize="10"
              textAnchor="start"
              fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
            >
              {tick.value}
            </SvgText>
          </G>
        ))}

        {/* Continuous Time-Series Line */}
        {mappedPoints.length >= 2 && (
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={c.accent}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data Point Dots */}
        {mappedPoints.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={mappedPoints.length > 30 ? 2.5 : 4}
            fill={c.card}
            stroke={c.accent}
            strokeWidth="2"
          />
        ))}

        {/* Adaptive X-Axis Labels positioned continuously by timestamp */}
        {window.ticks.map((tick, i) => {
          const xPct = Math.max(0, Math.min(1, (tick.timeMs - window.startMs) / timeSpan));
          const x = padLeft + xPct * drawWidth;
          return (
            <SvgText
              key={i}
              x={x}
              y={chartHeight - 6}
              fill={c.textSecondary}
              fontSize="10"
              textAnchor="middle"
              fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
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
  const c = useTheme();
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>Log Weight</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.sm }]}>
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            placeholder="e.g. 78.5"
            placeholderTextColor={c.textSecondary}
            keyboardType="decimal-pad"
            autoFocus
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />

          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
          />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="SAVE WEIGHT" onPress={handleSave} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const c = useTheme();
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>Edit Weight</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.sm }]}>
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />

          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
          />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="SAVE" onPress={handleSave} />
            <View style={{ height: spacing.sm }} />
            <DangerButton label="DELETE MEASUREMENT" onPress={handleDelete} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function WeightScreen() {
  const c = useTheme();
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

  // Filter entries within the current window
  const inWindow = weights
    .filter((e) => {
      const t = parseDateStringToMs(e.date);
      return t >= window.startMs && t <= window.endMs;
    })
    .sort((a, b) => parseDateStringToMs(a.date) - parseDateStringToMs(b.date));

  // Metrics for period
  const avgWeight =
    inWindow.length > 0
      ? inWindow.reduce((s, e) => s + e.weight, 0) / inWindow.length
      : null;

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
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      {/* Title & Log Button Row */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Text style={[type.largeTitle, { color: c.text }]}>Weight</Text>
        <Pressable
          onPress={() => setShowAdd(true)}
          style={({ pressed }) => [
            {
              backgroundColor: c.accent,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: radius.sm,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[type.caption, { color: c.accentText, fontWeight: '700' }]}>+ LOG</Text>
        </Pressable>
      </View>

      {/* Main Chart Card */}
      <Card style={{ marginBottom: spacing.lg }}>
        {/* Time Range Pills: W | M | 3M | Y */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: c.surface,
            borderRadius: radius.sm,
            padding: 3,
            marginBottom: spacing.md,
          }}
        >
          {RANGES.map((r) => {
            const active = timeRange === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => {
                  setTimeRange(r.key);
                  setRangeOffset(0);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 6,
                  alignItems: 'center',
                  backgroundColor: active ? c.accent : 'transparent',
                  borderRadius: 6,
                }}
              >
                <Text
                  style={[
                    type.caption,
                    {
                      color: active ? c.accentText : c.textSecondary,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Range Header with Prev/Next Controls */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: spacing.sm,
          }}
        >
          <Text style={[type.title, { color: c.text, fontSize: 19, fontWeight: '700' }]}>
            {window.label}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => setRangeOffset((o) => o - 1)}
              hitSlop={10}
              style={{ paddingHorizontal: 6 }}
            >
              <Text style={{ color: c.textSecondary, fontSize: 22, lineHeight: 24 }}>‹</Text>
            </Pressable>
            <Pressable
              onPress={() => setRangeOffset((o) => Math.min(0, o + 1))}
              disabled={rangeOffset >= 0}
              hitSlop={10}
              style={{ paddingHorizontal: 6 }}
            >
              <Text
                style={{
                  color: rangeOffset >= 0 ? c.separator : c.textSecondary,
                  fontSize: 22,
                  lineHeight: 24,
                }}
              >
                ›
              </Text>
            </Pressable>
            {rangeOffset < 0 && (
              <Pressable
                onPress={() => setRangeOffset(0)}
                hitSlop={10}
                style={{ paddingHorizontal: 6 }}
              >
                <Text style={{ color: c.textSecondary, fontSize: 16 }}>↺</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Prominent Metric Display */}
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 32, fontWeight: '700', color: c.text }}>
              {latestGlobalWeight ? latestGlobalWeight.weight.toFixed(1) : '--'}
            </Text>
            <Text style={[type.bodyMedium, { color: c.textSecondary, marginLeft: 4 }]}>
              kg
            </Text>
          </View>
          <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
            {deltaText}
          </Text>
        </View>

        {/* Continuous Time-Series Chart */}
        <WeightTimeSeriesChart
          entries={weights}
          window={window}
          onSelectEntry={setEditing}
        />
      </Card>

      {/* History Section */}
      <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>History</Text>
      {historyDesc.length === 0 ? (
        <EmptyState text="No weight entries recorded yet" />
      ) : (
        historyDesc.map((w) => (
          <Pressable key={w.id} onPress={() => setEditing(w)}>
            <View style={[styles.historyRow, { borderColor: c.separator }]}>
              <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>
                {w.weight} kg
              </Text>
              <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
                {formatDisplayDate(w.date)}
              </Text>
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

// Lets you set a custom start time instead of always defaulting to "now".
function StartFastModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const [start, setStart] = useState(new Date());

  useEffect(() => {
    if (visible) setStart(new Date());
  }, [visible]);

  async function save() {
    await startFast(start.toISOString());
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>Start Fast</Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <DateTimeField
            label="Start time"
            value={start}
            onChange={setStart}
            maximumDate={new Date()}
          />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="START FAST" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const c = useTheme();
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());

  useEffect(() => {
    if (visible) {
      const now = new Date();
      setStart(now);
      setEnd(now);
    }
  }, [visible]);

  async function save() {
    if (end.getTime() <= start.getTime()) {
      Alert.alert('Invalid range', 'End time must be after start time.');
      return;
    }
    await insertManualFast(start.toISOString(), end.toISOString());
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>Enter Fast</Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <DateTimeField label="Start" value={start} onChange={setStart} maximumDate={new Date()} />
          <DateTimeField label="End" value={end} onChange={setEnd} maximumDate={new Date()} />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="SAVE" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const c = useTheme();
  const [end, setEnd] = useState(new Date());

  useEffect(() => {
    if (visible) setEnd(new Date());
  }, [visible]);

  async function save() {
    if (end.getTime() <= new Date(fast.start_time).getTime()) {
      Alert.alert('Invalid time', 'End time must be after the fast started.');
      return;
    }
    await endFast(fast.id, end.toISOString());
    onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>End Fast</Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <DateTimeField label="End time" value={end} onChange={setEnd} maximumDate={new Date()} />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="END FAST" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Edit or delete a completed fast — reached from the calendar or the
// history list, for fixing mistakes after the fact.
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
  const c = useTheme();
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date());

  useEffect(() => {
    if (visible && fast) {
      setStart(new Date(fast.start_time));
      setEnd(new Date(fast.end_time ?? fast.start_time));
    }
  }, [visible, fast]);

  async function save() {
    if (!fast) return;
    if (end.getTime() <= start.getTime()) {
      Alert.alert('Invalid range', 'End time must be after start time.');
      return;
    }
    await updateFast(fast.id, start.toISOString(), end.toISOString());
    onSaved();
    onClose();
  }

  function remove() {
    if (!fast) return;
    Alert.alert(
      'Delete this fast?',
      'This cannot be undone.',
      [
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
      ]
    );
  }

  const durationHours = (end.getTime() - start.getTime()) / 3600000;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>Edit Fast</Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <DateTimeField label="Start" value={start} onChange={setStart} maximumDate={new Date()} />
          <DateTimeField label="End" value={end} onChange={setEnd} maximumDate={new Date()} />

          {durationHours > 0 && (
            <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
              Duration: {formatHM(durationHours * 3600000)}
            </Text>
          )}

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="SAVE" onPress={save} />
            <View style={{ height: spacing.sm }} />
            <DangerButton label="DELETE FAST" onPress={remove} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: spacing.md, marginBottom: spacing.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 4 }} />
      <Text style={[type.caption, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

function FastCalendar({
  fasts,
  onSelectFast,
}: {
  fasts: Fast[];
  onSelectFast: (fast: Fast) => void;
}) {
  const c = useTheme();
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const days = getPast7Days(offsetWeeks);
  const dateRangeLabel = formatDateRange(days);

  // Collect data for each of the 7 days
  const dayData = days.map((d) => {
    const dayFasts = getFastsForDay(d, fasts);
    const totalHours = dayFasts.reduce((sum, f) => {
      const startMs = new Date(f.start_time).getTime();
      const endMs = new Date(f.end_time!).getTime();
      return sum + Math.max(0, (endMs - startMs) / 3600000);
    }, 0);
    const primaryFast = dayFasts[0] ?? null;
    return {
      date: d,
      hours: totalHours,
      fasts: dayFasts,
      primaryFast,
    };
  });

  // Calculate average for the week across completed fasts
  const allWeekFasts = dayData.flatMap((d) => d.fasts);
  const totalWeekHours = dayData.reduce((sum, d) => sum + d.hours, 0);
  const avgHours = allWeekFasts.length > 0 ? totalWeekHours / allWeekFasts.length : 0;
  const avgText = allWeekFasts.length > 0 ? formatHM(avgHours * 3600000) : '--';

  // Calculate Y-axis scaling
  const maxDayHours = Math.max(...dayData.map((d) => d.hours), 0);
  const maxY = maxDayHours > 24 ? Math.ceil(maxDayHours / 6) * 6 : 24;
  const yTicks = [maxY, Math.round(maxY * 0.66), Math.round(maxY * 0.33), 0];

  const BAR_AREA_HEIGHT = 130;

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      {/* Header with Average and Date Range Navigation */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <View>
          <Text style={[type.caption, { color: c.textSecondary, marginBottom: 2 }]}>
            Average
          </Text>
          <Text style={{ color: c.text, fontSize: 26, fontWeight: '700' }}>
            {avgText}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4 }}>
          <Pressable
            onPress={() => setOffsetWeeks((w) => w - 1)}
            hitSlop={10}
            style={{ paddingHorizontal: 4 }}
          >
            <Text style={{ color: c.textSecondary, fontSize: 22, lineHeight: 24 }}>‹</Text>
          </Pressable>
          <Text style={[type.bodyMedium, { color: c.text, fontWeight: '600', marginHorizontal: 4 }]}>
            {dateRangeLabel}
          </Text>
          <Pressable
            onPress={() => setOffsetWeeks((w) => Math.min(0, w + 1))}
            disabled={offsetWeeks >= 0}
            hitSlop={10}
            style={{ paddingHorizontal: 4 }}
          >
            <Text
              style={{
                color: offsetWeeks >= 0 ? c.separator : c.textSecondary,
                fontSize: 22,
                lineHeight: 24,
              }}
            >
              ›
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Chart Section */}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: spacing.md }}>
        {/* Y-Axis Labels */}
        <View
          style={{
            width: 28,
            height: BAR_AREA_HEIGHT,
            marginTop: 20,
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingRight: 4,
          }}
        >
          {yTicks.map((tick, i) => (
            <Text
              key={i}
              style={{
                fontSize: 10,
                color: c.textSecondary,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
              d.hours > 0 ? Math.min(BAR_AREA_HEIGHT, Math.max(6, (d.hours / maxY) * BAR_AREA_HEIGHT)) : 0;
            const barColor = hoursToColor(d.hours, c.separator);
            const dateStr = `${d.date.getMonth() + 1}/${d.date.getDate() < 10 ? '0' : ''}${d.date.getDate()}`;

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
                      fontWeight: d.hours > 0 ? '700' : '400',
                      color: d.hours > 0 ? c.text : c.textSecondary,
                    }}
                  >
                    {d.hours > 0 ? `${Math.round(d.hours)}h` : '0h'}
                  </Text>
                </View>

                {/* Vertical Bar & Background Track */}
                <View
                  style={{
                    height: BAR_AREA_HEIGHT,
                    width: 14,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  {/* Full height vertical track guideline */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: 1.5,
                      backgroundColor: c.separator,
                      opacity: 0.35,
                    }}
                  />

                  {/* Filled bar pill */}
                  {d.hours > 0 && (
                    <View
                      style={{
                        width: 10,
                        height: barHeight,
                        borderRadius: 5,
                        backgroundColor: barColor,
                      }}
                    />
                  )}
                </View>

                {/* Date label under bar */}
                <Text
                  style={{
                    fontSize: 11,
                    color: c.textSecondary,
                    marginTop: 6,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
      <View
        style={{
          flexDirection: 'row',
          marginTop: spacing.sm,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <LegendDot color={c.separator} label="< 12h" />
        <LegendDot color="rgb(168, 230, 161)" label="12h+" />
        <LegendDot color="rgb(56, 142, 60)" label="16h+" />
        <LegendDot color="rgb(66, 133, 244)" label="24h+" />
      </View>
    </Card>
  );
}

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
  const c = useTheme();
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
      `Clear the max lift record for ${exercise}?`,
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>
              {exercise.toUpperCase()}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.sm }]}>
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />

          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
            Reps
          </Text>
          <TextInput
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />

          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="SAVE" onPress={handleSave} />
            {currentRecord && (
              <View style={{ marginTop: spacing.sm }}>
                <DangerButton label="CLEAR RECORD" onPress={handleDelete} />
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Strength Screen ----------

export function StrengthScreen() {
  const c = useTheme();
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

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      <Text
        style={[
          type.largeTitle,
          {
            color: c.text,
            marginBottom: spacing.lg,
          },
        ]}
      >
        Strength
      </Text>

      {EXERCISES.map((ex) => {
        const rec = maxLifts?.[ex];

        return (
          <Pressable key={ex} onPress={() => setEditingExercise(ex)}>
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[type.title, { color: c.text }]}>
                  {ex.toUpperCase()}
                </Text>
                <Text style={[type.caption, { color: c.textSecondary }]}>Edit ›</Text>
              </View>

              {rec ? (
                <Text
                  style={[
                    type.body,
                    {
                      color: c.text,
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  {rec.weight === 0
                    ? `Bodyweight × ${rec.reps}`
                    : `${fmtWeight(rec.weight)} kg × ${rec.reps}`}
                </Text>
              ) : (
                <Text
                  style={[
                    type.caption,
                    {
                      color: c.textSecondary,
                      marginTop: spacing.xs,
                    },
                  ]}
                >
                  No record yet · Tap to set
                </Text>
              )}
            </Card>
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

export const LiftsScreen = StrengthScreen;

// ---------- Fasting Screen ----------

export function FastingScreen() {
  const c = useTheme();
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
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      <Text style={[type.largeTitle, { color: c.text, marginBottom: spacing.lg }]}>Fasting</Text>

      <Card style={{ marginBottom: spacing.lg }}>
        {activeFast ? (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.caption, { color: c.textSecondary }]}>FASTING</Text>
            <Text style={[type.monoLarge, { color: c.text, marginVertical: spacing.sm }]}>
              {formatHMS(elapsed)}
            </Text>
            <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.md }]}>
              Started {formatTime(activeFast.start_time)}
            </Text>
            <PrimaryButton label="   END FAST   " onPress={() => setShowEndFast(true)} />
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.md }]}>
              NOT FASTING
            </Text>
            <PrimaryButton label="    START FAST    " onPress={() => setShowStartFast(true)} />
            <View style={{ height: spacing.sm }} />
            <SecondaryButton label="Enter fast manually" onPress={() => setShowManualFast(true)} />
          </View>
        )}
      </Card>

      <FastCalendar fasts={history} onSelectFast={setEditing} />

      <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>History</Text>
      {history.length === 0 ? (
        <EmptyState text="No fasts recorded yet" />
      ) : (
        history.map((f) => (
          <Pressable key={f.id} onPress={() => setEditing(f)}>
            <View style={[styles.historyRow, { borderColor: c.separator }]}>
              <Text style={[type.body, { color: c.text }]}>
                {f.end_time
                  ? formatHM(new Date(f.end_time).getTime() - new Date(f.start_time).getTime())
                  : ''}
              </Text>
              <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
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

// ---------- styles ----------

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: spacing.lg,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  exerciseRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 17,
    marginTop: spacing.xs,
  },
  dateChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flex: 1,
    alignItems: 'center',
  },
  historyRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  detailCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
});