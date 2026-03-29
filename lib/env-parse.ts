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

/** Empty or missing → undefined; used for optional S3 strings. */
const optionalTrimmed = z.preprocess((raw: unknown) => {
  if (raw === undefined || raw === "") return undefined;
  const s = String(raw).trim();
  return s === "" ? undefined : s;
}, z.string().optional());

const s3ForcePathStyle = z.preprocess((raw: unknown) => {
  if (raw === undefined || raw === "") return false;
  if (typeof raw === "string") {
    const v = raw.toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  }
  return false;
}, z.boolean());

const s3Region = z.preprocess((raw: unknown) => {
  if (raw === undefined || raw === "") return "us-east-1";
  const s = String(raw).trim();
  return s === "" ? "us-east-1" : s;
}, z.string().min(1));

export const envSchema = z
  .object({
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

    S3_ENDPOINT: optionalTrimmed,
    S3_REGION: s3Region,
    S3_ACCESS_KEY_ID: optionalTrimmed,
    S3_SECRET_ACCESS_KEY: optionalTrimmed,
    S3_BUCKET: optionalTrimmed,
    S3_FORCE_PATH_STYLE: s3ForcePathStyle,
  })
  .superRefine((data, ctx) => {
    if (!data.S3_BUCKET) return;
    if (!data.S3_ACCESS_KEY_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "S3_ACCESS_KEY_ID is required when S3_BUCKET is set (S3-compatible storage)",
        path: ["S3_ACCESS_KEY_ID"],
      });
    }
    if (!data.S3_SECRET_ACCESS_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "S3_SECRET_ACCESS_KEY is required when S3_BUCKET is set (S3-compatible storage)",
        path: ["S3_SECRET_ACCESS_KEY"],
      });
    }
  });

export type WorkflowHubEnv = z.infer<typeof envSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((e) => `  - ${e.path.length ? e.path.join(".") : "env"}: ${e.message}`)
    .join("\n");
}

export function readProcessEnv() {
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
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
  };
}

/** Validates `process.env` (used by the Next app and CLI scripts such as `storage:smoke`). */
export function parseEnv(): WorkflowHubEnv {
  try {
    const result = envSchema.safeParse(readProcessEnv());
    if (!result.success) {
      throw new Error(
        `Environment validation failed:\n${formatZodError(result.error)}`
      );
    }
    return result.data;
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.startsWith("Environment validation failed:")
    ) {
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
