import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {ChatStackParamList} from './types';
import {ChatsScreen} from '../../features/main/MainScreens';
import {ChatScreen} from '../../features/chat/screens/ChatScreen';
import {SearchScreen} from '../../features/search/screens/SearchScreen';
import {UserProfileScreen} from '../../features/profile/screens/UserProfileScreen';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ConversationsList" component={ChatsScreen} />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="GlobalSearch"
        component={SearchScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={{animation: 'slide_from_right'}}
      />
    </Stack.Navigator>
  );
}
