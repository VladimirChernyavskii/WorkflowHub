import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] admin audit log smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const subject = `workflowhub_audit_smoke_${Date.now()}`;
  let userId: string | undefined;
  let logId: string | undefined;

  try {
    const user = await prisma.user.create({
      data: {
        provider: "google",
        providerSubject: subject,
        displayName: "smoke-admin",
        role: "admin",
      },
    });
    userId = user.id;

    const entityId = randomUUID();
    const row = await prisma.adminAuditLog.create({
      data: {
        adminUserId: user.id,
        action: "workflow.publish",
        entityType: "workflow",
        entityId,
        payloadJson: { slug: "test", note: "smoke — no secrets" },
      },
    });
    logId = row.id;

    const fetched = await prisma.adminAuditLog.findUnique({
      where: { id: row.id },
    });
    if (!fetched || fetched.adminUserId !== user.id) {
      console.error(
        "[workflowhub] Expected audit row by id with matching admin_user_id"
      );
      process.exit(1);
    }

    let fkRejected = false;
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: randomUUID(),
          action: "x",
          entityType: "y",
          entityId: randomUUID(),
          payloadJson: {},
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2003"
      ) {
        fkRejected = true;
      } else {
        throw e;
      }
    }

    if (!fkRejected) {
      console.error(
        "[workflowhub] Expected FK violation (P2003) for missing admin_user_id"
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] admin audit log smoke OK — insert, select by id, FK rejects bogus user"
    );
  } finally {
    if (logId) {
      try {
        await prisma.adminAuditLog.deleteMany({ where: { id: logId } });
      } catch {
        /* ignore */
      }
    }
    if (userId) {
      try {
        await prisma.user.deleteMany({ where: { id: userId } });
      } catch {
        /* ignore */
      }
    }
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] admin audit log smoke failed:", err);
  process.exit(1);
});
