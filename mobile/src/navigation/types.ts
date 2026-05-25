import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Verify: { email: string };
  ForgotPassword: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Chat: {
    roomId: number;
    roomName: string;
    isGroup: boolean;
    type: 'room' | 'channel' | 'private_channel';
    otherUserId?: number;
  };
  NewChat: undefined;
};

export type MainTabParamList = {
  Rooms: undefined;
  Contacts: undefined;
  Profile: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export type VerifyScreenProps = NativeStackScreenProps<AuthStackParamList, 'Verify'>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, 'Chat'>;
export type NewChatScreenProps = NativeStackScreenProps<RootStackParamList, 'NewChat'>;
export type RoomsScreenProps = BottomTabScreenProps<MainTabParamList, 'Rooms'>;
export type ContactsScreenProps = BottomTabScreenProps<MainTabParamList, 'Contacts'>;
export type ProfileScreenProps = BottomTabScreenProps<MainTabParamList, 'Profile'>;
