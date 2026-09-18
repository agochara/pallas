import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  AppState,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
  StepsScreen,
  CoachScreen,
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

type AskesisTab = 'fasting' | 'strength' | 'weight' | 'steps' | 'coach';

export type RootStackParamList = {
  Home: undefined;
  Study: undefined;
  VadeMecum: undefined;
  Askesis: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const IMG_ASKESIS = require('../assets/a.png');
const IMG_STUDY = require('../assets/ts.png');
const IMG_VADE_MECUM = require('../assets/vm.png');

const ASKESIS_TABS: { key: AskesisTab; label: string }[] = [
  { key: 'steps', label: 'Steps' },
  { key: 'fasting', label: 'Fasting' },
  { key: 'strength', label: 'Strength' },
  { key: 'weight', label: 'Weight' },
  { key: 'coach', label: 'Coach' },
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

function StepsTabIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {/* Left footprint */}
      <Path
        d="M6 13.5C6 11.8 7 10.5 8 10.5C9 10.5 10 11.8 10 13.5C10 15 9.2 16 8 16C6.8 16 6 15 6 13.5ZM6.5 19C6.5 17.8 7.2 17 8 17C8.8 17 9.5 17.8 9.5 19C9.5 20.2 8.8 21 8 21C7.2 21 6.5 20.2 6.5 19Z"
        fill={color}
      />
      {/* Right footprint */}
      <Path
        d="M13.5 6.5C13.5 4.8 14.5 3.5 15.5 3.5C16.5 3.5 17.5 4.8 17.5 6.5C17.5 8 16.7 9 15.5 9C14.3 9 13.5 8 13.5 6.5ZM14 12C14 10.8 14.7 10 15.5 10C16.3 10 17 10.8 17 12C17 13.2 16.3 14 15.5 14C14.7 14 14 13.2 14 12Z"
        fill={color}
      />
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
  imageSource,
  imagePosition,
  containerLevel = 'surfaceContainer',
  shape = 'largeIncreased',
  height,
  titleStyle,
  onPress,
}: {
  title: string;
  imageSource?: any;
  imagePosition?: any;
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
          overflow: 'hidden',
        },
      ]}
    >
      {imageSource && (
        <Image
          source={imageSource}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          contentPosition={imagePosition || 'center'}
          transition={0}
          cachePolicy="memory-disk"
        />
      )}
      {imageSource && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
      )}
      <Text 
        style={[
          styles.m3LauncherCardTitle, 
          !imageSource && { color: m3.onSurface },
          titleStyle,
          imageSource && { 
            fontFamily: 'EBGaramond_500Medium',
            fontSize: (titleStyle?.fontSize || 24) + 6, // Garamond needs a boost to match sans-serif visual weight
            color: '#FFFFFF',
            textShadowColor: 'rgba(0,0,0,0.85)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }
        ]}
      >
        {title}
      </Text>
    </M3Pressable>
  );
}

