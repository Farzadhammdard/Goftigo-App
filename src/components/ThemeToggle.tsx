import React, {useRef} from 'react';
import {Animated, Pressable, StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {useTheme} from '../shell/providers/ThemeProvider';

export function ThemeToggle({size = 28, color}: {size?: number; color?: string}) {
  const {isDark, toggleTheme} = useTheme();
  const rotate = useRef(new Animated.Value(isDark ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    const nextDark = !isDark;

    Animated.parallel([
      Animated.timing(rotate, {
        toValue: nextDark ? 1 : 0,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scale, {toValue: 0.6, duration: 150, useNativeDriver: true}),
        Animated.spring(scale, {toValue: 1, friction: 5, useNativeDriver: true}),
      ]),
    ]).start();

    toggleTheme();
  };

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Pressable onPress={handleToggle} style={styles.button}>
      <Animated.View style={{transform: [{rotate: rotation}, {scale}]}}>
        <Ionicons
          name={isDark ? 'sunny' : 'moon'}
          size={size}
          color={color || (isDark ? '#FFD93D' : '#6366F1')}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
