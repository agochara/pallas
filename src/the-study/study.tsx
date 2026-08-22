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
  useColorScheme,
} from 'react-native';
import { useTheme, spacing, radius, type } from '../themes/theme';
import {
  getNewsletterState,
  saveNewsletterSettings,
  saveDailyNewsletterEdition,
  NewsletterState,
} from '../database/db';
import { myQuotes, taoTeChing } from '../content/data';

function getRandomArchiveQuotes(): [string, string] {
  if (myQuotes.length === 0) return ['', ''];
  if (myQuotes.length === 1) return [myQuotes[0], myQuotes[0]];

  const idx1 = Math.floor(Math.random() * myQuotes.length);
  let idx2 = Math.floor(Math.random() * (myQuotes.length - 1));
  if (idx2 >= idx1) idx2++;

  return [myQuotes[idx1], myQuotes[idx2]];
}

function renderTaoTeChing(poemHtml: string, textColor: string) {
  if (!poemHtml) return null;

  const match = poemHtml.match(/<b>(.*?)<\/b>(?:<br>)?/i);
  const title = match ? match[1] : null;
  const body = match ? poemHtml.replace(match[0], '') : poemHtml;

  const lines = body.split(/<br\s*\/?>/i);

  return (
    <View style={{ marginTop: spacing.xs }}>
      {title && (
        <Text
          style={{
            fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
            fontSize: 19,
            fontWeight: '700',
            color: textColor,
            marginBottom: spacing.md,
          }}
        >
          {title}
        </Text>
      )}
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={idx} style={{ height: 10 }} />;
        }
        return (
          <Text
            key={idx}
            style={{
              fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
              fontSize: 17,
              lineHeight: 28,
              fontStyle: 'italic',
              color: textColor,
              marginBottom: 4,
            }}
          >
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

function StudySettingsModal({
  visible,
  state,
  onClose,
  onSaved,
}: {
  visible: boolean;
  state: NewsletterState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useTheme();
  const [issueNum, setIssueNum] = useState(String(state.issue_number));
  const [toSelf, setToSelf] = useState(state.to_self_text);

  useEffect(() => {
    if (visible) {
      setIssueNum(String(state.issue_number));
      setToSelf(state.to_self_text);
    }
  }, [visible, state]);

  async function handleSave() {
    const num = parseInt(issueNum, 10);
    if (isNaN(num) || num < 1) {
      Alert.alert('Invalid Issue Number', 'Please enter a positive number for the issue.');
      return;
    }
    await saveNewsletterSettings({
      issue_number: num,
      to_self_text: toSelf,
    });
    onSaved();
    onClose();
  }

  async function handleAdvanceIssue() {
    const nextNum = state.issue_number + 1;
    const [q1, q2] = getRandomArchiveQuotes();
    const todayStr = new Date().toISOString().slice(0, 10);
    await saveDailyNewsletterEdition({
      issue_number: nextNum,
      last_issue_date: todayStr,
      archive_quote_1: q1,
      archive_quote_2: q2,
    });
    onSaved();
    onClose();
  }

  async function handleReshuffleQuotes() {
    const [q1, q2] = getRandomArchiveQuotes();
    const todayStr = new Date().toISOString().slice(0, 10);
    await saveDailyNewsletterEdition({
      issue_number: state.issue_number,
      last_issue_date: todayStr,
      archive_quote_1: q1,
      archive_quote_2: q2,
    });
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
            <Text style={[type.title, { color: c.text }]}>The Study Settings</Text>
            <Pressable onPress={onClose}>
              <Text style={[type.body, { color: c.textSecondary }]}>Close</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.xs }]}>
              Issue Number
            </Text>
            <TextInput
              value={issueNum}
              onChangeText={setIssueNum}
              keyboardType="number-pad"
              style={[styles.input, { color: c.text, borderColor: c.separator }]}
            />

            <Text style={[type.caption, { color: c.textSecondary, marginTop: spacing.md }]}>
              To Self (Personal Note)
            </Text>
            <TextInput
              value={toSelf}
              onChangeText={setToSelf}
              placeholder="Write your note to self..."
              placeholderTextColor={c.textSecondary}
              multiline
              style={[
                styles.input,
                {
                  color: c.text,
                  borderColor: c.separator,
                  minHeight: 100,
                  textAlignVertical: 'top',
                },
              ]}
            />

            <View style={{ marginTop: spacing.lg }}>
              <Pressable
                onPress={handleSave}
                style={[styles.primaryBtn, { backgroundColor: c.accent }]}
              >
                <Text style={{ color: c.accentText, fontWeight: '700', fontSize: 16 }}>
                  SAVE SETTINGS
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={handleAdvanceIssue}
                style={[
                  styles.secondaryBtn,
                  { borderColor: c.separator, backgroundColor: c.surface, flex: 1 },
                ]}
              >
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                  Advance (+1)
                </Text>
              </Pressable>

              <Pressable
                onPress={handleReshuffleQuotes}
                style={[
                  styles.secondaryBtn,
                  { borderColor: c.separator, backgroundColor: c.surface, flex: 1 },
                ]}
              >
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '600' }}>
                  Shuffle Quotes
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function StudyScreen({ onBack }: { onBack: () => void }) {
  const c = useTheme();
  const scheme = useColorScheme();
  const [state, setState] = useState<NewsletterState | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const paperBg = c.background;
  const paperText = c.text;
  const paperMuted = c.textSecondary;
  const paperRule = c.separator;

  const load = useCallback(async () => {
    const s = await getNewsletterState();
    const todayStr = new Date().toISOString().slice(0, 10);

    if (!s.last_issue_date) {
      // First launch
      const [q1, q2] = getRandomArchiveQuotes();
      await saveDailyNewsletterEdition({
        issue_number: s.issue_number || 33,
        last_issue_date: todayStr,
        archive_quote_1: q1,
        archive_quote_2: q2,
      });
      const updated = await getNewsletterState();
      setState(updated);
    } else if (s.last_issue_date !== todayStr) {
      // New day -> increment issue
      const nextIssue = s.issue_number + 1;
      const [q1, q2] = getRandomArchiveQuotes();
      await saveDailyNewsletterEdition({
        issue_number: nextIssue,
        last_issue_date: todayStr,
        archive_quote_1: q1,
        archive_quote_2: q2,
      });
      const updated = await getNewsletterState();
      setState(updated);
    } else {
      setState(s);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const issueNum = state?.issue_number ?? 33;
  const poemIndex = Math.max(0, issueNum - 1) % taoTeChing.length;
  const dailyPoem = taoTeChing[poemIndex];

  const dateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={{ flex: 1, backgroundColor: paperBg }}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: Platform.OS === 'ios' ? 48 : 36,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.separator,
          backgroundColor: paperBg,
        }}
      >
        <Pressable onPress={onBack} hitSlop={8} style={{ width: 100 }}>
          <Text style={{ fontFamily: 'EBGaramond_500Medium', fontSize: 17, color: paperText }}>‹ Pallas</Text>
        </Pressable>
        <Text style={[type.bodyMedium, { color: paperMuted, fontWeight: '600', letterSpacing: 1 }]}>
          THE STUDY
        </Text>
        <Pressable
          onPress={() => setShowSettings(true)}
          hitSlop={8}
          style={{ width: 100, alignItems: 'flex-end' }}
        >
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.xl,
          paddingBottom: spacing.xl * 3,
          maxWidth: 600,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        {/* Masthead */}
        <View
          style={{
            alignItems: 'center',
            borderBottomWidth: 3,
            borderBottomColor: paperRule,
            paddingBottom: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
              fontSize: 34,
              fontWeight: '400',
              textTransform: 'uppercase',
              letterSpacing: 4,
              color: paperText,
            }}
          >
            The Study
          </Text>

          <View
            style={{
              borderTopWidth: 1,
              borderColor: paperRule,
              paddingTop: 6,
              marginTop: spacing.xs,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: 2,
                color: paperText,
              }}
            >
              ISSUE #{issueNum}
            </Text>
            <Text
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                fontSize: 12,
                fontStyle: 'italic',
                color: paperMuted,
                marginTop: 3,
              }}
            >
              {dateFormatted}
            </Text>
          </View>
        </View>

        {/* Section: To Self */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: paperMuted,
              borderBottomWidth: 1,
              borderColor: paperRule,
              paddingBottom: 4,
              marginBottom: spacing.md,
            }}
          >
            To Self
          </Text>

          {state?.to_self_text ? (
            <Text
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                fontSize: 17,
                lineHeight: 28,
                fontStyle: 'italic',
                color: paperText,
              }}
            >
              {state.to_self_text}
            </Text>
          ) : (
            <Pressable onPress={() => setShowSettings(true)}>
              <Text
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                  fontSize: 15,
                  fontStyle: 'italic',
                  color: paperMuted,
                  paddingVertical: spacing.xs,
                }}
              >
                Tap here or ⚙️ in the top right to write your note to self...
              </Text>
            </Pressable>
          )}
        </View>

        {/* Section: From the Archives */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: paperMuted,
              borderBottomWidth: 1,
              borderColor: paperRule,
              paddingBottom: 4,
              marginBottom: spacing.md,
            }}
          >
            From the Archives
          </Text>

          {state?.archive_quote_1 ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                  fontSize: 17,
                  lineHeight: 28,
                  fontStyle: 'italic',
                  color: paperText,
                }}
              >
                "{state.archive_quote_1}"
              </Text>
            </View>
          ) : null}

          {state?.archive_quote_2 ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text
                style={{
                  fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                  fontSize: 17,
                  lineHeight: 28,
                  fontStyle: 'italic',
                  color: paperText,
                }}
              >
                "{state.archive_quote_2}"
              </Text>
            </View>
          ) : null}
        </View>

        {/* Section: Tao Te Ching */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: paperMuted,
              borderBottomWidth: 1,
              borderColor: paperRule,
              paddingBottom: 4,
              marginBottom: spacing.sm,
            }}
          >
            Tao Te Ching
          </Text>

          {renderTaoTeChing(dailyPoem, paperText)}
        </View>

        {/* Footer */}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: paperRule,
            paddingTop: spacing.md,
            alignItems: 'center',
            marginTop: spacing.lg,
          }}
        >
          <Text
            style={{
              fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
              fontSize: 13,
              fontStyle: 'italic',
              color: paperMuted,
            }}
          >
            — End of Edition —
          </Text>
        </View>
      </ScrollView>

      {/* Settings Modal */}
      {state && (
        <StudySettingsModal
          visible={showSettings}
          state={state}
          onClose={() => setShowSettings(false)}
          onSaved={load}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  secondaryBtn: {
    paddingVertical: spacing.sm + 4,
    borderRadius: radius.sm,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
