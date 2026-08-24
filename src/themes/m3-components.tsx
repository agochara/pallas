import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AccessibilityInfo,
  StatusBar,
} from 'react-native';
import { useM3Theme, m3Shape, m3Type, motionSprings, M3Theme } from './theme';

// ============================================================================
// M3 EXPRESSIVE SPRING-BASED PRESSABLE
// ============================================================================

// Cache reduce motion globally to prevent state thrashing/re-renders on mount
let isReduceMotionActive = false;
AccessibilityInfo.isReduceMotionEnabled().then((res) => {
  isReduceMotionActive = res;
});
AccessibilityInfo.addEventListener('reduceMotionChanged', (res) => {
  isReduceMotionActive = res;
});

export function M3Pressable({
  children,
  onPress,
  disabled,
  style,
  scaleTo = 0.96,
  springConfig = motionSprings.expressiveFast,
  ...props
}: {
  children: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  scaleTo?: number;
  springConfig?: { damping: number; stiffness: number; mass: number };
  [key: string]: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    if (disabled) return;
    setPressed(true);
    if (!isReduceMotionActive) {
      Animated.spring(scale, {
        toValue: scaleTo,
        damping: springConfig.damping,
        stiffness: springConfig.stiffness,
        mass: springConfig.mass,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    setPressed(false);
    if (!isReduceMotionActive) {
      Animated.spring(scale, {
        toValue: 1,
        damping: springConfig.damping,
        stiffness: springConfig.stiffness,
        mass: springConfig.mass,
        useNativeDriver: true,
      }).start();
    }
  };

  const flattened = StyleSheet.flatten(style) || {};
  const outerStyle: any = {};
  if (flattened.flex !== undefined) outerStyle.flex = flattened.flex;
  if (flattened.width !== undefined) outerStyle.width = flattened.width;
  if (flattened.height !== undefined) outerStyle.height = flattened.height;
  if (flattened.alignSelf !== undefined) outerStyle.alignSelf = flattened.alignSelf;
  if (flattened.margin !== undefined) outerStyle.margin = flattened.margin;
  if (flattened.marginBottom !== undefined) outerStyle.marginBottom = flattened.marginBottom;
  if (flattened.marginTop !== undefined) outerStyle.marginTop = flattened.marginTop;
  if (flattened.marginHorizontal !== undefined) outerStyle.marginHorizontal = flattened.marginHorizontal;
  if (flattened.marginVertical !== undefined) outerStyle.marginVertical = flattened.marginVertical;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={outerStyle}
      {...props}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {typeof children === 'function' ? children({ pressed }) : children}
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// M3 EXPRESSIVE CARD
// ============================================================================

export function M3Card({
  children,
  style,
  shape = 'extraLarge',
  containerLevel = 'surfaceContainer',
  variant = 'filled',
}: {
  children: React.ReactNode;
  style?: any;
  shape?: keyof typeof m3Shape;
  containerLevel?:
    | 'surfaceBright'
    | 'surfaceContainer'
    | 'surfaceContainerLow'
    | 'surfaceContainerHigh'
    | 'surfaceContainerHighest'
    | 'surfaceContainerLowest';
  variant?: 'filled' | 'outlined' | 'elevated';
}) {
  const m3 = useM3Theme();
  const borderRadius = m3Shape[shape] ?? m3Shape.extraLarge;

  const isOutlined = variant === 'outlined';
  const isElevated = variant === 'elevated';

  return (
    <View
      style={[
        {
          backgroundColor: isOutlined ? 'transparent' : (m3[containerLevel] || m3.surfaceBright),
          borderRadius,
          padding: 20,
          borderWidth: isOutlined ? 1 : 0,
          borderColor: isOutlined ? m3.outlineVariant : undefined,

          ...(isElevated
            ? {
                shadowColor: m3.scrim,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 2,
              }
            : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// M3 EXPRESSIVE BUTTONS
// ============================================================================

export function M3FilledButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
}) {
  const m3 = useM3Theme();
  return (
    <M3Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.filledBtn,
        {
          backgroundColor: m3.primary,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      <Text style={[m3Type.labelLargeEmphasized, { color: m3.onPrimary, textAlign: 'center' }, textStyle]}>
        {label}
      </Text>
    </M3Pressable>
  );
}

export function M3TonalButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
}) {
  const m3 = useM3Theme();
  return (
    <M3Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.tonalBtn,
        {
          backgroundColor: m3.secondaryContainer,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      <Text style={[m3Type.labelLargeEmphasized, { color: m3.onSecondaryContainer, textAlign: 'center' }, textStyle]}>
        {label}
      </Text>
    </M3Pressable>
  );
}

export function M3OutlinedButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
}) {
  const m3 = useM3Theme();
  return (
    <M3Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.outlinedBtn,
        {
          borderColor: m3.outlineVariant,
          backgroundColor: m3.surfaceContainerLow,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      <Text style={[m3Type.labelLargeEmphasized, { color: m3.onSurface, textAlign: 'center' }, textStyle]}>
        {label}
      </Text>
    </M3Pressable>
  );
}

export function M3ErrorButton({
  label,
  onPress,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
}) {
  const m3 = useM3Theme();
  return (
    <M3Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.errorBtn,
        {
          backgroundColor: m3.errorContainer,
          opacity: disabled ? 0.38 : 1,
        },
        style,
      ]}
    >
      <Text style={[m3Type.labelLargeEmphasized, { color: m3.onErrorContainer, textAlign: 'center' }, textStyle]}>
        {label}
      </Text>
    </M3Pressable>
  );
}

// ============================================================================
// M3 EXPRESSIVE FAB (FLOATING ACTION BUTTON)
// ============================================================================

export function M3FAB({
  label,
  onPress,
  icon,
  style,
}: {
  label?: string;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: any;
}) {
  const m3 = useM3Theme();
  
  return (
    <M3Pressable
      onPress={onPress}
      scaleTo={0.92}
      style={[
        {
          position: 'absolute',
          bottom: 24,
          right: 24,
          backgroundColor: m3.primaryContainer,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: label ? 20 : 16,
          height: 56,
          minWidth: 56,
          shadowColor: m3.scrim,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
          zIndex: 100,
        },
        style,
      ]}
    >
      {icon && <View style={label ? { marginRight: 8 } : {}}>{icon}</View>}
      {label && (
        <Text style={[m3Type.labelLargeEmphasized, { color: m3.onPrimaryContainer }]}>
          {label}
        </Text>
      )}
    </M3Pressable>
  );
}

// ============================================================================
// M3 EXPRESSIVE SEGMENTED BUTTON
// ============================================================================

export function M3SegmentedButton<T extends string>({
  options,
  selected,
  onSelect,
  style,
}: {
  options: { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  style?: any;
}) {
  const m3 = useM3Theme();
  return (
    <View style={[styles.segmentedWrap, { backgroundColor: m3.surfaceContainerHighest }, style]}>
      {options.map((opt) => {
        const active = selected === opt.key;
        return (
          <M3Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            scaleTo={0.95}
            style={[
              styles.segmentItem,
              active && {
                backgroundColor: m3.secondaryContainer,
                borderRadius: m3Shape.full,
              },
            ]}
          >
            <Text
              style={[
                active ? m3Type.labelMediumEmphasized : m3Type.labelMedium,
                {
                  color: active ? m3.onSecondaryContainer : m3.onSurfaceVariant,
                  textAlign: 'center',
                },
              ]}
            >
              {opt.label}
            </Text>
          </M3Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// M3 TOP APP BAR (WITH < PALLAS IN GARAMOND)
// ============================================================================

export function M3TopAppBar({
  title,
  onBack,
  actionButton,
}: {
  title: string;
  onBack: () => void;
  actionButton?: React.ReactNode;
}) {
  const m3 = useM3Theme();
  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor: m3.surface,
        },
      ]}
    >
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Text style={{ fontFamily: 'EBGaramond_500Medium', fontSize: 17, color: m3.pallasBlue }}>
          ‹ Pallas
        </Text>
      </Pressable>
      <Text
        style={[
          m3Type.labelLargeEmphasized,
          {
            color: m3.onSurfaceVariant,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          },
        ]}
      >
        {title}
      </Text>
      <View style={styles.actionWrap}>{actionButton || <View style={{ width: 60 }} />}</View>
    </View>
  );
}

// ============================================================================
// M3 BOTTOM SHEET MODAL
// ============================================================================

export function M3BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const m3 = useM3Theme();
  
  // Use a local state to delay unmounting so the exit animation can play
  const [show, setShow] = React.useState(visible);
  const animValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setShow(true);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else if (show) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShow(false);
      });
    }
  }, [visible]);

  if (!show) return null;

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0], // slide up from 600px down
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal visible={show} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.4)', opacity }]} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalWrap, { backgroundColor: 'transparent' }]}
      >
        <Animated.View style={[styles.sheetContent, { backgroundColor: m3.surfaceContainerHigh, transform: [{ translateY }] }]}>
          {/* M3 Standard Drag Handle */}
          <View style={[styles.dragHandle, { backgroundColor: m3.outlineVariant }]} />

          <View style={styles.sheetHeader}>
            <Text style={[m3Type.titleLargeEmphasized, { color: m3.onSurface }]}>{title}</Text>
            <M3Pressable
              onPress={onClose}
              hitSlop={12}
              scaleTo={0.9}
              style={[styles.closeBtn, { backgroundColor: m3.surfaceContainerHighest }]}
            >
              <Text style={{ color: m3.onSurfaceVariant, fontSize: 13, fontWeight: '700' }}>✕</Text>
            </M3Pressable>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  filledBtn: {
    height: 48,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  tonalBtn: {
    height: 48,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  outlinedBtn: {
    height: 48,
    borderRadius: m3Shape.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorBtn: {
    height: 48,
    borderRadius: m3Shape.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: m3Shape.full,
    padding: 3,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 48 : (StatusBar.currentHeight ?? 24) + 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  backButton: {
    minWidth: 70,
  },
  actionWrap: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContent: {
    borderTopLeftRadius: m3Shape.extraLargeIncreased,
    borderTopRightRadius: m3Shape.extraLargeIncreased,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});



