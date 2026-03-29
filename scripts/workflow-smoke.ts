import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] workflow smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const slug = `workflowhub_wf_smoke_${suffix}`;

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

    await prisma.workflowFile.create({
      data: {
        workflowId: wf.id,
        storageKey: `workflows/${wf.id}/current.json`,
        contentType: "application/json",
        byteSize: 12,
      },
    });

    let dupWorkflowFileRejected = false;
    try {
      await prisma.workflowFile.create({
        data: {
          workflowId: wf.id,
          storageKey: "other",
          contentType: "application/json",
          byteSize: 1,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        dupWorkflowFileRejected = true;
      } else {
        throw e;
      }
    }

    if (!dupWorkflowFileRejected) {
      console.error(
        "[workflowhub] Expected P2002 for second WorkflowFile same workflow_id"
      );
      process.exit(1);
    }

    let dupSlugRejected = false;
    try {
      await prisma.workflow.create({
        data: {
          slug,
          title: "smoke2",
          description: "smoke2",
          status: "draft",
          baseModel: "SDXL",
          comfyVersion: "1.0",
          authorDisplayName: "smoke",
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        dupSlugRejected = true;
      } else {
        throw e;
      }
    }

    if (!dupSlugRejected) {
      console.error("[workflowhub] Expected P2002 for duplicate slug");
      process.exit(1);
    }

    console.info(
      "[workflowhub] workflow smoke OK — Workflow + WorkflowFile, unique workflow_id and slug enforced"
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
  console.error("[workflowhub] workflow smoke failed:", err);
  process.exit(1);
});
