import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
  const { parseEnv } = await import("../lib/env-parse");
  const {
    assertS3Configured,
    createS3ClientFromEnv,
    getS3BucketName,
  } = await import("../lib/s3-factory");

  const env = parseEnv();
  assertS3Configured(env);
  const client = createS3ClientFromEnv(env);
  const Bucket = getS3BucketName(env);
  await client.send(new HeadBucketCommand({ Bucket }));
  console.info(
    `[workflowhub] S3 smoke OK — HeadBucket succeeded for "${Bucket}"`
  );
}

main().catch((err: unknown) => {
  console.error("[workflowhub] S3 smoke failed:", err);
  process.exit(1);
});
