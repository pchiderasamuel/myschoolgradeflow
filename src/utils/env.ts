/**
 * Environment variable validation utility
 * Validates and exports all environment variables with proper TypeScript types
 */

function validateEnvVar(name: string, value: string | undefined, fallbackValue?: string): string {
  const finalValue = value || fallbackValue;
  if (!finalValue || finalValue.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please ensure either ${name} or its fallback is defined in your .env file`
    );
  }
  return finalValue;
}

// Validate critical environment variables at startup
export const ENV = {
  VITE_SUPABASE_URL: validateEnvVar(
    "VITE_SUPABASE_URL",
    import.meta.env.VITE_SUPABASE_URL
  ),
  VITE_SUPABASE_ANON_KEY: validateEnvVar(
    "VITE_SUPABASE_ANON_KEY",
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ),
} as const;

// Type-safe access to environment variables
export function getEnvVar<K extends keyof typeof ENV>(key: K): string {
  return ENV[key];
}

export default ENV;
