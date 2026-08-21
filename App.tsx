import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useTheme, spacing, type } from './theme';
import { initDatabase } from './db';

import {
  LogScreen,
  LiftsScreen,
  FastingScreen,
  SettingsScreen,
} from './screens';

type Tab = 'log' | 'lifts' | 'fasting' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'log', label: 'Log' },
  { key: 'lifts', label: 'Lifts' },
  { key: 'fasting', label: 'Fasting' },
  { key: 'settings', label: 'Settings' },
];

export default function App() {
  const c = useTheme();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('log');

  useEffect(() => {
    initDatabase().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: c.background },
        ]}
      >
        <ActivityIndicator color={c.text} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.background },
      ]}
    >
      <StatusBar style="auto" />

      <View style={styles.content}>
        {tab === 'log' && <LogScreen />}
        {tab === 'lifts' && <LiftsScreen />}
        {tab === 'fasting' && <FastingScreen />}
        {tab === 'settings' && <SettingsScreen />}
      </View>

      <View
        style={[
          styles.tabBar,
          {
            borderTopColor: c.separator,
            backgroundColor: c.background,
          },
        ]}
      >
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={styles.tabButton}
            onPress={() => setTab(t.key)}
          >
            <Text
              style={[
                type.caption,
                {
                  color:
                    tab === t.key
                      ? c.text
                      : c.textSecondary,
                  fontWeight:
                    tab === t.key ? '600' : '400',
                },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
  },

  tabBar: {
  flexDirection: 'row',
  borderTopWidth: StyleSheet.hairlineWidth,
  paddingTop: spacing.md,
  paddingBottom: spacing.xl,
},

tabButton: {
  flex: 1,
  alignItems: 'center',
  paddingVertical: spacing.sm,
},
});