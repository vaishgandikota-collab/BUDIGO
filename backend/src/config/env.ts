import dotenv from 'dotenv';
import path from 'path';

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

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: nodeEnv,
  JWT_SECRET: process.env.JWT_SECRET || 'budigo-default-development-secret-key-32chars',
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
   * Throws an explicit error in production if any mandatory integration or secret is missing.
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
        !this.JWT_SECRET ||
        this.JWT_SECRET.length < 32 ||
        isInvalid(this.JWT_SECRET, ['development', 'change-in-prod', 'change-before-deploy', 'placeholder', 'default'])
      ) {
        missing.push('JWT_SECRET (must be >= 32 chars non-placeholder/production secret)');
      }

      if (missing.length > 0) {
        throw new Error(
          `[Budigo Production Startup Error] Missing or placeholder required production configurations: ${missing.join(', ')}. ` +
            `Production cannot silently fabricate mock services.`
        );
      }
    }
  },
};

// Run validation in production
if (ENV.NODE_ENV === 'production') {
  ENV.validate();
}
