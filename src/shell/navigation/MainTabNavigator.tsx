import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Text, View, StyleSheet} from 'react-native';
import type {MainTabParamList} from './types';
import {useTheme} from '../providers/ThemeProvider';
import {ChatNavigator} from './ChatNavigator';
import {ProfileNavigator} from './ProfileNavigator';
import {NearbyScreen, SocialScreen, CallsScreen} from '../../features/main/MainScreens';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({label, focused}: {label: string; focused: boolean; color: string}) {
  const icons: Record<string, string> = {
    ChatsTab: focused ? '💬' : '💭',
    NearbyTab: focused ? '📡' : '📻',
    SocialTab: focused ? '📰' : '📄',
    CallsTab: focused ? '📞' : '☎️',
    ProfileTab: focused ? '👤' : '👥',
  };

  return (
    <View style={styles.tabIcon}>
      <Text style={styles.tabEmoji}>{icons[label] || '•'}</Text>
    </View>
  );
}

export function MainTabNavigator() {
  const {colors} = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused}) => (
          <TabIcon label={route.name} focused={focused} color={colors.primary} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      })}>
      <Tab.Screen name="ChatsTab" component={ChatNavigator} options={{tabBarLabel: 'Chats'}} />
      <Tab.Screen name="NearbyTab" component={NearbyScreen} options={{tabBarLabel: 'Nearby'}} />
      <Tab.Screen name="SocialTab" component={SocialScreen} options={{tabBarLabel: 'Social'}} />
      <Tab.Screen name="CallsTab" component={CallsScreen} options={{tabBarLabel: 'Calls'}} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} options={{tabBarLabel: 'Profile'}} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
  },
  tabEmoji: {
    fontSize: 18,
  },
});
