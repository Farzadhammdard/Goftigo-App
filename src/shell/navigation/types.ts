import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {CompositeNavigationProp, NavigatorScreenParams} from '@react-navigation/native';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  PhoneInput: undefined;
  OtpVerification: {phoneNumber: string; sessionId: string};
  ProfileSetup: undefined;
};

export type ChatStackParamList = {
  ConversationsList: undefined;
  Chat: {
    conversationId: string;
    participantName: string;
    participantAvatar?: string;
  };
  GlobalSearch: undefined;
  UserProfile: {userId: string};
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PostsGrid: {userId: string; userName: string};
  FollowersList: {userId: string; userName: string};
  FollowingList: {userId: string; userName: string};
  FriendsList: {userId: string; userName: string};
  Notifications: undefined;
};

export type MainTabParamList = {
  ChatsTab: NavigatorScreenParams<ChatStackParamList>;
  NearbyTab: undefined;
  SocialTab: undefined;
  FriendsTab: undefined;
  QuickAddTab: undefined;
  ProfileTab: undefined;
};

export type NearbyStackParamList = {
  NearbyMain: undefined;
  NearbyChat: {
    deviceId: string;
    userId: string;
    displayName: string;
  };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Diagnostics: undefined;
  Settings: undefined;
};

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type MainTabNavigationProp = BottomTabNavigationProp<MainTabParamList>;
export type ChatNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ChatStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;
