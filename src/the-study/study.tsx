import React, { useEffect, useState, useCallback } from 'react';
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
  M3TonalButton,
  M3BottomSheet,
  M3TopAppBar,
} from '../themes/m3-components';
import {
  getNewsletterState,
  saveNewsletterSettings,
  saveDailyNewsletterEdition,
  NewsletterState,
} from '../database/db';
import { myQuotes, taoTeChing } from '../content/data';
import Svg, {
  Rect,
  Path,
  Circle,
  Line,
} from 'react-native-svg';

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
    <View style={{ marginTop: 6 }}>
      {title && (
        <Text
          style={[
            m3Type.titleMedium,
            {
              color: textColor,
              marginBottom: 12,
              fontWeight: '700',
            },
          ]}
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
            style={[
              m3Type.bodyLarge,
              {
                fontStyle: 'italic',
                color: textColor,
                marginBottom: 6,
                lineHeight: 26,
              },
            ]}
          >
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

function SettingsPlaceholderIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
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
  const m3 = useM3Theme();
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
    <M3BottomSheet visible={visible} onClose={onClose} title="The Study Settings">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant, marginBottom: 6 }]}>
          Issue Number
        </Text>
        <TextInput
          value={issueNum}
          onChangeText={setIssueNum}
          keyboardType="number-pad"
          style={[
            styles.m3Input,
            {
              color: m3.onSurface,
              borderColor: m3.outlineVariant,
              backgroundColor: m3.surfaceContainerHighest,
            },
          ]}
        />

        <Text style={[m3Type.labelMedium, { color: m3.onSurfaceVariant, marginTop: 16, marginBottom: 6 }]}>
          To Self (Personal Note)
        </Text>
        <TextInput
          value={toSelf}
          onChangeText={setToSelf}
          placeholder="Write your note to self..."
          placeholderTextColor={m3.onSurfaceVariant}
          multiline
          style={[
            styles.m3Input,
            {
              color: m3.onSurface,
              borderColor: m3.outlineVariant,
              backgroundColor: m3.surfaceContainerHighest,
              minHeight: 110,
              textAlignVertical: 'top',
            },
          ]}
        />

        <View style={{ marginTop: 24 }}>
          <M3FilledButton label="SAVE SETTINGS" onPress={handleSave} />
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <M3TonalButton label="Advance (+1)" onPress={handleAdvanceIssue} />
          </View>
          <View style={{ flex: 1 }}>
            <M3TonalButton label="Shuffle Quotes" onPress={handleReshuffleQuotes} />
          </View>
        </View>
      </ScrollView>
    </M3BottomSheet>
  );
}

