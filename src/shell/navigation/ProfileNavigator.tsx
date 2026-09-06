import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {ProfileScreen, PostsGridScreen, FollowersListScreen, FollowingListScreen, FriendsListScreen, QrCodeScreen} from '../../features/profile/screens/ProfileScreen';
import {NotificationsScreen} from '../../features/notifications/screens/NotificationsScreen';
import {SettingsNavigator} from '../../features/settings/SettingsNavigator';

const Stack = createNativeStackNavigator();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="PostsGrid" component={PostsGridScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="FollowersList" component={FollowersListScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="FollowingList" component={FollowingListScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="FriendsList" component={FriendsListScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="QrCode" component={QrCodeScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{animation: 'slide_from_right'}} />
      <Stack.Screen name="Settings" component={SettingsNavigator} options={{animation: 'slide_from_right'}} />
    </Stack.Navigator>
  );
}
