import { z } from 'zod';

const instagramEnvSchema = z.object({
  INSTAGRAM_APP_ID: z.string().min(1, 'INSTAGRAM_APP_ID no está configurada'),
  INSTAGRAM_APP_SECRET: z.string().min(1, 'INSTAGRAM_APP_SECRET no está configurada'),
  INSTAGRAM_REDIRECT_URI: z.string().url('INSTAGRAM_REDIRECT_URI debe ser una URL válida'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32, 'TOKEN_ENCRYPTION_KEY debe tener al menos 32 caracteres'),
});

export type InstagramEnv = z.infer<typeof instagramEnvSchema>;

let _cached: InstagramEnv | null = null;
let _error: string | null = null;

/**
 * Validates and returns the Instagram environment variables.
 * Returns { env, error } — if error is set, env is null.
 */
export function getInstagramEnv(): { env: InstagramEnv | null; error: string | null } {
  if (_cached) return { env: _cached, error: null };
  if (_error) return { env: null, error: _error };

  const result = instagramEnvSchema.safeParse({
    INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID,
    INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET,
    INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  });

  if (!result.success) {
    _error = result.error.issues.map((i) => i.message).join('. ');
    return { env: null, error: _error };
  }

  _cached = result.data;
  return { env: _cached, error: null };
}
