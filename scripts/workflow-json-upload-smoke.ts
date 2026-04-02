import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import {
  commitWorkflowJsonUpload,
  workflowArtifactStorageKey,
} from "../lib/workflow-json-artifact";
import { ComfyWorkflowJsonSyntaxError } from "../lib/comfy/parse-workflow-node-types";
import { parseEnv } from "../lib/env-parse";
import {
  assertS3Configured,
  createS3ClientFromEnv,
  getS3BucketName,
} from "../lib/s3-factory";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] workflow-json-upload-smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const env = parseEnv();
  assertS3Configured(env);

  const prisma = new PrismaClient();
  const s3 = createS3ClientFromEnv(env);
  const bucket = getS3BucketName(env);
  const suffix = `${Date.now()}`;
  const slug = `wf_json_upload_smoke_${suffix}`;

  const wf = await prisma.workflow.create({
    data: {
      slug,
      title: "upload smoke",
      description: "upload smoke",
      status: "draft",
      baseModel: "SDXL",
      comfyVersion: "1.0",
      authorDisplayName: "smoke",
    },
  });

  try {
    const apiPath = resolve(
      process.cwd(),
      "fixtures/comfy-workflow-api-sample.json"
    );
    const bytes = await readFile(apiPath);

    await commitWorkflowJsonUpload(wf.id, bytes);

    const file = await prisma.workflowFile.findUnique({
      where: { workflowId: wf.id },
    });
    if (!file) {
      console.error("[workflowhub] Expected WorkflowFile row after upload");
      process.exit(1);
    }

    const expectedKey = workflowArtifactStorageKey(wf.id);
    if (file.storageKey !== expectedKey) {
      console.error(
        `[workflowhub] storage_key mismatch: got ${file.storageKey}, want ${expectedKey}`
      );
      process.exit(1);
    }

    await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: expectedKey })
    );

    const nodes = await prisma.workflowNode.findMany({
      where: { workflowId: wf.id },
      orderBy: { sortOrder: "asc" },
    });
    if (nodes.length === 0) {
      console.error("[workflowhub] Expected derived WorkflowNode rows");
      process.exit(1);
    }
    if (!nodes.every((n) => n.source === "derived")) {
      console.error("[workflowhub] All nodes after upload must be derived");
      process.exit(1);
    }

    let syntaxRejected = false;
    try {
      await commitWorkflowJsonUpload(wf.id, Buffer.from("{ not json"));
    } catch (e) {
      if (e instanceof ComfyWorkflowJsonSyntaxError) syntaxRejected = true;
    }
    if (!syntaxRejected) {
      console.error(
        "[workflowhub] Expected ComfyWorkflowJsonSyntaxError for garbage JSON"
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] workflow-json-upload-smoke OK — S3 HeadObject, WorkflowFile, derived nodes, garbage rejected"
    );
  } finally {
    await prisma.workflow.delete({ where: { id: wf.id } }).catch(() => {
      /* cascade cleanup */
    });
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] workflow-json-upload-smoke failed:", err);
  process.exit(1);
});
