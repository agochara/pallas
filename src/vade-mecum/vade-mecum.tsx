import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  useColorScheme,
} from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { getVadeMecum, saveVadeMecum } from '../database/db';

// Dedicated Vade Mecum Parchment & Ink Palette
const lightVadePalette = {
  background: '#F3EBDD', // warm parchment / ivory paper
  text: '#29251F',       // dark warm charcoal/ink
  textSecondary: '#756E62',
  separator: '#D8CFBF',
  accent: '#5E5244',
  highlight: '#E7D7A8',
  highlightActive: '#D8BE72',
};

const darkVadePalette = {
  background: '#211F1B', // deep warm dark charcoal paper
  text: '#E8E0D2',       // ivory ink
  textSecondary: '#9D9588',
  separator: '#3B3730',
  accent: '#C4B59D',
  highlight: '#4A4230',
  highlightActive: '#6E5C33',
};

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

type Match = { start: number; end: number };

type Segment = { text: string; matchIndex: number | null };

// Case-insensitive, non-overlapping search over the whole manuscript.
function findMatches(text: string, query: string): Match[] {
  if (!query) return [];
  const matches: Match[] = [];
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    matches.push({ start: index, end: index + needle.length });
    index = haystack.indexOf(needle, index + needle.length);
  }
  return matches;
}

type Paragraph = { index: number; start: number; end: number; text: string };

// Split the manuscript into newline-delimited blocks while tracking each
// block's character range, so an inline match can be mapped back to a block.
function splitParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split('\n');
  let cursor = 0;
  lines.forEach((line, index) => {
    const start = cursor;
    const end = start + line.length;
    paragraphs.push({ index, start, end, text: line });
    cursor = end + 1; // account for the removed newline
  });
  return paragraphs;
}

function buildParagraphSegments(
  content: string,
  paragraph: Paragraph,
  matches: { match: Match; matchIndex: number }[]
): Segment[] {
  const segments: Segment[] = [];
  let cursor = paragraph.start;

  matches.forEach(({ match, matchIndex }) => {
    const start = Math.max(match.start, paragraph.start);
    const end = Math.min(match.end, paragraph.end);

    if (start > cursor) {
      segments.push({ text: content.slice(cursor, start), matchIndex: null });
    }
    segments.push({ text: content.slice(start, end), matchIndex });
    cursor = end;
  });

  if (cursor < paragraph.end) {
    segments.push({ text: content.slice(cursor, paragraph.end), matchIndex: null });
  }
  return segments;
}

