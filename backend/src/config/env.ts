import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// 1. Determine active environment file (.env.test, .env.production, or .env.development)
const nodeEnv = process.env.NODE_ENV || 'development';
const envFileName =
  nodeEnv === 'test'
    ? '.env.test'
    : nodeEnv === 'production'
    ? '.env.production'
    : '.env.development';

// Look in backend/ then workspace root
dotenv.config({ path: path.resolve(process.cwd(), envFileName) });
dotenv.config({ path: path.resolve(process.cwd(), '..', envFileName) });
dotenv.config(); // fallback default .env

const fallbackJwtSecret = crypto.randomBytes(32).toString('hex');

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: nodeEnv,
  JWT_SECRET: process.env.JWT_SECRET || fallbackJwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Supabase
  SUPABASE_URL: (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, ''),
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // Google Maps Services (Server-Side Privileged Keys)
  GOOGLE_ROUTES_API_KEY: process.env.GOOGLE_ROUTES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  // Expo Push
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',

  /**
   * Validates production configuration.
   * Warns in production if any third-party integration is missing, while allowing resilient startup.
   */
  validate(): void {
    if (this.NODE_ENV === 'production') {
      const missing: string[] = [];

      const isInvalid = (val: string | undefined, sampleSubstrings: string[]) => {
        if (!val) return true;
        return sampleSubstrings.some((sub) => val.toLowerCase().includes(sub.toLowerCase()));
      };

      if (isInvalid(this.SUPABASE_URL, ['your-project', 'placeholder'])) {
        missing.push('SUPABASE_URL');
      }
      if (
        (!this.SUPABASE_SERVICE_ROLE_KEY && !this.SUPABASE_ANON_KEY) ||
        isInvalid(this.SUPABASE_SERVICE_ROLE_KEY || this.SUPABASE_ANON_KEY, ['your-supabase', 'placeholder'])
      ) {
        missing.push('SUPABASE_SERVICE_ROLE_KEY/ANON_KEY');
      }
      if (isInvalid(this.GOOGLE_ROUTES_API_KEY, ['your-server', 'your-client', 'placeholder'])) {
        missing.push('GOOGLE_ROUTES_API_KEY');
      }
      if (isInvalid(this.GOOGLE_PLACES_API_KEY, ['your-server', 'your-client', 'placeholder'])) {
        missing.push('GOOGLE_PLACES_API_KEY');
      }
      if (
        !process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32 ||
        isInvalid(process.env.JWT_SECRET, ['development', 'change-in-prod', 'change-before-deploy', 'placeholder', 'default'])
      ) {
        missing.push('JWT_SECRET (using auto-generated ephemeral key until configured)');
      }

      if (missing.length > 0) {
        console.warn(
          `[Budigo Production Notice] Non-configured services: ${missing.join(', ')}. ` +
            `Running with resilient fallback mode until keys are provided in environment.`
        );
      } else {
        console.log('[Budigo Production Notice] All production services and keys validated.');
      }
    }
  },
};

// Run validation in production
if (ENV.NODE_ENV === 'production') {
  ENV.validate();
}

