import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SettingsScreen} from './screens/SettingsScreen';
import {SettingsDetailScreen} from './screens/SettingsDetailScreen';

const Stack = createNativeStackNavigator();

export function SettingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="SettingsDetail" component={SettingsDetailScreen} options={{animation: 'slide_from_right'}} />
    </Stack.Navigator>
  );
}
