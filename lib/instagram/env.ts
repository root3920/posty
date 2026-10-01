import { z } from 'zod';

const instagramEnvSchema = z.object({
  INSTAGRAM_APP_ID: z.string().min(1, 'INSTAGRAM_APP_ID no está configurada'),
  INSTAGRAM_APP_SECRET: z.string().min(1, 'INSTAGRAM_APP_SECRET no está configurada'),
  INSTAGRAM_REDIRECT_URI: z.string().min(1, 'INSTAGRAM_REDIRECT_URI no está configurada'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32, 'TOKEN_ENCRYPTION_KEY debe tener al menos 32 caracteres'),
});

export type InstagramEnv = z.infer<typeof instagramEnvSchema>;

/**
 * Validates and returns the Instagram environment variables.
 * NO module-level cache — always re-reads process.env.
 * Serverless functions can have stale module state after env var changes.
 */
export function getInstagramEnv(): { env: InstagramEnv | null; error: string | null } {
  const result = instagramEnvSchema.safeParse({
    INSTAGRAM_APP_ID: process.env.INSTAGRAM_APP_ID?.trim(),
    INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET?.trim(),
    INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI?.trim(),
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY?.trim(),
  });

  if (!result.success) {
    const error = result.error.issues.map((i) => `${i.path}: ${i.message}`).join('. ');
    return { env: null, error };
  }

  return { env: result.data, error: null };
}
