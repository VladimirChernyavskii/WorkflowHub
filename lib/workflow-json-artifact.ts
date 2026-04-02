import { createHash } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { parseComfyWorkflowNodeTypesFromString } from "@/lib/comfy/parse-workflow-node-types";
import { replaceDerivedWorkflowNodesInTransaction } from "@/lib/comfy/replace-derived-workflow-nodes";
import { parseEnv } from "@/lib/env-parse";
import { prisma } from "@/lib/prisma";
import {
  assertS3Configured,
  createS3ClientFromEnv,
  getS3BucketName,
} from "@/lib/s3-factory";

/** Max workflow JSON artifact size (bytes). Tunable constant; not in env in v1. */
export const WORKFLOW_JSON_MAX_BYTES = 32 * 1024 * 1024;

export function workflowArtifactStorageKey(workflowId: string): string {
  return `workflows/${workflowId}/current.json`;
}

export class WorkflowJsonUploadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "WorkflowJsonUploadError";
  }
}

/**
 * Reads raw workflow JSON bytes from multipart (`file` field) or non-multipart body (UTF-8).
 */
export async function readWorkflowJsonBytes(request: Request): Promise<Buffer> {
  const ct = request.headers.get("content-type") ?? "";
  let buf: Buffer;

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      throw new WorkflowJsonUploadError(
        'Expected multipart field "file" containing the workflow JSON',
        400
      );
    }
    buf = Buffer.from(await file.arrayBuffer());
  } else {
    buf = Buffer.from(await request.arrayBuffer());
  }

  if (buf.length === 0) {
    throw new WorkflowJsonUploadError("Empty body", 400);
  }
  if (buf.length > WORKFLOW_JSON_MAX_BYTES) {
    throw new WorkflowJsonUploadError(
      `Workflow JSON exceeds max size (${WORKFLOW_JSON_MAX_BYTES} bytes)`,
      413
    );
  }

  return buf;
}

/**
 * Validates ComfyUI JSON, writes to object storage, upserts WorkflowFile, replaces derived nodes (PRD §5.2).
 * On DB failure after PutObject, best-effort DeleteObject on the same key.
 */
export async function commitWorkflowJsonUpload(
  workflowId: string,
  bytes: Buffer
): Promise<void> {
  const text = bytes.toString("utf8");
  const nodeTypes = parseComfyWorkflowNodeTypesFromString(text);

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = workflowArtifactStorageKey(workflowId);

  const env = parseEnv();
  assertS3Configured(env);
  const client = createS3ClientFromEnv(env);
  const bucket = getS3BucketName(env);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: "application/json",
    })
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workflowFile.upsert({
        where: { workflowId },
        create: {
          workflowId,
          storageKey,
          contentType: "application/json",
          byteSize: bytes.length,
          sha256,
        },
        update: {
          storageKey,
          contentType: "application/json",
          byteSize: bytes.length,
          sha256,
          uploadedAt: new Date(),
        },
      });
      await replaceDerivedWorkflowNodesInTransaction(tx, workflowId, nodeTypes);
    });
  } catch (dbErr) {
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })
      );
    } catch {
      /* best-effort cleanup */
    }
    throw dbErr;
  }
}
