import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {AuthStackParamList} from './types';
import {LoginScreen} from '../../features/auth/screens/LoginScreen';
import {RegisterScreen} from '../../features/auth/screens/RegisterScreen';
import {PhoneInputScreen} from '../../features/auth/screens/PhoneInputScreen';
import {OtpVerificationScreen} from '../../features/auth/screens/OtpVerificationScreen';
import {ProfileSetupScreen} from '../../features/auth/screens/ProfileSetupScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="OtpVerification" component={OtpVerificationScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}
