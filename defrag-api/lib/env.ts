export function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const ENV = {
  SUPABASE_URL: mustGetEnv("NEXT_PUBLIC_SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: mustGetEnv("SUPABASE_SERVICE_ROLE_KEY"),

  STRIPE_SECRET_KEY: mustGetEnv("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: mustGetEnv("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_BLUEPRINT: mustGetEnv("STRIPE_PRICE_BLUEPRINT"),
  STRIPE_PRICE_OS: mustGetEnv("STRIPE_PRICE_OS"),

  APP_URL: mustGetEnv("APP_URL"),

  AI_GATEWAY_URL: mustGetEnv("AI_GATEWAY_URL"),
  OPENAI_API_KEY: mustGetEnv("OPENAI_API_KEY"),

  DEFRAG_ADMIN_KEY: mustGetEnv("DEFRAG_ADMIN_KEY"),

  // Phase 3
  R2_ENDPOINT: mustGetEnv("R2_ENDPOINT"),
  R2_ACCESS_KEY_ID: mustGetEnv("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: mustGetEnv("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET: mustGetEnv("R2_BUCKET"),
  R2_PUBLIC_BASE_URL: mustGetEnv("R2_PUBLIC_BASE_URL"),
};

// Alias for compatibility with new code
export const env = ENV;
