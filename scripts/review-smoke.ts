import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] review smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const slug = `workflowhub_review_smoke_${suffix}`;
  const subject = `workflowhub_review_user_${suffix}`;

  let userId: string | undefined;
  let workflowId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        provider: "google",
        providerSubject: subject,
        displayName: "smoke",
        role: "user",
      },
    });
    userId = user.id;

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

    await prisma.review.create({
      data: {
        workflowId: wf.id,
        userId: user.id,
        rating: 3,
        body: "ok",
      },
    });

    let dupActiveRejected = false;
    try {
      await prisma.review.create({
        data: {
          workflowId: wf.id,
          userId: user.id,
          rating: 4,
          body: null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) dupActiveRejected = true;
      else throw e;
    }

    if (!dupActiveRejected) {
      console.error(
        "[workflowhub] Expected P2002 for second active review (same workflow + user)"
      );
      process.exit(1);
    }

    await prisma.review.updateMany({
      where: { workflowId: wf.id, userId: user.id },
      data: { deletedAt: new Date() },
    });

    await prisma.review.create({
      data: {
        workflowId: wf.id,
        userId: user.id,
        rating: 5,
        body: null,
      },
    });

    console.info(
      "[workflowhub] review smoke OK — rating 3, duplicate active rejected (P2002), new review after soft delete"
    );
  } finally {
    try {
      if (workflowId) {
        await prisma.review.deleteMany({ where: { workflowId } });
        await prisma.workflow.delete({ where: { id: workflowId } });
      }
      if (userId) {
        await prisma.user.delete({ where: { id: userId } });
      }
    } catch {
      /* ignore cleanup errors */
    }
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] review smoke failed:", err);
  process.exit(1);
});
