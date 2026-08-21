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
import { useTheme, spacing, radius, type, Colors } from './theme';
import {
  Exercise,
  EXERCISES,
  LiftRecord,
  Fast,
  insertLift,
  getActiveFast,
  startFast,
  endFast,
  insertManualFast,
  updateFast,
  deleteFast,
  getFastHistory,
  getMaxLift,
  deleteAllLifts,
  deleteAllFasts,
  deleteEverything,
} from './db';
import { exportFitLog, importFitLog } from './export';

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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayFloor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((dayFloor(b).getTime() - dayFloor(a).getTime()) / 86400000);
}

type GridCell = { date: Date; inMonth: boolean };

// Builds a 7-wide grid of full weeks covering the month, using real dates
// (not nulls) for the lead-in/trail-off days so fast spans that touch the
// edge of the month still render correctly on those cells.
function buildMonthGrid(month: Date): GridCell[][] {
  const first = startOfMonth(month);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

  const gridStart = new Date(first);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  const cells: GridCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
  }

  const weeks: GridCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

type FastSpan = { startDay: Date; endDay: Date; hours: number; fast: Fast };

// A fast's pill covers every whole calendar day it touches, from the day it
// started to the day it ended — the full duration is the pill's duration,
// never split or summed with anything else (a moment-at-midnight end doesn't
// count as touching that day).
function fastSpanOf(fast: Fast): FastSpan | null {
  if (!fast.end_time) return null;
  const start = new Date(fast.start_time);
  const end = new Date(fast.end_time);
  const hours = (end.getTime() - start.getTime()) / 3600000;
  if (hours <= 0) return null;
  const lastTouched = new Date(end.getTime() - 1);
  return { startDay: dayFloor(start), endDay: dayFloor(lastTouched), hours, fast };
}

function buildFastSpans(fasts: Fast[]): FastSpan[] {
  const spans: FastSpan[] = [];
  for (const f of fasts) {
    const span = fastSpanOf(f);
    if (span) spans.push(span);
  }
  return spans;
}

type WeekSegment = { colStart: number; colEnd: number; hours: number; fast: Fast; lane: number };

// Clips each span to the columns (0-6) it occupies within this specific week.
function segmentsForWeek(weekDates: Date[], spans: FastSpan[]): Omit<WeekSegment, 'lane'>[] {
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const segs: Omit<WeekSegment, 'lane'>[] = [];
  for (const s of spans) {
    if (s.endDay < weekStart || s.startDay > weekEnd) continue;
    const clampedStart = s.startDay < weekStart ? weekStart : s.startDay;
    const clampedEnd = s.endDay > weekEnd ? weekEnd : s.endDay;
    segs.push({
      colStart: daysBetween(weekStart, clampedStart),
      colEnd: daysBetween(weekStart, clampedEnd),
      hours: s.hours,
      fast: s.fast,
    });
  }
  return segs;
}

// Greedy lane assignment so same-day fasts stack instead of overlapping
// (two fasts rarely touch the same day, but it can happen).
function assignLanes(segs: Omit<WeekSegment, 'lane'>[]): WeekSegment[] {
  const sorted = [...segs].sort((a, b) => a.colStart - b.colStart);
  const laneEnds: number[] = [];
  const result: WeekSegment[] = [];
  for (const seg of sorted) {
    let lane = laneEnds.findIndex((end) => end < seg.colStart);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(seg.colEnd);
    } else {
      laneEnds[lane] = seg.colEnd;
    }
    result.push({ ...seg, lane });
  }
  return result;
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

// ---------- Log Screen ----------

export function LogScreen() {
  const c = useTheme();
  const [activeFast, setActiveFastState] = useState<Fast | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showLiftModal, setShowLiftModal] = useState(false);
  const [showStartFast, setShowStartFast] = useState(false);
  const [showManualFast, setShowManualFast] = useState(false);
  const [showEndFast, setShowEndFast] = useState(false);

  const load = useCallback(async () => {
    setActiveFastState(await getActiveFast());
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
      <Text style={[type.largeTitle, { color: c.text, marginBottom: spacing.lg }]}>Log</Text>

      <Card style={{ marginBottom: spacing.md }}>
        {activeFast ? (
          <View>
            <Text style={[type.caption, { color: c.textSecondary }]}>
              FASTING · started {formatTime(activeFast.start_time)}
            </Text>
            <Text style={[type.monoLarge, { color: c.text, marginVertical: spacing.sm }]}>
              {formatHMS(elapsed)}
            </Text>
            <PrimaryButton label="END FAST" onPress={() => setShowEndFast(true)} />
          </View>
        ) : (
          <View>
            <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>Fast</Text>
            <PrimaryButton label="START FAST" onPress={() => setShowStartFast(true)} />
            <View style={{ height: spacing.sm }} />
            <SecondaryButton label="Enter fast manually" onPress={() => setShowManualFast(true)} />
          </View>
        )}
      </Card>

      <Card>
        <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>Log Lift</Text>
        <PrimaryButton label="LOG LIFT" onPress={() => setShowLiftModal(true)} />
      </Card>

      <LiftModal
        visible={showLiftModal}
        onClose={() => setShowLiftModal(false)}
        onSaved={load}
      />
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
    </ScrollView>
  );
}

function LiftModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [previous, setPrevious] = useState<LiftRecord | null>(null);

  useEffect(() => {
    if (!visible) {
      setExercise(null);
      setWeight('');
      setReps('');
      setPrevious(null);
    }
  }, [visible]);

  async function pick(ex: Exercise) {
    setExercise(ex);
    const prev = await getMaxLift(ex);
    setPrevious(prev);
    setWeight(prev ? `${prev.weight}` : '');
    setReps(prev ? `${prev.reps}` : '');
  }

  async function save() {
    if (!exercise) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r)) return;
    await insertLift(exercise, w, r);
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
            <Text style={[type.title, { color: c.text }]}>
              {exercise ? exercise.toUpperCase() : 'Log Lift'}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          {!exercise ? (
            <View>
              {EXERCISES.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => pick(ex)}
                  style={[styles.exerciseRow, { borderColor: c.separator }]}
                >
                  <Text style={[type.body, { color: c.text }]}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View>
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

              {previous && (
                <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
                  Previous: {fmtWeight(previous.weight)} kg × {previous.reps}
                </Text>
              )}

              <View style={{ marginTop: spacing.lg }}>
                <PrimaryButton label="SAVE" onPress={save} />
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

const PILL_HEIGHT = 26;
const PILL_GAP = 4;
const NUMBER_ROW_HEIGHT = 20;

// One week: a row of day numbers, then a lane area underneath where each
// fast is a single continuous pill spanning every day column it touches
// (clipped to this week if the fast crosses into the next one).
function WeekRow({
  week,
  spans,
  today,
  onSelectFast,
}: {
  week: GridCell[];
  spans: FastSpan[];
  today: Date;
  onSelectFast: (fast: Fast) => void;
}) {
  const c = useTheme();
  const weekDates = week.map((cell) => cell.date);
  const segs = assignLanes(segmentsForWeek(weekDates, spans));
  const laneCount = segs.length === 0 ? 1 : Math.max(...segs.map((s) => s.lane + 1));
  const lanesHeight = laneCount * PILL_HEIGHT + (laneCount - 1) * PILL_GAP;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', height: NUMBER_ROW_HEIGHT }}>
        {week.map((cell, i) => {
          const isToday = isSameDay(cell.date, today);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={
                  isToday
                    ? { backgroundColor: c.accent, borderRadius: 9, paddingHorizontal: 6 }
                    : undefined
                }
              >
                <Text
                  style={[
                    type.caption,
                    {
                      color: isToday ? c.accentText : c.text,
                      opacity: cell.inMonth ? 1 : 0.35,
                    },
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ height: lanesHeight, marginTop: 4 }}>
        {segs.map((seg, i) => {
          const leftPct = (seg.colStart / 7) * 100;
          const widthPct = ((seg.colEnd - seg.colStart + 1) / 7) * 100;
          const bg = hoursToColor(seg.hours, c.separator);
          return (
            <Pressable
              key={i}
              onPress={() => onSelectFast(seg.fast)}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                width: `${widthPct}%`,
                top: seg.lane * (PILL_HEIGHT + PILL_GAP),
                height: PILL_HEIGHT,
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: bg,
                  borderRadius: PILL_HEIGHT / 2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={[type.caption, { color: '#fff', fontWeight: '600' }]}
                  numberOfLines={1}
                >
                  {Math.round(seg.hours)}h
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Month view, Zero-style: fasts render as spanning pills across the days
// they touch rather than tinting a single cell.
function FastCalendar({
  fasts,
  onSelectFast,
}: {
  fasts: Fast[];
  onSelectFast: (fast: Fast) => void;
}) {
  const c = useTheme();
  const [month, setMonth] = useState(startOfMonth(new Date()));

  const weeks = buildMonthGrid(month);
  const spans = buildFastSpans(fasts);
  const today = new Date();

  const monthHours = spans
    .filter(
      (s) =>
        s.startDay.getFullYear() === month.getFullYear() &&
        s.startDay.getMonth() === month.getMonth()
    )
    .reduce((sum, s) => sum + s.hours, 0);

  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Pressable onPress={() => setMonth(addMonths(month, -1))} hitSlop={8}>
          <Text style={[type.title, { color: c.text }]}>‹</Text>
        </Pressable>
        <Text style={[type.body, { color: c.text, fontWeight: '600' }]}>
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => setMonth(addMonths(month, 1))} hitSlop={8}>
          <Text style={[type.title, { color: c.text }]}>›</Text>
        </Pressable>
      </View>

      <Text
        style={[
          type.caption,
          { color: c.textSecondary, textAlign: 'right', marginBottom: spacing.xs },
        ]}
      >
        {Math.round(monthHours)}h total
      </Text>

      <View style={{ flexDirection: 'row' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[type.caption, { color: c.textSecondary }]}>{d}</Text>
          </View>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <WeekRow
          key={wi}
          week={week}
          spans={spans}
          today={today}
          onSelectFast={onSelectFast}
        />
      ))}

      <View style={{ flexDirection: 'row', marginTop: spacing.md, flexWrap: 'wrap' }}>
        <LegendDot color={c.separator} label="< 12h" />
        <LegendDot color="rgb(168, 230, 161)" label="12h+" />
        <LegendDot color="rgb(56, 142, 60)" label="16h+" />
        <LegendDot color="rgb(66, 133, 244)" label="24h+" />
      </View>
    </Card>
  );
}

// ---------- Lifts Screen ----------

export function LiftsScreen() {
  const c = useTheme();
  const [maxLifts, setMaxLifts] =
    useState<Record<Exercise, LiftRecord | null> | null>(null);

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
        Lifts
      </Text>

      {EXERCISES.map((ex) => {
        const rec = maxLifts?.[ex];

        return (
          <Card key={ex} style={{ marginBottom: spacing.md }}>
            <Text style={[type.title, { color: c.text }]}>
              {ex.toUpperCase()}
            </Text>

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
                {fmtWeight(rec.weight)} kg × {rec.reps}
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
                No record yet
              </Text>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

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


// ---------- Settings Screen ----------

export function SettingsScreen() {
  const c = useTheme();
  const [working, setWorking] = useState(false);

  async function handleExport() {
    try {
      setWorking(true);
      await exportFitLog();
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleImport() {
    try {
      setWorking(true);

      const imported = await importFitLog();

      if (imported) {
        Alert.alert(
          'Import complete',
          'The backup has been merged with your existing data.'
        );
      }
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Import failed',
        'That file is not a valid FitLog backup.'
      );
    } finally {
      setWorking(false);
    }
  }

  function confirmDelete(
    title: string,
    message: string,
    action: () => Promise<void>
  ) {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setWorking(true);
              await action();

              Alert.alert('Deleted', 'The data has been deleted.');
            } catch (error) {
              console.error(error);

              Alert.alert(
                'Error',
                'Could not delete the data.'
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }

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
        Settings
      </Text>

      <Text
        style={[
          type.caption,
          {
            color: c.textSecondary,
            marginBottom: spacing.sm,
          },
        ]}
      >
        DATA
      </Text>

      <Card style={{ marginBottom: spacing.md }}>
        <Pressable
          onPress={handleExport}
          disabled={working}
          style={{ paddingVertical: spacing.sm }}
        >
          <Text style={[type.body, { color: c.text }]}>
            Export data
          </Text>

          <Text
            style={[
              type.caption,
              {
                color: c.textSecondary,
                marginTop: 3,
              },
            ]}
          >
            Save a backup of your FitLog data
          </Text>
        </Pressable>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Pressable
          onPress={handleImport}
          disabled={working}
          style={{ paddingVertical: spacing.sm }}
        >
          <Text style={[type.body, { color: c.text }]}>
            Import data
          </Text>

          <Text
            style={[
              type.caption,
              {
                color: c.textSecondary,
                marginTop: 3,
              },
            ]}
          >
            Merge a FitLog backup with this device
          </Text>
        </Pressable>
      </Card>

      <Text
        style={[
          type.caption,
          {
            color: c.textSecondary,
            marginBottom: spacing.sm,
          },
        ]}
      >
        DELETE
      </Text>

      <Card style={{ marginBottom: spacing.md }}>
        <Pressable
          onPress={() =>
            confirmDelete(
              'Delete lift history?',
              'All recorded lifts will be permanently deleted.',
              deleteAllLifts
            )
          }
          disabled={working}
          style={{ paddingVertical: spacing.sm }}
        >
          <Text style={[type.body, { color: c.text }]}>
            Delete lift history
          </Text>
        </Pressable>
      </Card>

      <Card style={{ marginBottom: spacing.md }}>
        <Pressable
          onPress={() =>
            confirmDelete(
              'Delete fasting history?',
              'All recorded fasts will be permanently deleted.',
              deleteAllFasts
            )
          }
          disabled={working}
          style={{ paddingVertical: spacing.sm }}
        >
          <Text style={[type.body, { color: c.text }]}>
            Delete fasting history
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Pressable
          onPress={() =>
            confirmDelete(
              'Delete everything?',
              'All lifts and fasting records will be permanently deleted.',
              deleteEverything
            )
          }
          disabled={working}
          style={{ paddingVertical: spacing.sm }}
        >
          <Text style={[type.body, { color: c.text }]}>
            Delete everything
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  screenPad: {
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.xl + spacing.md,
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