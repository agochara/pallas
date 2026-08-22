import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTheme, spacing, radius, type } from './themes/theme';
import { initDatabase } from './database/db';

import {
  FastingScreen,
  StrengthScreen,
  WeightScreen,
} from './askesis/screens';
import { SettingsScreen } from './settings/settings-screen';
import { StudyScreen } from './the-study/study';
import { VadeMecumScreen } from './vade-mecum/vade-mecum';

import {
  useFonts,
  EBGaramond_400Regular,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_700Bold,
  EBGaramond_400Regular_Italic,
} from '@expo-google-fonts/eb-garamond';

type AppId = 'home' | 'study' | 'vade-mecum' | 'askesis' | 'settings';
type AskesisTab = 'fasting' | 'strength' | 'weight';

const ASKESIS_TABS: { key: AskesisTab; label: string }[] = [
  { key: 'fasting', label: 'Fasting' },
  { key: 'strength', label: 'Strength' },
  { key: 'weight', label: 'Weight' },
];

function MainContent() {
  const c = useTheme();
  const [ready, setReady] = useState(false);
  const [currentApp, setCurrentApp] = useState<AppId>('home');
  const [askesisTab, setAskesisTab] = useState<AskesisTab>('fasting');

  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
    EBGaramond_400Regular_Italic,
  });

  useEffect(() => {
    initDatabase().then(() => setReady(true));
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      if (currentApp !== 'home') {
        setCurrentApp('home');
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [currentApp]);

  if (!ready || !fontsLoaded) {
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

  // Pallas Launcher Home Screen
  if (currentApp === 'home') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: c.background }]}>
        <StatusBar style="auto" />
        <ScrollView contentContainerStyle={styles.launcherContent}>
          <Text
            style={{
              color: c.text,
              fontSize: 34,
              fontWeight: '700',
              letterSpacing: 3,
              textAlign: 'center',
              marginBottom: spacing.sm,
            }}
          >
            PALLAS
          </Text>

          {/* tagline UNA SALUS VICTIS · NULLAM SPERARE SALUTEM */}
          <Text
            style={{
              color: c.textSecondary,
              fontFamily: 'EBGaramond_400Regular',
              fontSize: 12.6,
              letterSpacing: .51,
              textAlign: 'center',
              marginBottom: spacing.xl,
            }}
          >
            UNA SALUS VICTIS · NULLAM SPERARE SALUTEM
          </Text>

          {/* App Card 1: The Study */}
          <Pressable
            onPress={() => setCurrentApp('study')}
            style={({ pressed }) => [
              styles.appCard,
              {
                backgroundColor: c.card,
                borderColor: c.separator,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ fontFamily: 'EBGaramond_600SemiBold', fontSize: 21, color: c.text }}>
                The Study
              </Text>
            </View>
            <Text style={[type.body, { color: c.textSecondary, fontSize: 20 }]}>›</Text>
          </Pressable>

          {/* App Card 2: Vade Mecum */}
          <Pressable
            onPress={() => setCurrentApp('vade-mecum')}
            style={({ pressed }) => [
              styles.appCard,
              {
                backgroundColor: c.card,
                borderColor: c.separator,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ fontFamily: 'EBGaramond_600SemiBold', fontSize: 21, color: c.text }}>
                Vade Mecum
              </Text>
            </View>
            <Text style={[type.body, { color: c.textSecondary, fontSize: 20 }]}>›</Text>
          </Pressable>

          {/* App Card 3: Askesis */}
          <Pressable
            onPress={() => setCurrentApp('askesis')}
            style={({ pressed }) => [
              styles.appCard,
              {
                backgroundColor: c.card,
                borderColor: c.separator,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={{ fontFamily: 'EBGaramond_600SemiBold', fontSize: 21, color: c.text }}>
                Askesis
              </Text>
            </View>
            <Text style={[type.body, { color: c.textSecondary, fontSize: 20 }]}>›</Text>
          </Pressable>

          {/* App Card 4: Settings */}
          <Pressable
            onPress={() => setCurrentApp('settings')}
            style={({ pressed }) => [
              styles.appCard,
              {
                backgroundColor: c.card,
                borderColor: c.separator,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[type.title, { color: c.text, fontSize: 18 }]}>Settings</Text>
            </View>
            <Text style={[type.body, { color: c.textSecondary, fontSize: 20 }]}>›</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Inside The Study Container
  if (currentApp === 'study') {
    return <StudyScreen onBack={() => setCurrentApp('home')} />;
  }

  // Inside Vade Mecum Container
  if (currentApp === 'vade-mecum') {
    return <VadeMecumScreen onBack={() => setCurrentApp('home')} />;
  }

  // Inside Settings Container
  if (currentApp === 'settings') {
    return (
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <StatusBar style="auto" />

        {/* Top navigation header with back button */}
        <View
          style={[
            styles.topBar,
            {
              borderBottomColor: c.separator,
              backgroundColor: c.background,
            },
          ]}
        >
          <Pressable
            onPress={() => setCurrentApp('home')}
            style={styles.backButton}
            hitSlop={8}
          >
            <Text style={{ fontFamily: 'EBGaramond_500Medium', fontSize: 17, color: c.text }}>‹ Pallas</Text>
          </Pressable>
          <Text style={[type.bodyMedium, { color: c.textSecondary, fontWeight: '600' }]}>
            Settings
          </Text>
          <View style={{ width: 100 }} />
        </View>

        <View style={styles.content}>
          <SettingsScreen />
        </View>
      </View>
    );
  }

  // Inside Askesis Container
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: c.background },
      ]}
    >
      <StatusBar style="auto" />

      {/* Top navigation header with back button */}
      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: c.separator,
            backgroundColor: c.background,
          },
        ]}
      >
        <Pressable
          onPress={() => setCurrentApp('home')}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={{ fontFamily: 'EBGaramond_500Medium', fontSize: 17, color: c.text }}>‹ Pallas</Text>
        </Pressable>
        <Text style={[type.bodyMedium, { color: c.textSecondary, fontWeight: '600' }]}>
          Askesis
        </Text>
        <View style={{ width: 100 }} />
      </View>

      <View style={styles.content}>
        {askesisTab === 'fasting' && <FastingScreen />}
        {askesisTab === 'strength' && <StrengthScreen />}
        {askesisTab === 'weight' && <WeightScreen />}
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
        {ASKESIS_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={styles.tabButton}
            onPress={() => setAskesisTab(t.key)}
          >
            <Text
              style={[
                type.caption,
                {
                  color:
                    askesisTab === t.key
                      ? c.text
                      : c.textSecondary,
                  fontWeight:
                    askesisTab === t.key ? '600' : '400',
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

export default function App() {
  return (
    <SafeAreaProvider>
      <MainContent />
    </SafeAreaProvider>
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

  launcherContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.xl,
  },

  appCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },

  appIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  backButton: {
    width: 100,
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