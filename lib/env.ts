import "server-only";
import { z } from "zod";

/**
 * Positive integer from `process.env`, with PRD §8 default when unset or empty.
 * Invalid values (non-integer, below 1) fail validation at startup.
 */
function envPositiveInt(key: string, defaultValue: number) {
  return z.preprocess((raw: unknown) => {
    if (raw === undefined || raw === "") return defaultValue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(
        `${key} must be a positive integer (PRD §8 default: ${defaultValue})`
      );
    }
    return n;
  }, z.number().int().positive());
}

const envSchema = z.object({
  DATABASE_URL: z
    .union([z.string(), z.undefined()])
    .refine(
      (val): val is string =>
        typeof val === "string" && val.trim().length > 0,
      {
        message:
          "DATABASE_URL is required for Prisma and must not be empty (set in .env or the environment)",
      }
    ),

  MEDIA_IMAGE_MAX_MB: envPositiveInt("MEDIA_IMAGE_MAX_MB", 3),
  MEDIA_VIDEO_MAX_MB: envPositiveInt("MEDIA_VIDEO_MAX_MB", 12),
  ANON_COOKIE_TTL_DAYS: envPositiveInt("ANON_COOKIE_TTL_DAYS", 365),
  ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR: envPositiveInt(
    "ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR",
    10
  ),
  DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN: envPositiveInt(
    "DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN",
    30
  ),
  REVIEW_BODY_MAX_CHARS: envPositiveInt("REVIEW_BODY_MAX_CHARS", 2000),
});

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => `  - ${e.path.length ? e.path.join(".") : "env"}: ${e.message}`)
    .join("\n");
}

function readProcessEnv() {
  return {
    DATABASE_URL: process.env.DATABASE_URL,
    MEDIA_IMAGE_MAX_MB: process.env.MEDIA_IMAGE_MAX_MB,
    MEDIA_VIDEO_MAX_MB: process.env.MEDIA_VIDEO_MAX_MB,
    ANON_COOKIE_TTL_DAYS: process.env.ANON_COOKIE_TTL_DAYS,
    ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR:
      process.env.ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR,
    DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN:
      process.env.DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN,
    REVIEW_BODY_MAX_CHARS: process.env.REVIEW_BODY_MAX_CHARS,
  };
}

function loadEnv() {
  try {
    const result = envSchema.safeParse(readProcessEnv());
    if (!result.success) {
      throw new Error(
        `Environment validation failed:\n${formatZodError(result.error)}`
      );
    }
    return result.data;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Environment validation failed:")) {
      throw e;
    }
    if (e instanceof z.ZodError) {
      throw new Error(
        `Environment validation failed:\n${formatZodError(e)}`
      );
    }
    if (e instanceof Error) {
      throw new Error(`Environment validation failed:\n  - ${e.message}`);
    }
    throw e;
  }
}

export const env = loadEnv();

if (process.env.NODE_ENV === "development") {
  console.info(
    `[workflowhub] env loaded — MEDIA_IMAGE_MAX_MB=${env.MEDIA_IMAGE_MAX_MB} (override via env; see PRD §8)`
  );
}
