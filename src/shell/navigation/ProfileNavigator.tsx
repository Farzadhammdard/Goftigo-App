import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileScreen} from '../../features/main/MainScreens';
import {NotificationsScreen} from '../../features/notifications/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{animation: 'slide_from_right'}} />
    </Stack.Navigator>
  );
}
