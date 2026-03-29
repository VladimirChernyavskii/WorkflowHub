import "server-only";
import { env } from "@/lib/env";
import {
  assertS3Configured,
  createS3ClientFromEnv,
  getS3BucketName,
} from "@/lib/s3-factory";
import type { S3Client } from "@aws-sdk/client-s3";

let cached: S3Client | null = null;

/**
 * Returns a shared S3-compatible client (AWS S3, R2, MinIO, etc.).
 * Requires S3_BUCKET and credentials; see .env.example.
 */
export function getS3Client(): S3Client {
  assertS3Configured(env);
  if (cached) return cached;
  cached = createS3ClientFromEnv(env);
  return cached;
}

export function getS3Bucket(): string {
  return getS3BucketName(env);
}
