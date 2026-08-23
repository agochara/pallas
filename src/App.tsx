import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import Svg, {
  Rect,
  Path,
  Circle,
  Line,
} from 'react-native-svg';

import { useM3Theme, m3Type, m3Shape } from './themes/theme';
import { M3Pressable, M3TopAppBar } from './themes/m3-components';
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

function FastingTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" />
      <Path d="M12 7.5V12L15 14.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function StrengthTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="12" x2="18" y2="12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Rect x="4" y="7" width="2" height="10" rx="1" fill={color} />
      <Rect x="18" y="7" width="2" height="10" rx="1" fill={color} />
      <Rect x="1.5" y="9" width="2" height="6" rx="1" fill={color} />
      <Rect x="20.5" y="9" width="2" height="6" rx="1" fill={color} />
    </Svg>
  );
}

function WeightTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="5" stroke={color} strokeWidth="2" />
      <Path d="M7 8.5C7 8.5 9 6.5 12 6.5C15 6.5 17 8.5 17 8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="12" y1="10" x2="14" y2="7.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
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

function M3LauncherCard({
  title,
  containerLevel = 'surfaceContainer',
  shape = 'largeIncreased',
  height,
  titleStyle,
  onPress,
}: {
  title: string;
  containerLevel?: 'surfaceContainer' | 'surfaceContainerHigh' | 'surfaceContainerHighest' | 'primaryContainer';
  shape?: keyof typeof m3Shape;
  height: number;
  titleStyle?: any;
  onPress: () => void;
}) {
  const m3 = useM3Theme();
  const borderRadius = m3Shape[shape] ?? m3Shape.largeIncreased;

  return (
    <M3Pressable
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.m3LauncherCard,
        {
          backgroundColor: m3[containerLevel],
          borderRadius,
          height,
          width: '100%',
        },
      ]}
    >
      <Text style={[styles.m3LauncherCardTitle, { color: m3.onSurface }, titleStyle]}>
        {title}
      </Text>
    </M3Pressable>
  );
}

function M3NavigationBar({
  currentTab,
  onSelectTab,
}: {
  currentTab: AskesisTab;
  onSelectTab: (tab: AskesisTab) => void;
}) {
  const m3 = useM3Theme();

  return (
    <View
      style={[
        styles.m3NavBar,
        {
          backgroundColor: m3.surfaceContainerLow,
          borderTopColor: m3.outlineVariant,
        },
      ]}
    >
      {ASKESIS_TABS.map((t) => {
        const active = currentTab === t.key;
        const iconColor = active ? m3.onPrimaryContainer : m3.onSurfaceVariant;

        return (
          <M3Pressable
            key={t.key}
            style={styles.m3NavTab}
            scaleTo={0.94}
            onPress={() => onSelectTab(t.key)}
          >
            {/* Deterministic Shared Indicator */}
            <View
              style={[
                styles.m3NavPill,
                {
                  backgroundColor: active ? m3.primaryContainer : 'transparent',
                },
              ]}
            >
              {t.key === 'fasting' && <FastingTabIcon color={iconColor} />}
              {t.key === 'strength' && <StrengthTabIcon color={iconColor} />}
              {t.key === 'weight' && <WeightTabIcon color={iconColor} />}
            </View>
            <Text
              style={[
                m3Type.labelSmall,
                {
                  color: active ? m3.onSurface : m3.onSurfaceVariant,
                  fontWeight: active ? '600' : '400',
                  textAlign: 'center',
                  alignSelf: 'center',
                },
              ]}
            >
              {t.label}
            </Text>
          </M3Pressable>
        );
      })}
    </View>
  );
}


