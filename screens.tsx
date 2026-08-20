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
import Svg, { Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import { useTheme, spacing, radius, type, Colors } from './theme';
import {
  Exercise,
  EXERCISES,
  LiftRecord,
  Fast,
  HistoryItem,
  insertLift,
  getAllLatestLifts,
  getLatestLift,
  getLiftHistory,
  getActiveFast,
  startFast,
  endFast,
  insertManualFast,
  getFastHistory,
  getUnifiedHistory,
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

function EmptyState({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
      <Text style={[type.body, { color: c.textSecondary }]}>{text}</Text>
    </View>
  );
}

// ---------- Log Screen ----------

export function LogScreen() {
  const c = useTheme();
  const [latest, setLatest] = useState<Record<Exercise, LiftRecord | null> | null>(null);
  const [activeFast, setActiveFastState] = useState<Fast | null>(null);
  const [now, setNow] = useState(Date.now());
  const [showLiftModal, setShowLiftModal] = useState(false);
  const [showManualFast, setShowManualFast] = useState(false);
  const [showEndFast, setShowEndFast] = useState(false);

  const load = useCallback(async () => {
    setLatest(await getAllLatestLifts());
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
            <PrimaryButton
              label="START FAST"
              onPress={async () => {
                await startFast(new Date().toISOString());
                load();
              }}
            />
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
    const prev = await getLatestLift(ex);
    setPrevious(prev);
    setWeight(prev ? `${prev.weight}` : '');
    setReps(prev ? `${prev.reps}` : '');
  }

  async function save() {
    if (!exercise) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r)) return;
    await insertLift(exercise, w, r, new Date().toISOString());
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

              <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
                Note (optional)
              </Text>

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
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  useEffect(() => {
    if (!visible) {
      setStart('');
      setEnd('');
    }
  }, [visible]);

  async function save() {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
    await insertManualFast(s.toISOString(), e.toISOString());
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
          <Text style={[type.caption, { color: c.textSecondary }]}>
            Start (e.g. 2026-08-19 19:00)
          </Text>
          <TextInput
            value={start}
            onChangeText={setStart}
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />
          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
            End (e.g. 2026-08-20 13:00)
          </Text>
          <TextInput
            value={end}
            onChangeText={setEnd}
            placeholder="YYYY-MM-DD HH:MM"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text, borderColor: c.separator }]}
          />
          <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
            Note (optional)
          </Text>
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


  async function save() {
    await endFast(fast.id, new Date().toISOString());
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
          <View style={{ marginTop: spacing.lg }}>
            <PrimaryButton label="END FAST" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Lifts Screen ----------
export function LiftsScreen({ onSelect }: { onSelect: (ex: Exercise) => void }) {
  const c = useTheme();
  const [maxLifts, setMaxLifts] =
    useState<Record<Exercise, LiftRecord | null> | null>(null);

  const load = useCallback(async () => {
    const entries = await Promise.all(
      EXERCISES.map(async (ex) => [ex, await getMaxLift(ex)] as const)
    );

    setMaxLifts(Object.fromEntries(entries) as Record<Exercise, LiftRecord | null>);
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
          { color: c.text, marginBottom: spacing.lg },
        ]}
      >
        Lifts
      </Text>

      {EXERCISES.map((ex) => {
        const rec = maxLifts ? maxLifts[ex] : null;

        return (
          <Pressable key={ex} onPress={() => onSelect(ex)}>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[type.title, { color: c.text }]}>
                {ex.toUpperCase()}
              </Text>

              {rec ? (
                <View style={{ marginTop: spacing.xs }}>
                  <Text style={[type.body, { color: c.text }]}>
                    {fmtWeight(rec.weight)} kg × {rec.reps}
                  </Text>

                  <Text
                    style={[
                      type.caption,
                      {
                        color: c.textSecondary,
                        marginTop: 2,
                      },
                    ]}
                  >
                    {formatShortDate(rec.recorded_at)}
                  </Text>
                </View>
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
                  No records yet
                </Text>
              )}
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------- Lift Detail Screen ----------

export function LiftDetailScreen({ exercise, onBack }: { exercise: Exercise; onBack: () => void }) {
  const c = useTheme();
  const [history, setHistory] = useState<LiftRecord[]>([]);
  const [selected, setSelected] = useState<LiftRecord | null>(null);

  useEffect(() => {
    getLiftHistory(exercise).then(setHistory);
  }, [exercise]);

  const first = history[0];
  const last = history[history.length - 1];
  const delta = first && last ? last.weight - first.weight : 0;

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      <Pressable onPress={onBack} style={{ marginBottom: spacing.md }}>
        <Text style={[type.body, { color: c.textSecondary }]}>← Lifts</Text>
      </Pressable>
      <Text style={[type.largeTitle, { color: c.text, marginBottom: spacing.md }]}>
        {exercise}
      </Text>

      {history.length >= 2 && (
        <Card style={{ marginBottom: spacing.md }}>
          <LiftChart data={history} color={c.text} />
          {first && last && (
            <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.sm }]}>
              {delta >= 0 ? '+' : ''}
              {fmtWeight(delta)} kg since first recorded lift
            </Text>
          )}
        </Card>
      )}

      <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>History</Text>
      {history.length === 0 ? (
        <EmptyState text="No records yet" />
      ) : (
        [...history].reverse().map((rec) => (
          <Pressable key={rec.id} onPress={() => setSelected(rec)}>
            <View style={[styles.historyRow, { borderColor: c.separator }]}>
              <Text style={[type.caption, { color: c.textSecondary }]}>
                {formatShortDate(rec.recorded_at)}
              </Text>
              <Text style={[type.body, { color: c.text, marginTop: 2 }]}>
                {fmtWeight(rec.weight)} kg × {rec.reps}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={[styles.detailCard, { backgroundColor: c.card }]}>
            {selected && (
              <View>
                <Text style={[type.title, { color: c.text }]}>{exercise}</Text>
                <Text style={[type.body, { color: c.text, marginTop: spacing.sm }]}>
                  {fmtWeight(selected.weight)} kg × {selected.reps}
                </Text>
                <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.xs }]}>
                  {formatFull(selected.recorded_at)}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function LiftChart({ data, color }: { data: LiftRecord[]; color: string }) {
  const width = 300;
  const height = 140;
  const padding = 16;
  const weights = data.map((d) => d.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((d.weight - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <SvgLine
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke={color}
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />
      ))}
    </Svg>
  );
}

// ---------- Fasting Screen ----------

export function FastingScreen() {
  const c = useTheme();
  const [activeFast, setActiveFastState] = useState<Fast | null>(null);
  const [history, setHistory] = useState<Fast[]>([]);
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<Fast | null>(null);
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
            <PrimaryButton label="END FAST" onPress={() => setShowEndFast(true)} />
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.md }]}>
              NOT FASTING
            </Text>
            <PrimaryButton
              label="START FAST"
              onPress={async () => {
                await startFast(new Date().toISOString());
                load();
              }}
            />
            <View style={{ height: spacing.sm }} />
            <SecondaryButton label="Enter fast manually" onPress={() => setShowManualFast(true)} />
          </View>
        )}
      </Card>

      <Text style={[type.title, { color: c.text, marginBottom: spacing.sm }]}>History</Text>
      {history.length === 0 ? (
        <EmptyState text="No fasts recorded yet" />
      ) : (
        history.map((f) => (
          <Pressable key={f.id} onPress={() => setSelected(f)}>
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

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelected(null)}>
          <View style={[styles.detailCard, { backgroundColor: c.card }]}>
            {selected && (
              <View>
                <Text style={[type.title, { color: c.text }]}>
                  {selected.end_time
                    ? formatHM(
                        new Date(selected.end_time).getTime() -
                          new Date(selected.start_time).getTime()
                      )
                    : ''}
                </Text>
                <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.sm }]}>
                  Start: {formatFull(selected.start_time)}
                </Text>
                {selected.end_time && (
                  <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.xs }]}>
                    End: {formatFull(selected.end_time)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ---------- History Screen ----------

export function HistoryScreen() {
  const c = useTheme();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    getUnifiedHistory().then(setItems);
  }, []);

  const groups: { header: string; items: HistoryItem[] }[] = [];
  for (const item of items) {
    const header = formatDateHeader(item.date);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.header === header) {
      lastGroup.items.push(item);
    } else {
      groups.push({ header, items: [item] });
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      <Text style={[type.largeTitle, { color: c.text, marginBottom: spacing.lg }]}>History</Text>
      {groups.length === 0 ? (
        <EmptyState text="Nothing recorded yet" />
      ) : (
        groups.map((group) => (
          <View key={group.header} style={{ marginBottom: spacing.lg }}>
            <Text
              style={[
                type.caption,
                { color: c.textSecondary, marginBottom: spacing.sm, letterSpacing: 0.5 },
              ]}
            >
              {group.header}
            </Text>
            <Card>
              {group.items.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.historyItemRow,
                    i < group.items.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: c.separator,
                    },
                  ]}
                >
                  {item.type === 'lift' ? (
                    <>
                      <Text style={[type.body, { color: c.text }]}>{item.lift.exercise}</Text>
                      <Text style={[type.body, { color: c.textSecondary }]}>
                        {fmtWeight(item.lift.weight)} kg × {item.lift.reps}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[type.body, { color: c.text }]}>Fast</Text>
                      <Text style={[type.body, { color: c.textSecondary }]}>
                        {item.fast.end_time
                          ? formatHM(
                              new Date(item.fast.end_time).getTime() -
                                new Date(item.fast.start_time).getTime()
                            )
                          : ''}
                      </Text>
                    </>
                  )}
                </View>
              ))}
            </Card>
          </View>
        ))
      )}
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
    paddingTop: spacing.xl,
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
