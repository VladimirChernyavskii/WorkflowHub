import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

import { buildPublishedCatalogWhere } from "../lib/catalog/published-catalog-where";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const catalogInclude = {
  workflowTags: { include: { tag: true } as const },
} satisfies Prisma.WorkflowInclude;

async function listPublishedLike(
  prisma: PrismaClient,
  params: { skip: number; take: number; searchQuery?: string }
) {
  const where = buildPublishedCatalogWhere({
    searchQuery: params.searchQuery,
  });
  const [rows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      include: catalogInclude,
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      skip: params.skip,
      take: params.take,
    }),
    prisma.workflow.count({ where }),
  ]);
  return { rows, total };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] catalog-search-smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const token = `CatSearchToken_${suffix}`;
  const descToken = `CatSearchDesc_${suffix}`;
  const slugA = `catalog_search_a_${suffix}`;
  const slugB = `catalog_search_b_${suffix}`;

  let idA: string | undefined;
  let idB: string | undefined;

  try {
    const a = await prisma.workflow.create({
      data: {
        slug: slugA,
        title: `Alpha ${token} Beta`,
        description: "plain a",
        status: "published",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
        publishedAt: new Date(),
      },
    });
    idA = a.id;

    const b = await prisma.workflow.create({
      data: {
        slug: slugB,
        title: "Gamma Delta Unrelated",
        description: `wrap ${descToken} end`,
        status: "published",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
        publishedAt: new Date(),
      },
    });
    idB = b.id;

    const filtered = await listPublishedLike(prisma, {
      skip: 0,
      take: 50,
      searchQuery: token,
    });

    const ids = filtered.rows.map((r) => r.id);
    if (filtered.total < 1 || !ids.includes(idA) || ids.includes(idB)) {
      console.error(
        "[workflowhub] catalog-search-smoke: expected only workflow A for token query",
        { ids, total: filtered.total }
      );
      process.exit(1);
    }

    const unfiltered = await listPublishedLike(prisma, {
      skip: 0,
      take: 500,
    });
    if (!unfiltered.rows.some((r) => r.id === idA)) {
      console.error("[workflowhub] catalog-search-smoke: missing A without q");
      process.exit(1);
    }
    if (!unfiltered.rows.some((r) => r.id === idB)) {
      console.error("[workflowhub] catalog-search-smoke: missing B without q");
      process.exit(1);
    }

    const byDesc = await listPublishedLike(prisma, {
      skip: 0,
      take: 50,
      searchQuery: descToken,
    });
    if (
      !byDesc.rows.some((r) => r.id === idB) ||
      byDesc.rows.some((r) => r.id === idA)
    ) {
      console.error(
        "[workflowhub] catalog-search-smoke: description-only match failed"
      );
      process.exit(1);
    }

    console.log("[workflowhub] catalog-search-smoke OK");
  } finally {
    const ids = [idA, idB].filter((x): x is string => Boolean(x));
    if (ids.length > 0) {
      await prisma.workflow.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
