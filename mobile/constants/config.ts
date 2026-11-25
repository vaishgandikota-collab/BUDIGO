import { Platform } from 'react-native';

// In Android emulator localhost is 10.0.2.2; on physical devices or iOS simulator use host IP or env
const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

export const Config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || defaultHost,
  SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL || defaultHost,
  SUPABASE_URL: (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
};

