import "server-only";
import { parseEnv } from "@/lib/env-parse";

export const env = parseEnv();

if (process.env.NODE_ENV === "development") {
  console.info(
    `[workflowhub] env loaded — MEDIA_IMAGE_MAX_MB=${env.MEDIA_IMAGE_MAX_MB} (override via env; see PRD §8)`
  );
}
