import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] media asset smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const slug = `workflowhub_media_smoke_${suffix}`;

  let workflowId: string | undefined;

  try {
    const wf = await prisma.workflow.create({
      data: {
        slug,
        title: "smoke",
        description: "smoke",
        status: "draft",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
      },
    });
    workflowId = wf.id;

    await prisma.mediaAsset.create({
      data: {
        workflowId: wf.id,
        kind: "image",
        role: "input_example",
        storageKey: `workflows/${wf.id}/examples/in.png`,
        byteSize: 1024,
        mimeType: "image/png",
        sortOrder: 0,
      },
    });

    const beforeDelete = await prisma.mediaAsset.count({
      where: { workflowId: wf.id },
    });
    if (beforeDelete !== 1) {
      console.error(
        `[workflowhub] Expected 1 MediaAsset before delete, got ${beforeDelete}`
      );
      process.exit(1);
    }

    await prisma.workflow.delete({ where: { id: wf.id } });
    workflowId = undefined;

    const afterDelete = await prisma.mediaAsset.count({
      where: { workflowId: wf.id },
    });
    if (afterDelete !== 0) {
      console.error(
        `[workflowhub] Expected CASCADE: 0 MediaAsset after workflow delete, got ${afterDelete}`
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] media asset smoke OK — insert MediaAsset, ON DELETE CASCADE from workflow"
    );
  } finally {
    if (workflowId) {
      try {
        await prisma.workflow.delete({ where: { id: workflowId } });
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] media asset smoke failed:", err);
  process.exit(1);
});