export function StudyScreen({ onBack }: { onBack: () => void }) {
  const m3 = useM3Theme();
  const [state, setState] = useState<NewsletterState | null>(null);
  const [showSettings, setShowSettings] = useState(false);

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
    <View style={{ flex: 1, backgroundColor: m3.surface }}>
      {/* M3 Top App Bar with Garamond back button */}
      <M3TopAppBar
        title="THE STUDY"
        onBack={onBack}
        actionButton={
          <M3Pressable
            onPress={() => setShowSettings(true)}
            hitSlop={12}
            scaleTo={0.88}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <SettingsPlaceholderIcon color={m3.primary} />
          </M3Pressable>
        }
      />


      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 64,
          maxWidth: 640,
          alignSelf: 'center',
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Masthead */}
        <M3Card
          containerLevel="surfaceContainerHigh"
          shape="extraLarge"
          style={{
            alignItems: 'center',
            paddingVertical: 24,
            marginBottom: 20,
          }}
        >
          <Text
            style={[
              m3Type.headlineLarge,
              {
                textTransform: 'uppercase',
                letterSpacing: 3,
                color: m3.onSurface,
                fontWeight: '700',
              },
            ]}
          >
            The Study
          </Text>

          <View
            style={{
              borderTopWidth: 1,
              borderColor: m3.outlineVariant,
              paddingTop: 10,
              marginTop: 10,
              alignItems: 'center',
              width: '80%',
            }}
          >
            <Text
              style={[
                m3Type.labelLarge,
                {
                  letterSpacing: 2,
                  color: m3.primary,
                  fontWeight: '700',
                },
              ]}
            >
              ISSUE #{issueNum}
            </Text>
            <Text
              style={[
                m3Type.bodySmall,
                {
                  color: m3.onSurfaceVariant,
                  marginTop: 2,
                },
              ]}
            >
              {dateFormatted}
            </Text>
          </View>
        </M3Card>

        {/* Section: To Self */}
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ marginBottom: 16 }}
        >
          <Text
            style={[
              m3Type.labelLarge,
              {
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: m3.primary,
                marginBottom: 12,
              },
            ]}
          >
            To Self
          </Text>

          {state?.to_self_text ? (
            <Text
              style={[
                m3Type.bodyLarge,
                {
                  lineHeight: 26,
                  fontStyle: 'italic',
                  color: m3.onSurface,
                },
              ]}
            >
              {state.to_self_text}
            </Text>
          ) : (
            <M3Pressable onPress={() => setShowSettings(true)}>
              <Text
                style={[
                  m3Type.bodyMedium,
                  {
                    fontStyle: 'italic',
                    color: m3.onSurfaceVariant,
                    paddingVertical: 4,
                  },
                ]}
              >
                Tap here to write your note to self...
              </Text>
            </M3Pressable>
          )}
        </M3Card>

        {/* Section: From the Archives */}
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ marginBottom: 16 }}
        >
          <Text
            style={[
              m3Type.labelLarge,
              {
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: m3.primary,
                marginBottom: 12,
              },
            ]}
          >
            From the Archives
          </Text>

          {state?.archive_quote_1 ? (
            <View style={{ marginBottom: 14 }}>
              <Text
                style={[
                  m3Type.bodyLarge,
                  {
                    lineHeight: 26,
                    fontStyle: 'italic',
                    color: m3.onSurface,
                  },
                ]}
              >
                "{state.archive_quote_1}"
              </Text>
            </View>
          ) : null}

          {state?.archive_quote_2 ? (
            <View>
              <Text
                style={[
                  m3Type.bodyLarge,
                  {
                    lineHeight: 26,
                    fontStyle: 'italic',
                    color: m3.onSurface,
                  },
                ]}
              >
                "{state.archive_quote_2}"
              </Text>
            </View>
          ) : null}
        </M3Card>

        {/* Section: Tao Te Ching */}
        <M3Card
          containerLevel="surfaceContainer"
          shape="largeIncreased"
          style={{ marginBottom: 16 }}
        >
          <Text
            style={[
              m3Type.labelLarge,
              {
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                color: m3.primary,
                marginBottom: 12,
              },
            ]}
          >
            Tao Te Ching
          </Text>

          {renderTaoTeChing(dailyPoem, m3.onSurface)}
        </M3Card>

        {/* Footer */}
        <View
          style={{
            borderTopWidth: 1,
            borderColor: m3.outlineVariant,
            paddingTop: 16,
            alignItems: 'center',
            marginTop: 12,
          }}
        >
          <Text
            style={[
              m3Type.labelMedium,
              {
                fontStyle: 'italic',
                color: m3.onSurfaceVariant,
              },
            ]}
          >
            — End of Edition —
          </Text>
        </View>
      </ScrollView>

      {/* Settings Modal — always mounted so gear tap before load doesn't silently fail */}
      <StudySettingsModal
        visible={showSettings && state !== null}
        state={state ?? { id: 1, issue_number: 1, to_self_text: '', last_issue_date: '', archive_quote_1: '', archive_quote_2: '' }}
        onClose={() => setShowSettings(false)}
        onSaved={load}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  m3Input: {
    borderWidth: 1,
    borderRadius: m3Shape.medium,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

