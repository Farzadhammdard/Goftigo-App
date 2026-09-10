import React, {useRef, useEffect} from 'react';
import {View, StyleSheet, Platform, Animated} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Ionicons} from '@expo/vector-icons';
import {Colors, Spacing, BorderRadius, Shadows} from '../../core/theme';
import {ChatNavigator} from './ChatNavigator';
import {ProfileNavigator} from './ProfileNavigator';
import {
  NearbyScreen,
  SocialScreen,
  QuickAddScreen,
} from '../../features/main/MainScreens';
import {useTheme} from '../providers/ThemeProvider';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<
  string,
  {
    focused: keyof typeof Ionicons.glyphMap;
    unfocused: keyof typeof Ionicons.glyphMap;
  }
> = {
  ChatsTab: {
    focused: 'chatbubble-ellipses',
    unfocused: 'chatbubble-ellipses-outline',
  },
  NearbyTab: {focused: 'locate', unfocused: 'location-outline'},
  SocialTab: {focused: 'newspaper', unfocused: 'newspaper-outline'},
  FriendsTab: {focused: 'people', unfocused: 'people-outline'},
  QuickAddTab: {focused: 'add-circle', unfocused: 'add-circle-outline'},
  ProfileTab: {focused: 'person', unfocused: 'person-outline'},
};

function TabIcon({
  routeName,
  focused,
  color,
}: {
  routeName: string;
  focused: boolean;
  color: string;
}) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 15,
      stiffness: 200,
    }).start();
  }, [focused]);

  const icons = TAB_ICONS[routeName];
  if (!icons) return null;

  return (
    <Animated.View
      style={[
        styles.tabIconContainer,
        {
          transform: [
            {
              scale: scale.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1.08],
              }),
            },
          ],
        },
      ]}>
      <Ionicons
        name={focused ? icons.focused : icons.unfocused}
        size={24}
        color={color}
      />
      {focused && (
        <View style={[styles.activeIndicator, {backgroundColor: color}]} />
      )}
    </Animated.View>
  );
}

export function MainTabNavigator() {
  const {colors, isDark} = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color}) => (
          <TabIcon routeName={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          ...Shadows.lg,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          color: colors.text,
        },
      })}>
      <Tab.Screen
        name="ChatsTab"
        component={ChatNavigator}
        options={{tabBarLabel: 'Chats'}}
      />
      <Tab.Screen
        name="NearbyTab"
        component={NearbyScreen}
        options={{tabBarLabel: 'Nearby'}}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialScreen}
        options={{tabBarLabel: 'Social'}}
      />
      <Tab.Screen
        name="FriendsTab"
        component={NearbyScreen}
        options={{tabBarLabel: 'Friends'}}
      />
      <Tab.Screen
        name="QuickAddTab"
        component={QuickAddScreen}
        options={{tabBarLabel: 'Add'}}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{tabBarLabel: 'Profile'}}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
