import React, { useState } from 'react';
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
import { useTheme, spacing, radius, type } from '../themes/theme';
import {
  executeRawSql,
  deleteAllLifts,
  deleteAllFasts,
  deleteEverything,
} from '../database/db';
import { exportPallasData, importPallasData } from '../database/export';

// ---------- Shared UI Components ----------

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
  const c = useTheme();

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={[styles.sheet, { backgroundColor: c.background, maxHeight: '85%' }]}>
          <View style={styles.sheetHeaderRow}>
            <Text style={[type.title, { color: c.text }]}>SQL Guide & Schema</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Database Tables */}
            <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
              DATABASE TABLES
            </Text>

            {/* Table 1: max_lifts */}
            <View style={{ backgroundColor: c.surface, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={[type.bodyMedium, { color: c.text, fontWeight: '700' }]}>max_lifts</Text>
              <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
                Stores personal maximum weight and reps for each exercise.
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • exercise TEXT PRIMARY KEY ('Squat', 'Bench Press', 'Deadlift', 'Clean & Press')
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • weight REAL (e.g. 100.5)
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • reps INTEGER (e.g. 5)
                </Text>
              </View>
            </View>

            {/* Table 2: fasts */}
            <View style={{ backgroundColor: c.surface, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={[type.bodyMedium, { color: c.text, fontWeight: '700' }]}>fasts</Text>
              <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
                Stores intermittent fasting start and end timestamps.
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • id INTEGER PRIMARY KEY AUTOINCREMENT
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • start_time TEXT (ISO 8601 string)
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • end_time TEXT (ISO 8601 string, NULL if active)
                </Text>
              </View>
            </View>

            {/* Table 3: newsletter_settings */}
            <View style={{ backgroundColor: c.surface, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.md }}>
              <Text style={[type.bodyMedium, { color: c.text, fontWeight: '700' }]}>newsletter_settings</Text>
              <Text style={[type.caption, { color: c.textSecondary, marginTop: 2 }]}>
                Stores The Study issue number, To Self note, and daily quotes.
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • id INTEGER PRIMARY KEY (1)
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • issue_number INTEGER (e.g. 33)
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • to_self_text TEXT
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • last_issue_date TEXT (YYYY-MM-DD)
                </Text>
                <Text style={[type.caption, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: c.text }]}>
                  • archive_quote_1 TEXT, archive_quote_2 TEXT
                </Text>
              </View>
            </View>

            {/* Example Queries */}
            <Text style={[type.caption, { color: c.textSecondary, marginBottom: spacing.xs, fontWeight: '600' }]}>
              EXAMPLE QUERIES (TAP TO USE)
            </Text>

            {examples.map((ex, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  onPickExample(ex.sql);
                  onClose();
                }}
                style={({ pressed }) => [
                  {
                    backgroundColor: c.surface,
                    borderRadius: radius.sm,
                    padding: spacing.sm,
                    marginBottom: spacing.sm,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[type.caption, { color: c.textSecondary, fontWeight: '600', marginBottom: 3 }]}>
                  {ex.title}
                </Text>
                <Text
                  style={[
                    type.caption,
                    {
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                      color: c.text,
                      fontSize: 12,
                    },
                  ]}
                >
                  {ex.sql}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- Settings Screen ----------

export function SettingsScreen() {
  const c = useTheme();
  const [working, setWorking] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlResult, setSqlResult] = useState<string | null>(null);
  const [showSqlInfo, setShowSqlInfo] = useState(false);

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
      style={{ backgroundColor: c.background }}
      contentContainerStyle={styles.screenPad}
    >
      <Text
        style={[
          type.caption,
          {
            color: c.textSecondary,
            marginBottom: spacing.sm,
          },
        ]}
      >
        SQL CONSOLE
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <TextInput
          placeholder="Enter SQL statement (e.g. SELECT * FROM max_lifts;)"
          placeholderTextColor={c.textSecondary}
          value={sqlQuery}
          onChangeText={setSqlQuery}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            {
              color: c.text,
              borderColor: c.separator,
              minHeight: 70,
              textAlignVertical: 'top',
              fontSize: 14,
            },
          ]}
        />
        <View style={{ marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => setShowSqlInfo(true)}
              style={({ pressed }) => [
                {
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: c.separator,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              hitSlop={8}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: c.textSecondary }}>ⓘ</Text>
            </Pressable>
            {sqlResult ? (
              <Pressable onPress={() => setSqlResult(null)}>
                <Text style={[type.caption, { color: c.textSecondary }]}>Clear output</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ width: 120 }}>
            <PrimaryButton
              label={working ? 'RUNNING...' : 'RUN SQL'}
              onPress={handleRunSql}
              disabled={working || !sqlQuery.trim()}
            />
          </View>
        </View>

        {sqlResult && (
          <View
            style={{
              marginTop: spacing.md,
              padding: spacing.sm,
              backgroundColor: c.surface,
              borderRadius: radius.sm,
              maxHeight: 200,
            }}
          >
            <ScrollView nestedScrollEnabled>
              <Text
                style={[
                  type.caption,
                  {
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    color: c.text,
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
      </Card>

      <SqlInfoModal
        visible={showSqlInfo}
        onClose={() => setShowSqlInfo(false)}
        onPickExample={(q) => setSqlQuery(q)}
      />

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
            Save a backup of your Pallas data
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
            Merge a Pallas backup with this device
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
              'All lifts, fasts, and settings will be permanently reset.',
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

// ---------- Styles ----------

const styles = StyleSheet.create({
  screenPad: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },

  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
});
