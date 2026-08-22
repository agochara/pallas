import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { getVadeMecum, saveVadeMecum } from '../database/db';

// Dedicated Vade Mecum Parchment & Ink Palette
const lightVadePalette = {
  background: '#F3EBDD', // warm parchment / ivory paper
  text: '#29251F',       // dark warm charcoal/ink
  textSecondary: '#756E62',
  separator: '#D8CFBF',
  accent: '#5E5244',
};

const darkVadePalette = {
  background: '#211F1B', // deep warm dark charcoal paper
  text: '#E8E0D2',       // ivory ink
  textSecondary: '#9D9588',
  separator: '#3B3730',
  accent: '#C4B59D',
};

export function VadeMecumScreen({ onBack }: { onBack: () => void }) {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? darkVadePalette : lightVadePalette;

  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef<string>('');

  useEffect(() => {
    getVadeMecum().then((saved) => {
      setContent(saved);
      latestContentRef.current = saved;
      setLoaded(true);
    });
  }, []);

  const handleChangeText = useCallback((text: string) => {
    setContent(text);
    latestContentRef.current = text;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveVadeMecum(text);
    }, 400);
  }, []);

  const handleBack = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveVadeMecum(latestContentRef.current);
    onBack();
  }, [onBack]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveVadeMecum(latestContentRef.current);
    };
  }, []);

  const garamondRegular = Platform.select({
    ios: 'EBGaramond_400Regular',
    android: 'EBGaramond_400Regular',
    default: 'EBGaramond_400Regular',
  });

  const garamondMedium = Platform.select({
    ios: 'EBGaramond_500Medium',
    android: 'EBGaramond_500Medium',
    default: 'EBGaramond_500Medium',
  });

  const garamondBold = Platform.select({
    ios: 'EBGaramond_700Bold',
    android: 'EBGaramond_700Bold',
    default: 'EBGaramond_700Bold',
  });

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: c.separator,
            backgroundColor: c.background,
          },
        ]}
      >
        <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
          <Text
            style={[
              styles.backBtnText,
              {
                color: c.textSecondary,
                fontFamily: garamondMedium,
              },
            ]}
          >
            ‹ Pallas
          </Text>
        </Pressable>

        <Text
          style={[
            styles.title,
            {
              color: c.text,
              fontFamily: garamondBold,
            },
          ]}
        >
          VADE MECUM
        </Text>

        <View style={styles.headerRightSpacer} />
      </View>

      {/* Parchment Manuscript Page */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            multiline
            scrollEnabled={false}
            value={content}
            onChangeText={handleChangeText}
            placeholder={loaded ? 'Type anything...' : ''}
            placeholderTextColor={c.textSecondary + '70'}
            autoCorrect={false}
            autoCapitalize="sentences"
            textAlignVertical="top"
            selectionColor={c.accent}
            cursorColor={c.accent}
            style={[
              styles.input,
              {
                color: c.text,
                fontFamily: garamondRegular,
              },
            ]}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 90,
  },
  backBtnText: {
    fontSize: 17,
  },
  title: {
    fontSize: 15,
    letterSpacing: 4,
  },
  headerRightSpacer: {
    width: 90,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 160,
  },
  input: {
    flex: 1,
    fontSize: 19.5,
    lineHeight: 33,
    padding: 0,
    margin: 0,
  },
});