function MainContent() {
  const m3 = useM3Theme();

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
          { backgroundColor: m3.surface },
        ]}
      >
        <ActivityIndicator color={m3.primary} />
      </View>
    );
  }

  // Pallas Launcher Home Screen (Material 3 Expressive)
  if (currentApp === 'home') {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: m3.surface }]}>
        <StatusBar style="auto" />
        <ScrollView
          contentContainerStyle={styles.launcherContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.launcherHeader}>
            <Text
              style={{
                fontFamily: 'EBGaramond_700Bold',
                fontSize: 34,
                color: m3.onSurface,
                letterSpacing: 4,
                textAlign: 'center',
              }}
            >
              PALLAS
            </Text>

            {/* Tagline */}
            <Text
              style={{
                fontFamily: 'EBGaramond_400Regular_Italic',
                fontSize: 12,
                color: m3.onSurfaceVariant,
                textAlign: 'center',
                letterSpacing: 1,
                marginTop: 6,
              }}
            >
              UNA SALUS VICTIS · NULLAM SPERARE SALUTEM
            </Text>
          </View>

          {/* Featured Focal Container: The Study */}
          <View style={{ marginBottom: 14, width: '100%' }}>
            <M3LauncherCard
              title="The Study"
              containerLevel="surfaceContainerHigh"
              shape="extraLarge"
              height={145}
              titleStyle={m3Type.headlineMedium}
              onPress={() => setCurrentApp('study')}
            />
          </View>

          {/* 2-Column Secondary Grid */}
          <View style={styles.secondaryGridRow}>
            {/* Left Container: Vade Mecum */}
            <View style={{ flex: 1 }}>
              <M3LauncherCard
                title="Vade Mecum"
                containerLevel="surfaceContainer"
                shape="largeIncreased"
                height={175}
                titleStyle={m3Type.titleLarge}
                onPress={() => setCurrentApp('vade-mecum')}
              />
            </View>

            {/* Right Container: Askesis */}
            <View style={{ flex: 1 }}>
              <M3LauncherCard
                title="Askesis"
                containerLevel="surfaceContainer"
                shape="largeIncreased"
                height={175}
                titleStyle={m3Type.titleLarge}
                onPress={() => setCurrentApp('askesis')}
              />
            </View>
          </View>

          {/* Subordinate Settings Control */}
          <View style={styles.settingsWrap}>
            <M3Pressable
              onPress={() => setCurrentApp('settings')}
              scaleTo={0.96}
              style={[
                styles.settingsPill,
                {
                  backgroundColor: m3.surfaceContainerHigh,
                },
              ]}
            >
              <SettingsPlaceholderIcon color={m3.primary} />
              <Text
                style={[m3Type.labelLarge, { color: m3.onSurfaceVariant }]}
                numberOfLines={1}
              >
                Settings
              </Text>
            </M3Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // The Study Screen (Destination's own UI)
  if (currentApp === 'study') {
    return <StudyScreen onBack={() => setCurrentApp('home')} />;
  }

  // Vade Mecum Screen (Destination's own UI)
  if (currentApp === 'vade-mecum') {
    return <VadeMecumScreen onBack={() => setCurrentApp('home')} />;
  }

  // Settings Screen
  if (currentApp === 'settings') {
    return (
      <View style={[styles.root, { backgroundColor: m3.surface }]}>
        <StatusBar style="auto" />
        <M3TopAppBar
          title="Settings"
          onBack={() => setCurrentApp('home')}
        />
        <View style={styles.content}>
          <SettingsScreen />
        </View>
      </View>
    );
  }

  // Inside Askesis Container (Material 3 Expressive)
  if (currentApp === 'askesis') {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: m3.surface },
        ]}
      >
        <StatusBar style="auto" />
        <M3TopAppBar
          title="Askesis"
          onBack={() => setCurrentApp('home')}
        />

        <View style={styles.content}>
          {askesisTab === 'fasting' && <FastingScreen />}
          {askesisTab === 'strength' && <StrengthScreen />}
          {askesisTab === 'weight' && <WeightScreen />}
        </View>

        {/* Material 3 Expressive Shared Bottom Navigation Bar */}
        <M3NavigationBar
          currentTab={askesisTab}
          onSelectTab={setAskesisTab}
        />
      </View>
    );
  }
}


function AppRoot() {
  const m3 = useM3Theme();
  return (
    <SafeAreaProvider style={{ backgroundColor: m3.surface }}>
      <MainContent />
    </SafeAreaProvider>
  );
}

export default function App() {
  return <AppRoot />;
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
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    paddingBottom: 40,
  },

  launcherHeader: {
    marginBottom: 28,
    alignItems: 'center',
  },

  secondaryGridRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 28,
  },

  m3LauncherCard: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  m3LauncherCardTitle: {
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  settingsWrap: {
    alignItems: 'center',
    marginTop: 4,
  },

  settingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 9999,
    gap: 8,
  },

  content: {
    flex: 1,
  },

  m3NavBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
    height: Platform.OS === 'ios' ? 88 : 80,
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  m3NavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  m3NavPill: {
    width: 64,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});