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

/** PostgreSQL check_violation (Prisma may surface as UnknownRequestError with code 23514 in message). */
function isCheckViolation(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("23514") ||
    msg.includes("check constraint") ||
    msg.includes("unique_downloads_user_xor_anon")
  );
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] unique download smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const slug = `workflowhub_ud_smoke_${suffix}`;
  const subject = `workflowhub_ud_user_${suffix}`;
  const anonId = `anon-${suffix}`;

  let userId: string | undefined;
  let workflowId: string | undefined;
  let workflowIdAnon: string | undefined;
  let workflowIdXor: string | undefined;

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

    await prisma.uniqueDownload.create({
      data: {
        workflowId: wf.id,
        userId: user.id,
        anonDeviceId: null,
        firstAt: new Date(),
      },
    });

    let dupUserRejected = false;
    try {
      await prisma.uniqueDownload.create({
        data: {
          workflowId: wf.id,
          userId: user.id,
          anonDeviceId: null,
          firstAt: new Date(),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) dupUserRejected = true;
      else throw e;
    }

    if (!dupUserRejected) {
      console.error(
        "[workflowhub] Expected P2002 for duplicate (workflow_id, user_id)"
      );
      process.exit(1);
    }

    const wfAnon = await prisma.workflow.create({
      data: {
        slug: `${slug}_anon`,
        title: "smoke anon",
        description: "smoke",
        status: "draft",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
      },
    });
    workflowIdAnon = wfAnon.id;

    await prisma.uniqueDownload.create({
      data: {
        workflowId: wfAnon.id,
        userId: null,
        anonDeviceId: anonId,
        firstAt: new Date(),
      },
    });

    let dupAnonRejected = false;
    try {
      await prisma.uniqueDownload.create({
        data: {
          workflowId: wfAnon.id,
          userId: null,
          anonDeviceId: anonId,
          firstAt: new Date(),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) dupAnonRejected = true;
      else throw e;
    }

    if (!dupAnonRejected) {
      console.error(
        "[workflowhub] Expected P2002 for duplicate (workflow_id, anon_device_id)"
      );
      process.exit(1);
    }

    const wfXor = await prisma.workflow.create({
      data: {
        slug: `${slug}_xor`,
        title: "smoke xor",
        description: "smoke",
        status: "draft",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
      },
    });
    workflowIdXor = wfXor.id;

    let xorRejected = false;
    try {
      await prisma.uniqueDownload.create({
        data: {
          workflowId: wfXor.id,
          userId: user.id,
          anonDeviceId: "should-not-coexist",
          firstAt: new Date(),
        },
      });
    } catch (e) {
      if (isCheckViolation(e)) xorRejected = true;
      else throw e;
    }

    if (!xorRejected) {
      console.error(
        "[workflowhub] Expected check violation when both user_id and anon_device_id set"
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] unique download smoke OK — user dup, anon dup (P2002), XOR check enforced"
    );
  } finally {
    try {
      if (workflowId) {
        await prisma.uniqueDownload.deleteMany({
          where: { workflowId },
        });
        await prisma.workflow.delete({ where: { id: workflowId } });
      }
      if (workflowIdAnon) {
        await prisma.uniqueDownload.deleteMany({
          where: { workflowId: workflowIdAnon },
        });
        await prisma.workflow.delete({ where: { id: workflowIdAnon } });
      }
      if (workflowIdXor) {
        await prisma.uniqueDownload.deleteMany({
          where: { workflowId: workflowIdXor },
        });
        await prisma.workflow.delete({ where: { id: workflowIdXor } });
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
  console.error("[workflowhub] unique download smoke failed:", err);
  process.exit(1);
});