export function VadeMecumScreen({ onBack }: { onBack: () => void }) {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? darkVadePalette : lightVadePalette;

  const [content, setContent] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [activeMatch, setActiveMatch] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestContentRef = useRef<string>('');
  const scrollRef = useRef<ScrollView | null>(null);
  const paragraphLayoutsRef = useRef<Record<number, number>>({});

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

  const matches = useMemo(() => findMatches(content, query), [content, query]);

  const paragraphs = useMemo(() => splitParagraphs(content), [content]);

  // Bucket matches into their paragraph in a single pass (both lists are
  // ordered by position), and remember the paragraph per match for scrolling.
  const { paragraphMatches, matchParagraph } = useMemo(() => {
    const buckets: { match: Match; matchIndex: number }[][] = paragraphs.map(() => []);
    const matchParagraph: number[] = new Array(matches.length).fill(0);
    let cursor = 0;

    matches.forEach((match, matchIndex) => {
      while (
        cursor < paragraphs.length - 1 &&
        match.start > paragraphs[cursor].end
      ) {
        cursor++;
      }
      const paragraphIndex = paragraphs[cursor].index;
      matchParagraph[matchIndex] = paragraphIndex;
      buckets[paragraphIndex].push({ match, matchIndex });
    });

    return { paragraphMatches: buckets, matchParagraph };
  }, [matches, paragraphs]);

  const paragraphSegments = useMemo(
    () => paragraphs.map((p, i) => buildParagraphSegments(content, p, paragraphMatches[i])),
    [paragraphs, content, paragraphMatches]
  );

  // Restart match navigation whenever the query changes. Paragraph offsets are
  // independent of the query, so they are kept and reused for scrolling.
  useEffect(() => {
    setActiveMatch(0);
  }, [query]);

  // Keep the active match in range as the document or query changes.
  useEffect(() => {
    if (activeMatch >= matches.length) {
      setActiveMatch(matches.length > 0 ? matches.length - 1 : 0);
    }
  }, [matches.length, activeMatch]);

  // Scroll the paragraph containing the active match into view.
  useEffect(() => {
    if (!searching || matches.length === 0) return;
    const paragraphIndex = matchParagraph[activeMatch];
    const y = paragraphLayoutsRef.current[paragraphIndex];
    if (typeof y !== 'number') return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 88), animated: true });
  }, [searching, activeMatch, matches.length, query, layoutTick, matchParagraph]);

  const openSearch = useCallback(() => {
    setQuery('');
    setActiveMatch(0);
    paragraphLayoutsRef.current = {};
    setSearching(true);
  }, []);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearching(false);
  }, []);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatch((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatch((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const hasMatches = matches.length > 0;

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

        <View style={styles.headerRight}>
          <Pressable
            onPress={searching ? closeSearch : openSearch}
            hitSlop={12}
            style={styles.searchToggle}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx="11" cy="11" r="7" stroke={c.textSecondary} strokeWidth="1.8" />
              <Line
                x1="16.5"
                y1="16.5"
                x2="21"
                y2="21"
                stroke={c.textSecondary}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
      {searching && (
        <View style={[styles.searchBar, { borderBottomColor: c.separator }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the manuscript..."
            placeholderTextColor={c.textSecondary + '80'}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={c.accent}
            cursorColor={c.accent}
            style={[
              styles.searchInput,
              { color: c.text, fontFamily: garamondRegular },
            ]}
          />

          <Text
            style={[
              styles.matchCount,
              { color: c.textSecondary, fontFamily: garamondMedium },
            ]}
          >
            {query.length === 0 ? '' : hasMatches ? `${activeMatch + 1}/${matches.length}` : 'none'}
          </Text>

          <Pressable
            onPress={goToPrev}
            disabled={!hasMatches}
            hitSlop={10}
            style={styles.searchNavBtn}
          >
            <Text
              style={[
                styles.searchNavText,
                { color: hasMatches ? c.text : c.textSecondary + '50' },
              ]}
            >
              ‹
            </Text>
          </Pressable>

          <Pressable
            onPress={goToNext}
            disabled={!hasMatches}
            hitSlop={10}
            style={styles.searchNavBtn}
          >
            <Text
              style={[
                styles.searchNavText,
                { color: hasMatches ? c.text : c.textSecondary + '50' },
              ]}
            >
              ›
            </Text>
          </Pressable>

          <Pressable onPress={closeSearch} hitSlop={10} style={styles.searchNavBtn}>
            <Text style={[styles.searchCloseText, { color: c.textSecondary }]}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Parchment Manuscript Page */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        {searching ? (
          <ScrollView
            ref={scrollRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              {paragraphs.map((paragraph, pIndex) => {
                const segments = paragraphSegments[pIndex] ?? [];
                return (
                  <View
                    key={pIndex}
                    onLayout={(e) => {
                      const y = e.nativeEvent.layout.y;
                      if (paragraphLayoutsRef.current[pIndex] !== y) {
                        paragraphLayoutsRef.current[pIndex] = y;
                        setLayoutTick((t) => t + 1);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.readText,
                        { color: c.text, fontFamily: garamondRegular },
                      ]}
                    >
                      {paragraph.text.length === 0
                        ? '\u00A0'
                        : segments.map((segment, index) => {
                            if (segment.matchIndex === null) {
                              return <Text key={index}>{segment.text}</Text>;
                            }
                            const isActive = segment.matchIndex === activeMatch;
                            return (
                              <Text
                                key={index}
                                style={{
                                  backgroundColor: isActive
                                    ? c.highlightActive
                                    : c.highlight,
                                }}
                              >
                                {segment.text}
                              </Text>
                            );
                          })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
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
        )}
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
  headerRight: {
    width: 90,
    alignItems: 'flex-end',
  },
  searchToggle: {
    padding: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 6,
    paddingRight: 8,
  },
  matchCount: {
    fontSize: 15,
    marginRight: 6,
    minWidth: 40,
    textAlign: 'right',
  },
  searchNavBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  searchNavText: {
    fontSize: 22,
    lineHeight: 24,
  },
  searchCloseText: {
    fontSize: 16,
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
  readText: {
    fontSize: 19.5,
    lineHeight: 33,
  },
});
