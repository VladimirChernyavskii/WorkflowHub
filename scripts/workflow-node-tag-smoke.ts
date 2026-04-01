import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] node/tag smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const wfSlug = `workflowhub_node_smoke_wf_${suffix}`;
  const tagSlug = `workflowhub_node_smoke_tag_${suffix}`;

  let workflowId: string | undefined;
  let tagId: string | undefined;

  try {
    const wf = await prisma.workflow.create({
      data: {
        slug: wfSlug,
        title: "smoke",
        description: "smoke",
        status: "draft",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
      },
    });
    workflowId = wf.id;

    const tag = await prisma.tag.create({
      data: { slug: tagSlug, name: "Smoke tag" },
    });
    tagId = tag.id;

    await prisma.workflowTag.create({
      data: { workflowId: wf.id, tagId: tag.id },
    });

    let dupLinkRejected = false;
    try {
      await prisma.workflowTag.create({
        data: { workflowId: wf.id, tagId: tag.id },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        dupLinkRejected = true;
      } else {
        throw e;
      }
    }
    if (!dupLinkRejected) {
      console.error(
        "[workflowhub] Expected P2002 for duplicate (workflow_id, tag_id)"
      );
      process.exit(1);
    }

    await prisma.workflowNode.createMany({
      data: [
        {
          workflowId: wf.id,
          nodeType: "third",
          sortOrder: 30,
          source: "derived",
        },
        {
          workflowId: wf.id,
          nodeType: "first",
          sortOrder: 10,
          source: "admin",
        },
        {
          workflowId: wf.id,
          nodeType: "second",
          sortOrder: 20,
          source: "derived",
        },
      ],
    });

    const ordered = await prisma.workflowNode.findMany({
      where: { workflowId: wf.id },
      orderBy: { sortOrder: "asc" },
      select: { nodeType: true, sortOrder: true },
    });

    const types = ordered.map((n) => n.nodeType);
    if (types.join(",") !== "first,second,third") {
      console.error(
        "[workflowhub] ORDER BY sort_order mismatch:",
        types.join(",")
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] WorkflowNode + Tag + WorkflowTag smoke OK — unique pair and sort order verified"
    );
  } finally {
    if (workflowId) {
      try {
        await prisma.workflow.delete({ where: { id: workflowId } });
      } catch {
        /* ignore */
      }
    }
    if (tagId) {
      try {
        await prisma.tag.delete({ where: { id: tagId } });
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] node/tag smoke failed:", err);
  process.exit(1);
});
