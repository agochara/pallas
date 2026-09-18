import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useM3Theme, m3Shape, m3Type } from '../themes/theme';
import {
  M3Card,
  M3Pressable,
  M3FilledButton,
  M3BottomSheet,
} from '../themes/m3-components';
import Constants from 'expo-constants';
import {
  executeRawSql,
  deleteAllLifts,
  deleteAllFasts,
  deleteAllWeights,
  clearVadeMecum,
  deleteEverything,
  getCoachConfig,
  saveCoachConfig,
} from '../database/db';
import { exportPallasData, importPallasData } from '../database/export';

// ---------- SQL Info Modal ----------

function SqlInfoModal({
  visible,
  onClose,
  onPickExample,
}: {
  visible: boolean;
  onClose: () => void;
  onPickExample: (query: string) => void;
}) {
  const m3 = useM3Theme();

  const examples = [
    {
      title: 'View all max lifts',
      sql: 'SELECT * FROM max_lifts;',
    },
    {
      title: 'View all fasts (most recent first)',
      sql: 'SELECT * FROM fasts ORDER BY start_time DESC;',
    },
    {
      title: 'View body weight log (most recent first)',
      sql: 'SELECT * FROM weights ORDER BY date DESC, id DESC;',
    },
    {
      title: 'View Vade Mecum notepad content',
      sql: 'SELECT * FROM vade_mecum;',
    },
    {
      title: 'View The Study newsletter settings',
      sql: 'SELECT * FROM newsletter_settings;',
    },
    {
      title: 'Insert or replace a lift record',
      sql: "INSERT OR REPLACE INTO max_lifts (exercise, weight, reps)\nVALUES ('Squat', 120, 5);",
    },
    {
      title: 'Insert a completed fast',
      sql: "INSERT INTO fasts (start_time, end_time)\nVALUES ('2026-08-21T20:00:00.000Z', '2026-08-22T12:00:00.000Z');",
    },
    {
      title: 'Insert a weight measurement',
      sql: "INSERT INTO weights (weight, date)\nVALUES (78.5, '2026-08-22');",
    },
    {
      title: 'Update a fast end time',
      sql: "UPDATE fasts\nSET end_time = '2026-08-22T13:00:00.000Z'\nWHERE id = 1;",
    },
    {
      title: 'Update The Study issue number',
      sql: 'UPDATE newsletter_settings\nSET issue_number = 33\nWHERE id = 1;',
    },
    {
      title: 'Calculate average fast duration (hours)',
      sql: "SELECT COUNT(*) as total_fasts,\nROUND(AVG((strftime('%s', end_time) - strftime('%s', start_time)) / 3600.0), 1) as avg_hours\nFROM fasts\nWHERE end_time IS NOT NULL;",
    },
  ];

  return (
    <M3BottomSheet visible={visible} onClose={onClose} title="SQL Guide & Schema">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Database Tables */}
        <Text
          style={[
            m3Type.labelLargeEmphasized,
            { color: m3.primary, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
          ]}
        >
          DATABASE TABLES
        </Text>

        {/* Table 1: max_lifts */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            max_lifts
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores personal maximum weight and reps for each exercise.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • exercise TEXT PRIMARY KEY ('Deadlift', 'Clean', 'Press', 'Squat', 'Chins', 'Pullups', 'Bench Press', or custom)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • weight REAL (e.g. 100.5, or 0 for bodyweight)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • reps INTEGER (e.g. 5)
            </Text>
          </View>
        </M3Card>

        {/* Table 2: fasts */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            fasts
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores intermittent fasting start and end timestamps.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • id INTEGER PRIMARY KEY AUTOINCREMENT
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • start_time TEXT (ISO 8601 string)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • end_time TEXT (ISO 8601 string, NULL if active)
            </Text>
          </View>
        </M3Card>

        {/* Table 3: weights */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            weights
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores body weight measurements with calendar dates.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • id INTEGER PRIMARY KEY AUTOINCREMENT
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • weight REAL (e.g. 78.5)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • date TEXT (YYYY-MM-DD)
            </Text>
          </View>
        </M3Card>

        {/* Table 4: vade_mecum */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            vade_mecum
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores the continuous Vade Mecum commonplace book document.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • id INTEGER PRIMARY KEY (1)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • content TEXT
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • updated_at TEXT (ISO 8601 string)
            </Text>
          </View>
        </M3Card>

        {/* Table 5: newsletter_settings */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 16 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            newsletter_settings
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores The Study issue number, To Self note, and daily quotes.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • id INTEGER PRIMARY KEY (1)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • issue_number INTEGER (e.g. 33)
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • to_self_text TEXT
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface },
              ]}
            >
              • last_issue_date TEXT (YYYY-MM-DD)
            </Text>
          </View>
        </M3Card>

        {/* Table 6: coach_config */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            coach_config
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Stores Coach threshold settings.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • key TEXT PRIMARY KEY ('steps_threshold', 'steps_days', 'fasting_days')
            </Text>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • value INTEGER (e.g. 7000, 3)
            </Text>
          </View>
        </M3Card>

        {/* Table 7: coach_steps */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 10 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            coach_steps
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Two-year rolling window of daily aggregated steps from Health Connect (one-time backfill seeds up to a year).
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • date TEXT PRIMARY KEY (YYYY-MM-DD)
            </Text>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • steps INTEGER
            </Text>
          </View>
        </M3Card>

        {/* Table 8: coach_events */}
        <M3Card
          containerLevel="surfaceContainerHighest"
          shape="medium"
          style={{ padding: 14, marginBottom: 16 }}
        >
          <Text style={[m3Type.titleMediumEmphasized, { color: m3.onSurface }]}>
            coach_events
          </Text>
          <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2 }]}>
            Active unresolved Coach interventions.
          </Text>
          <View style={{ marginTop: 6 }}>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • id INTEGER PRIMARY KEY AUTOINCREMENT
            </Text>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • type TEXT ('insufficient_steps', 'missed_fast')
            </Text>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • created_at TEXT (ISO 8601 string)
            </Text>
            <Text style={[m3Type.bodySmall, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: m3.onSurface }]}>
              • resolved INTEGER (0 or 1)
            </Text>
          </View>
        </M3Card>

        {/* Example Queries */}
        <Text
          style={[
            m3Type.labelLarge,
            { color: m3.primary, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
          ]}
        >
          EXAMPLE QUERIES (TAP TO USE)
        </Text>

        {examples.map((ex, i) => (
          <M3Pressable
            key={i}
            onPress={() => {
              onPickExample(ex.sql);
              onClose();
            }}
            scaleTo={0.97}
            style={[
              styles.exampleCard,
              {
                backgroundColor: m3.surfaceContainerHighest,
                borderRadius: m3Shape.medium,
                
              },
            ]}
          >
            <Text style={[m3Type.labelMedium, { color: m3.primary, marginBottom: 4 }]}>
              {ex.title}
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                {
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  color: m3.onSurface,
                  fontSize: 12,
                },
              ]}
            >
              {ex.sql}
            </Text>
          </M3Pressable>
        ))}
      </ScrollView>
    </M3BottomSheet>
  );
}

