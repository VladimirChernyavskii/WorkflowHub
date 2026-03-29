import { S3Client } from "@aws-sdk/client-s3";
import type { WorkflowHubEnv } from "@/lib/env-parse";

export function assertS3Configured(env: WorkflowHubEnv): void {
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "S3 is not configured: set S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY (optional S3_ENDPOINT, S3_FORCE_PATH_STYLE for MinIO/R2)"
    );
  }
}

export function createS3ClientFromEnv(env: WorkflowHubEnv): S3Client {
  assertS3Configured(env);
  return new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  });
}

export function getS3BucketName(env: WorkflowHubEnv): string {
  if (!env.S3_BUCKET) {
    throw new Error(
      "S3_BUCKET is not set; object storage is disabled until configured"
    );
  }
  return env.S3_BUCKET;
}
