import { PrismaClient, Prisma } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] user unique smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const subject = `workflowhub_user_smoke_${Date.now()}`;

  try {
    await prisma.user.create({
      data: {
        provider: "google",
        providerSubject: subject,
        displayName: "smoke",
        role: "user",
      },
    });

    let duplicateRejected = false;
    try {
      await prisma.user.create({
        data: {
          provider: "google",
          providerSubject: subject,
          displayName: "smoke-dup",
          role: "user",
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        duplicateRejected = true;
      } else {
        throw e;
      }
    }

    if (!duplicateRejected) {
      console.error(
        "[workflowhub] Expected unique violation for duplicate (provider, provider_subject)"
      );
      process.exit(1);
    }

    console.info(
      "[workflowhub] user unique smoke OK — duplicate rejected (P2002)"
    );
  } finally {
    try {
      await prisma.user.deleteMany({ where: { providerSubject: subject } });
    } catch {
      /* ignore if DB never connected or row never created */
    }
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error("[workflowhub] user unique smoke failed:", err);
  process.exit(1);
});
