import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const isRemoteWeb =
  isWeb &&
  typeof window !== 'undefined' &&
  window.location &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1';

// In Android emulator localhost is 10.0.2.2; on remote web use production Render backend; on local use localhost:5000
const defaultHost = isRemoteWeb
  ? 'https://budigo-backend.onrender.com'
  : Platform.OS === 'android'
  ? 'http://10.0.2.2:5000'
  : 'http://localhost:5000';

export const Config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || defaultHost,
  SOCKET_URL: process.env.EXPO_PUBLIC_SOCKET_URL || defaultHost,
  SUPABASE_URL: (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  isRemoteWeb,
};