// ---------- Coach Config Field ----------

function CoachNumberField({
  label,
  helper,
  suffix,
  value,
  onChangeText,
  last,
}: {
  label: string;
  helper: string;
  suffix: string;
  value: string;
  onChangeText: (text: string) => void;
  last?: boolean;
}) {
  const m3 = useM3Theme();
  return (
    <View style={{ marginBottom: last ? 0 : 18 }}>
      <Text style={[m3Type.labelLarge, { color: m3.onSurface }]}>{label}</Text>
      <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginTop: 2, marginBottom: 8 }]}>
        {helper}
      </Text>
      <View
        style={[
          styles.configInputWrap,
          {
            backgroundColor: m3.surfaceContainerHighest,
            borderColor: m3.outlineVariant,
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          style={[styles.configInput, { color: m3.onSurface }]}
        />
        <Text style={[m3Type.bodyMedium, { color: m3.onSurfaceVariant }]}>{suffix}</Text>
      </View>
    </View>
  );
}

// ---------- Settings Screen ----------

export function SettingsScreen() {
  const m3 = useM3Theme();
  const [working, setWorking] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const [showSqlInfo, setShowSqlInfo] = useState(false);

  const [stepsThreshold, setStepsThreshold] = useState('7000');
  const [stepsDays, setStepsDays] = useState('3');
  const [fastingDays, setFastingDays] = useState('3');
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    getCoachConfig()
      .then((config) => {
        if (config.steps_threshold !== undefined) {
          setStepsThreshold(String(config.steps_threshold));
        }
        if (config.steps_days !== undefined) {
          setStepsDays(String(config.steps_days));
        }
        if (config.fasting_days !== undefined) {
          setFastingDays(String(config.fasting_days));
        }
      })
      .catch((error) => console.error('Error loading coach config:', error));
  }, []);

  async function handleSaveConfig() {
    const threshold = parseInt(stepsThreshold, 10);
    const days = parseInt(stepsDays, 10);
    const fasting = parseInt(fastingDays, 10);

    if (!Number.isFinite(threshold) || threshold < 1) {
      Alert.alert('Invalid steps threshold', 'Enter a step goal of at least 1.');
      return;
    }
    if (!Number.isFinite(days) || days < 1) {
      Alert.alert('Invalid days', 'Enter a number of days of at least 1.');
      return;
    }
    if (!Number.isFinite(fasting) || fasting < 1) {
      Alert.alert('Invalid fasting interval', 'Enter an interval of at least 1 day.');
      return;
    }

    try {
      setSavingConfig(true);
      await saveCoachConfig({
        steps_threshold: threshold,
        steps_days: days,
        fasting_days: fasting,
      });
      Alert.alert('Saved', 'Coach thresholds updated.');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not save the Coach thresholds.');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleRunSql() {
    if (!sqlQuery.trim()) return;
    try {
      setWorking(true);
      const res = await executeRawSql(sqlQuery);
      setSqlResult(res);
    } catch (err: any) {
      setSqlResult(`Error: ${err?.message ?? String(err)}`);
    } finally {
      setWorking(false);
    }
  }

  async function handleExport() {
    try {
      setWorking(true);
      await exportPallasData();
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  }

  async function handleImport() {
    try {
      setWorking(true);

      const imported = await importPallasData();

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
        'That file is not a valid Pallas backup.'
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
      style={{ backgroundColor: m3.surface }}
      contentContainerStyle={styles.screenPad}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[
          m3Type.labelLarge,
          {
            color: m3.primary,
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        SQL CONSOLE
      </Text>

      <M3Card
        containerLevel="surfaceContainer"
        shape="largeIncreased"
        style={{ marginBottom: 24 }}
      >
        <TextInput
          placeholder="Enter SQL statement (e.g. SELECT * FROM max_lifts;)"
          placeholderTextColor={m3.onSurfaceVariant}
          value={sqlQuery}
          onChangeText={setSqlQuery}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.sqlInput,
            {
              color: m3.onSurface,
              
              backgroundColor: m3.surfaceContainerHighest,
            },
          ]}
        />
        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <M3Pressable
              onPress={() => setShowSqlInfo(true)}
              scaleTo={0.9}
              style={[
                styles.infoBtn,
                {
                  
                  backgroundColor: m3.surfaceContainerHigh,
                },
              ]}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: m3.onSurfaceVariant }}>ⓘ</Text>
            </M3Pressable>
            {sqlResult ? (
              <M3Pressable onPress={() => setSqlResult(null)}>
                <Text style={[m3Type.bodySmall, { color: m3.primary }]}>Clear output</Text>
              </M3Pressable>
            ) : null}
          </View>
          <View style={{ width: 130 }}>
            <M3FilledButton
              label={working ? 'RUNNING...' : 'RUN SQL'}
              onPress={handleRunSql}
              disabled={working || !sqlQuery.trim()}
            />
          </View>
        </View>

        {sqlResult && (
          <View
            style={{
              marginTop: 14,
              padding: 12,
              backgroundColor: m3.surfaceContainerHighest,
              borderRadius: m3Shape.medium,
              maxHeight: 200,
            }}
          >
            <ScrollView nestedScrollEnabled>
              <Text
                style={[
                  m3Type.bodySmall,
                  {
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    color: m3.onSurface,
                    fontSize: 12,
                  },
                ]}
                selectable
              >
                {sqlResult}
              </Text>
            </ScrollView>
          </View>
        )}
      </M3Card>

      <SqlInfoModal
        visible={showSqlInfo}
        onClose={() => setShowSqlInfo(false)}
        onPickExample={(q) => setSqlQuery(q)}
      />

      <Text
        style={[
          m3Type.labelLargeEmphasized,
          {
            color: m3.primary,
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        COACH
      </Text>

      <M3Card
        containerLevel="surfaceContainer"
        shape="largeIncreased"
        style={{ padding: 18, marginBottom: 24 }}
      >
        <Text style={[m3Type.bodySmall, { color: m3.onSurfaceVariant, marginBottom: 18 }]}>
          Thresholds that drive Coach reminders.
        </Text>

        <CoachNumberField
          label="Steps threshold"
          helper="Daily step goal. Below it, Coach asks you to walk."
          suffix="steps"
          value={stepsThreshold}
          onChangeText={setStepsThreshold}
        />

        <CoachNumberField
          label="Steps days"
          helper="Consecutive days below the goal before Coach intervenes."
          suffix="days"
          value={stepsDays}
          onChangeText={setStepsDays}
        />

        <CoachNumberField
          label="Fasting interval"
          helper="Days without a logged fast before Coach intervenes."
          suffix="days"
          value={fastingDays}
          onChangeText={setFastingDays}
          last
        />

        <View style={{ marginTop: 20 }}>
          <M3FilledButton
            label={savingConfig ? 'SAVING...' : 'SAVE THRESHOLDS'}
            onPress={handleSaveConfig}
            disabled={savingConfig}
          />
        </View>
      </M3Card>

      <Text
        style={[
          m3Type.labelLargeEmphasized,
          {
            color: m3.primary,
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        DATA
      </Text>

      <M3Pressable
        onPress={handleExport}
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 12 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Export data
          </Text>
          <Text
            style={[
              m3Type.bodySmall,
              {
                color: m3.onSurfaceVariant,
                marginTop: 3,
              },
            ]}
          >
            Save a backup of your Pallas data
          </Text>
        </M3Card>
      </M3Pressable>

      <M3Pressable
        onPress={handleImport}
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 24 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Import data
          </Text>
          <Text
            style={[
              m3Type.bodySmall,
              {
                color: m3.onSurfaceVariant,
                marginTop: 3,
              },
            ]}
          >
            Merge a Pallas backup with this device
          </Text>
        </M3Card>
      </M3Pressable>

      <Text
        style={[
          m3Type.labelLargeEmphasized,
          {
            color: m3.error,
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        RESET & CLEAR
      </Text>

      <M3Pressable
        onPress={() =>
          confirmDelete(
            'Delete strength history?',
            'All recorded strength maxes will be permanently deleted.',
            deleteAllLifts
          )
        }
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 12 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Delete strength history
          </Text>
        </M3Card>
      </M3Pressable>

      <M3Pressable
        onPress={() =>
          confirmDelete(
            'Delete fasting history?',
            'All recorded fasts will be permanently deleted.',
            deleteAllFasts
          )
        }
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 12 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Delete fasting history
          </Text>
        </M3Card>
      </M3Pressable>

      <M3Pressable
        onPress={() =>
          confirmDelete(
            'Delete weight history?',
            'All recorded weight measurements will be permanently deleted.',
            deleteAllWeights
          )
        }
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 12 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Delete weight history
          </Text>
        </M3Card>
      </M3Pressable>

      <M3Pressable
        onPress={() =>
          confirmDelete(
            'Clear Vade Mecum?',
            'All notes in Vade Mecum will be permanently cleared.',
            clearVadeMecum
          )
        }
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 12 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>
            Clear Vade Mecum
          </Text>
        </M3Card>
      </M3Pressable>

      <M3Pressable
        onPress={() =>
          confirmDelete(
            'Delete everything?',
            'All strength maxes, fasts, weights, Vade Mecum notes, and settings will be permanently reset.',
            deleteEverything
          )
        }
        disabled={working}
        scaleTo={0.98}
        style={{ marginBottom: 24 }}
      >
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ padding: 18 }}
        >
          <Text style={[m3Type.titleMedium, { color: m3.error }]}>
            Delete everything
          </Text>
        </M3Card>
      </M3Pressable>

      <Text
        style={[
          m3Type.labelLarge,
          {
            color: m3.onSurfaceVariant,
            marginBottom: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        ABOUT
      </Text>

      <M3Card
        containerLevel="surfaceContainer"
        shape="largeIncreased"
        style={{ padding: 18, marginBottom: 32 }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[m3Type.titleMedium, { color: m3.onSurface }]}>Pallas</Text>
          <Text style={[m3Type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            v{Constants.expoConfig?.version ?? '2.1.1'}
          </Text>
        </View>
      </M3Card>
    </ScrollView>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 64,
  },
  sqlInput: {
    backgroundColor: '#1E1E1E', // standard for code fields or surfaceContainerHighest
    borderRadius: m3Shape.medium,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#FFF',
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  configInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: m3Shape.medium,
    paddingHorizontal: 14,
  },
  configInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  exampleCard: {
    padding: 14,
    marginBottom: 10,
    borderRadius: m3Shape.medium,
  },
});

