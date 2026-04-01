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

/** Strip trailing slashes; empty → undefined. */
const optionalOriginUrl = z.preprocess((raw: unknown) => {
  if (raw === undefined || raw === "") return undefined;
  let s = String(raw).trim();
  if (s === "") return undefined;
  while (s.endsWith("/")) s = s.slice(0, -1);
  return s;
}, z.union([z.undefined(), z.string().url()]));

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

    /** HMAC key for signed session cookie (server-only). Min length reduces guessability. */
    SESSION_SECRET: z.preprocess((raw: unknown) => {
      if (raw === undefined || raw === "") return undefined;
      const s = String(raw).trim();
      return s === "" ? undefined : s;
    }, z.string().min(32, {
      message:
        "SESSION_SECRET is required and must be at least 32 characters (signing HTTP-only session cookies)",
    })),

    /** Session cookie lifetime; PRD §5.7 — session until expiry. */
    SESSION_MAX_AGE_DAYS: envPositiveInt("SESSION_MAX_AGE_DAYS", 30),

    S3_ENDPOINT: optionalTrimmed,
    S3_REGION: s3Region,
    S3_ACCESS_KEY_ID: optionalTrimmed,
    S3_SECRET_ACCESS_KEY: optionalTrimmed,
    S3_BUCKET: optionalTrimmed,
    S3_FORCE_PATH_STYLE: s3ForcePathStyle,

    /** Public app origin for OAuth redirect_uri (e.g. http://localhost:3000). Required when any OAuth provider is enabled. */
    AUTH_BASE_URL: optionalOriginUrl,

    GOOGLE_CLIENT_ID: optionalTrimmed,
    GOOGLE_CLIENT_SECRET: optionalTrimmed,

    GITHUB_CLIENT_ID: optionalTrimmed,
    GITHUB_CLIENT_SECRET: optionalTrimmed,

    /**
     * Comma- or newline-separated emails that grant admin access (TASK-015).
     * Case-insensitive; empty → only `User.role === admin` applies.
     */
    ADMIN_EMAIL_ALLOWLIST: z.preprocess((raw: unknown) => {
      if (raw === undefined || raw === "") return "";
      return String(raw).trim();
    }, z.string()),
  })
  .superRefine((data, ctx) => {
    const googlePartial =
      !!data.GOOGLE_CLIENT_ID !== !!data.GOOGLE_CLIENT_SECRET;
    if (googlePartial) {
      if (!data.GOOGLE_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "GOOGLE_CLIENT_ID is required when GOOGLE_CLIENT_SECRET is set (Google OAuth)",
          path: ["GOOGLE_CLIENT_ID"],
        });
      }
      if (!data.GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set (Google OAuth)",
          path: ["GOOGLE_CLIENT_SECRET"],
        });
      }
    }
    const githubPartial =
      !!data.GITHUB_CLIENT_ID !== !!data.GITHUB_CLIENT_SECRET;
    if (githubPartial) {
      if (!data.GITHUB_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "GITHUB_CLIENT_ID is required when GITHUB_CLIENT_SECRET is set (GitHub OAuth)",
          path: ["GITHUB_CLIENT_ID"],
        });
      }
      if (!data.GITHUB_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "GITHUB_CLIENT_SECRET is required when GITHUB_CLIENT_ID is set (GitHub OAuth)",
          path: ["GITHUB_CLIENT_SECRET"],
        });
      }
    }
    const googleOn = !!(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET);
    const githubOn = !!(data.GITHUB_CLIENT_ID && data.GITHUB_CLIENT_SECRET);
    if ((googleOn || githubOn) && !data.AUTH_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AUTH_BASE_URL is required when OAuth credentials are set (public origin, no trailing slash)",
        path: ["AUTH_BASE_URL"],
      });
    }
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
    SESSION_SECRET: process.env.SESSION_SECRET,
    SESSION_MAX_AGE_DAYS: process.env.SESSION_MAX_AGE_DAYS,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
    AUTH_BASE_URL: process.env.AUTH_BASE_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    ADMIN_EMAIL_ALLOWLIST: process.env.ADMIN_EMAIL_ALLOWLIST,
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
