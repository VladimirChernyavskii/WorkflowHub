import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

import { listPublishedWorkflows } from "../lib/catalog/workflow-list";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function assertThreeOrder(
  rowIds: string[],
  first: string,
  second: string,
  third: string,
  label: string
) {
  const i = (id: string) => rowIds.indexOf(id);
  const a = i(first);
  const b = i(second);
  const c = i(third);
  if (a < 0 || b < 0 || c < 0) {
    console.error(`[workflowhub] catalog-sort-smoke: missing id in ${label}`, {
      rowIds,
      first,
      second,
      third,
    });
    process.exit(1);
  }
  if (!(a < b && b < c)) {
    console.error(`[workflowhub] catalog-sort-smoke: wrong order for ${label}`, {
      rowIds,
      first,
      second,
      third,
      indices: [a, b, c],
    });
    process.exit(1);
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] catalog-sort-smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const token = `CatSortTok_${suffix}`;
  const slugLow = `cat_sort_low_${suffix}`;
  const slugMid = `cat_sort_mid_${suffix}`;
  const slugHigh = `cat_sort_high_${suffix}`;

  let idLow: string | undefined;
  let idMid: string | undefined;
  let idHigh: string | undefined;

  try {
    const pub = {
      status: "published" as const,
      authorDisplayName: "smoke",
      baseModel: "SDXL",
      comfyVersion: "1.0",
    };

    const wLow = await prisma.workflow.create({
      data: {
        slug: slugLow,
        title: `${token} low`,
        description: "d",
        ...pub,
        averageRating: 1.0,
        uniqueDownloadCount: 300,
        publishedAt: new Date("2020-01-01T12:00:00.000Z"),
      },
    });
    idLow = wLow.id;

    const wMid = await prisma.workflow.create({
      data: {
        slug: slugMid,
        title: `${token} mid`,
        description: "d",
        ...pub,
        averageRating: 3.0,
        uniqueDownloadCount: 200,
        publishedAt: new Date("2022-06-01T12:00:00.000Z"),
      },
    });
    idMid = wMid.id;

    const wHigh = await prisma.workflow.create({
      data: {
        slug: slugHigh,
        title: `${token} high`,
        description: "d",
        ...pub,
        averageRating: 5.0,
        uniqueDownloadCount: 100,
        publishedAt: new Date("2024-01-01T12:00:00.000Z"),
      },
    });
    idHigh = wHigh.id;

    const byRating = await listPublishedWorkflows({
      skip: 0,
      take: 50,
      searchQuery: token,
      sort: "rating",
      order: "desc",
    });
    if (byRating.rows.length !== 3) {
      console.error(
        "[workflowhub] catalog-sort-smoke: expected 3 rows for rating query",
        byRating.rows.length
      );
      process.exit(1);
    }
    assertThreeOrder(
      byRating.rows.map((r) => r.id),
      idHigh,
      idMid,
      idLow,
      "rating desc"
    );

    const byDownloads = await listPublishedWorkflows({
      skip: 0,
      take: 50,
      searchQuery: token,
      sort: "downloads",
      order: "desc",
    });
    assertThreeOrder(
      byDownloads.rows.map((r) => r.id),
      idLow,
      idMid,
      idHigh,
      "downloads desc"
    );

    const byDate = await listPublishedWorkflows({
      skip: 0,
      take: 50,
      searchQuery: token,
      sort: "date",
      order: "desc",
    });
    assertThreeOrder(
      byDate.rows.map((r) => r.id),
      idHigh,
      idMid,
      idLow,
      "date desc"
    );

    console.log("[workflowhub] catalog-sort-smoke OK");
  } finally {
    const ids = [idLow, idMid, idHigh].filter((x): x is string => Boolean(x));
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