function M3NavigationBar({
  currentTab,
  onSelectTab,
  hasEvents = false,
}: {
  currentTab: AskesisTab;
  onSelectTab: (tab: AskesisTab) => void;
  hasEvents?: boolean;
}) {
  const m3 = useM3Theme();

  return (
    <View
      style={[
        styles.m3NavBar,
        {
          backgroundColor: m3.surfaceContainerLow,
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
              {t.key === 'steps' && <StepsTabIcon color={iconColor} />}
              {t.key === 'coach' && (
                <>
                  <CoachTabIcon color={iconColor} />
                  {hasEvents && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 18,
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: m3.error,
                      }}
                    />
                  )}
                </>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={[
                active ? m3Type.labelSmallEmphasized : m3Type.labelSmall,
                {
                  color: active ? m3.onSurface : m3.onSurfaceVariant,
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


function HomeScreen({ navigation }: any) {
  const m3 = useM3Theme();

  return (
    <View style={[styles.root, { backgroundColor: m3.surface }]}>
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
            imageSource={IMG_STUDY}
            imagePosition="center"
            containerLevel="surfaceContainerHigh"
            shape="extraLarge"
            height={190}
            titleStyle={m3Type.headlineMediumEmphasized}
            onPress={() => navigation.navigate('Study')}
          />
        </View>

        {/* 2-Column Secondary Grid */}
        <View style={styles.secondaryGridRow}>
          {/* Left Container: Vade Mecum */}
          <View style={{ flex: 1 }}>
            <M3LauncherCard
              title="Vade Mecum"
              imageSource={IMG_VADE_MECUM}
              imagePosition="center"
              containerLevel="surfaceContainerHigh"
              shape="largeIncreased"
              height={210}
              titleStyle={m3Type.titleLargeEmphasized}
              onPress={() => navigation.navigate('VadeMecum')}
            />
          </View>

          {/* Right Container: Askesis */}
          <View style={{ flex: 1 }}>
            <M3LauncherCard
              title="Askesis"
              imageSource={IMG_ASKESIS}
              imagePosition={{left: "20%"}}
              containerLevel="surfaceContainerHigh"
              shape="largeIncreased"
              height={210}
              titleStyle={m3Type.titleLargeEmphasized}
              onPress={() => navigation.navigate('Askesis')}
            />
          </View>
        </View>

        {/* Subordinate Settings Control */}
        <View style={styles.settingsWrap}>
          <M3Pressable
            onPress={() => navigation.navigate('Settings')}
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
              style={[m3Type.labelLargeEmphasized, { color: m3.onSurfaceVariant }]}
              numberOfLines={1}
            >
              Settings
            </Text>
          </M3Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function StudyScreenWrapper({ navigation }: any) {
  return <StudyScreen onBack={() => navigation.goBack()} />;
}

function VadeMecumScreenWrapper({ navigation }: any) {
  return <VadeMecumScreen onBack={() => navigation.goBack()} />;
}

function SettingsScreenWrapper({ navigation }: any) {
  const m3 = useM3Theme();
  return (
    <View style={[styles.root, { backgroundColor: m3.surface }]}>
      <StatusBar style="auto" />
      <M3TopAppBar title="Settings" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        <SettingsScreen />
      </View>
    </View>
  );
}

function AskesisScreenWrapper({ navigation }: any) {
  const m3 = useM3Theme();
  const [askesisTab, setAskesisTab] = useState<AskesisTab>('steps');
  const [hasEvents, setHasEvents] = useState(false);

  useEffect(() => {
    const checkEvents = () => {
      import('./database/db').then((db) => {
        db.getCoachEvents().then((events) => {
          setHasEvents(events.length > 0);
        });
      });
    };
    checkEvents();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkEvents();
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: m3.surface }]}>
      <StatusBar style="auto" />
      <M3TopAppBar title="Askesis" onBack={() => navigation.goBack()} />
      <View style={styles.content}>
        {askesisTab === 'fasting' && <FastingScreen />}
        {askesisTab === 'strength' && <StrengthScreen />}
        {askesisTab === 'weight' && <WeightScreen />}
        {askesisTab === 'steps' && <StepsScreen />}
        {askesisTab === 'coach' && <CoachScreen />}
      </View>
      <M3NavigationBar currentTab={askesisTab} onSelectTab={setAskesisTab} hasEvents={hasEvents} />
    </View>
  );
}

function AppRoot() {
  const m3 = useM3Theme();
  const [ready, setReady] = useState(false);

  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
    EBGaramond_400Regular_Italic,
  });

  useEffect(() => {
    initDatabase().then(async () => {
      setReady(true);

      // Warm the Askesis caches so switching tabs (and the first Steps render)
      // paints complete content instead of flashing empty state.
      import('./askesis/stepsStore').then((m) => m.loadStepsFromDb());
      import('./askesis/askesisCache').then((m) => m.warmAskesisCache());

      import('./coach/backgroundTask').then(async (m) => {
        m.registerCoachBackgroundTask();
        const { getCoachSteps } = await import('./database/db');
        const steps = await getCoachSteps();
        if (steps.length === 0) {
          await m.executeCoachSync();
        }
        // Backfill a year of history once so every graph range is meaningful.
        await m.ensureStepsBackfill();
      });
    });
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: m3.surface }]}>
        <ActivityIndicator color={m3.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: m3.surface }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Study" component={StudyScreenWrapper} />
          <Stack.Screen name="VadeMecum" component={VadeMecumScreenWrapper} />
          <Stack.Screen name="Askesis" component={AskesisScreenWrapper} />
          <Stack.Screen name="Settings" component={SettingsScreenWrapper} />
        </Stack.Navigator>
      </NavigationContainer>
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
    paddingTop: Platform.OS === 'ios' ? 48 : (RNStatusBar.currentHeight ?? 24) + 16,
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
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  m3LauncherCardTitle: {
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
// Placeholder for CoachTabIcon
export function CoachTabIcon({ color }: { color: string }) {
  return (
<Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  {/* Helmet + head silhouette */}
  <Path
    d="
      M6.1 10.1
      C5.8 7.2 6.8 4.9 8.9 3.5
      C10.2 2.6 11.9 2.2 13.5 2.5
      C15.1 2.8 16.4 3.7 17.1 5
      C17.7 6.1 17.8 7.4 17.5 8.5

      C17.2 8.8 17 9.1 17.1 9.4
      L18.3 10.1
      L17.1 10.8
      L17.4 11.6
      L16.5 12.1
      C16.2 13.4 15.5 14.4 14.4 15.1
      C13.7 15.6 12.9 15.8 12.1 15.7

      L11.9 17.2
      L8.9 17.8
      L7.3 16.2
      C6.7 14.8 6.2 13.2 6.1 10.1
      Z
    "
    fill={color}
  />

  {/* Helmet crest */}
  <Path
    d="
      M7.3 5.1
      C7.8 3.2 9.1 1.7 10.9 1
      C11.8 0.7 12.8 0.8 13.7 1.2
      C12.5 1.8 11.5 2.7 10.8 3.8
      C9.6 4 8.4 4.5 7.3 5.1
      Z
    "
    fill={color}
  />

  {/* Shoulder / bust */}
  <Path
    d="
      M8.9 16.5
      C7.1 17 5.3 18 4.1 19.5
      C3.4 20.4 3 21.2 2.8 22
      H21.2
      C21 21.2 20.6 20.4 19.9 19.5
      C18.7 18 16.9 17 14.9 16.5
      C13.8 17.3 12.5 17.7 11.9 17.7
      C10.9 17.7 9.8 17.3 8.9 16.5
      Z
    "
    fill={color}
  />
</Svg>
  );
}
