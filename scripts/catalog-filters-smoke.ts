import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";

import { buildPublishedCatalogWhere } from "../lib/catalog/published-catalog-where";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function countMatching(
  prisma: PrismaClient,
  params: Parameters<typeof buildPublishedCatalogWhere>[0]
) {
  const where = buildPublishedCatalogWhere(params);
  const rows = await prisma.workflow.findMany({
    where,
    select: { id: true },
  });
  const total = await prisma.workflow.count({ where });
  return { ids: new Set(rows.map((r) => r.id)), total };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[workflowhub] catalog-filters-smoke: set DATABASE_URL (.env / .env.local)"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const slugT1 = `cat_filt_portrait_${suffix}`;
  /** Short slug so a name-only needle does not appear in the slug. */
  const slugT2 = `b_${suffix}`;
  const wfSlug1 = `cat_filt_w1_${suffix}`;
  const wfSlug2 = `cat_filt_w2_${suffix}`;
  const wfSlug3 = `cat_filt_w3_${suffix}`;

  try {
    const tag1 = await prisma.tag.create({
      data: { slug: slugT1, name: "Cat filter T1" },
    });
    const tag2 = await prisma.tag.create({
      data: { slug: slugT2, name: `Label_name_marker_${suffix}` },
    });

    const pub = {
      status: "published" as const,
      authorDisplayName: "smoke",
      publishedAt: new Date(),
    };

    const w1 = await prisma.workflow.create({
      data: {
        slug: wfSlug1,
        title: "Cat filter W1",
        description: "d1",
        ...pub,
        baseModel: "SDXL",
        comfyVersion: "1.0",
      },
    });
    const w2 = await prisma.workflow.create({
      data: {
        slug: wfSlug2,
        title: "Cat filter W2",
        description: "d2",
        ...pub,
        baseModel: `CatFiltFlux_${suffix}`,
        comfyVersion: `CatFiltComfy_v2.0_${suffix}`,
      },
    });
    const w3 = await prisma.workflow.create({
      data: {
        slug: wfSlug3,
        title: "Cat filter W3",
        description: "d3",
        ...pub,
        baseModel: "SDXL",
        comfyVersion: "1.0",
      },
    });
    await prisma.workflowTag.create({
      data: { workflowId: w1.id, tagId: tag1.id },
    });
    await prisma.workflowTag.createMany({
      data: [
        { workflowId: w2.id, tagId: tag1.id },
        { workflowId: w2.id, tagId: tag2.id },
      ],
    });
    await prisma.workflowTag.create({
      data: { workflowId: w3.id, tagId: tag2.id },
    });

    const oneTag = await countMatching(prisma, { tagSlugs: [slugT1] });
    if (
      oneTag.total !== 2 ||
      !oneTag.ids.has(w1.id) ||
      !oneTag.ids.has(w2.id) ||
      oneTag.ids.has(w3.id)
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: expected two workflows for single tag",
        oneTag
      );
      process.exit(1);
    }

    const oneTagAltCase = await countMatching(prisma, {
      tagSlugs: [slugT1.toUpperCase()],
    });
    if (
      oneTagAltCase.total !== oneTag.total ||
      oneTagAltCase.ids.size !== oneTag.ids.size ||
      ![...oneTag.ids].every((id) => oneTagAltCase.ids.has(id))
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: tag value alternate case should match same rows",
        { oneTag, oneTagAltCase }
      );
      process.exit(1);
    }

    const tagPartialPortrait = await countMatching(prisma, {
      tagSlugs: [`rait_${suffix}`],
    });
    if (
      !tagPartialPortrait.ids.has(w1.id) ||
      !tagPartialPortrait.ids.has(w2.id) ||
      tagPartialPortrait.ids.has(w3.id) ||
      tagPartialPortrait.total < oneTag.total
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: tag substring in portrait slug must include w1+w2, exclude w3",
        tagPartialPortrait
      );
      process.exit(1);
    }

    const tagByName = await countMatching(prisma, {
      tagSlugs: [`name_marker_${suffix}`],
    });
    if (
      !tagByName.ids.has(w2.id) ||
      !tagByName.ids.has(w3.id) ||
      tagByName.ids.has(w1.id) ||
      tagByName.total < 2
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: tag match via tag name must include w2+w3, not w1",
        tagByName
      );
      process.exit(1);
    }

    const twoTags = await countMatching(prisma, {
      tagSlugs: [slugT1, slugT2],
    });
    if (twoTags.total !== 1 || !twoTags.ids.has(w2.id)) {
      console.error(
        "[workflowhub] catalog-filters-smoke: expected only W2 for two tags (AND)",
        twoTags
      );
      process.exit(1);
    }

    if (oneTag.total < twoTags.total) {
      console.error(
        "[workflowhub] catalog-filters-smoke: single-tag count should be >= two-tag count"
      );
      process.exit(1);
    }

    const unknownTag = await countMatching(prisma, {
      tagSlugs: [`zz_cat_filt_missing_${suffix}`],
    });
    if (unknownTag.total !== 0) {
      console.error(
        "[workflowhub] catalog-filters-smoke: tag needle matching no slug/name should yield empty list",
        unknownTag
      );
      process.exit(1);
    }

    const fluxNeedle = `CatFiltFlux_${suffix}`;
    const fluxOnly = await countMatching(prisma, { baseModel: fluxNeedle });
    if (!fluxOnly.ids.has(w2.id) || fluxOnly.total < 1) {
      console.error(
        "[workflowhub] catalog-filters-smoke: base_model fixture Flux needle mismatch",
        fluxOnly
      );
      process.exit(1);
    }

    const fluxLower = await countMatching(prisma, {
      baseModel: fluxNeedle.toLowerCase(),
    });
    if (
      !fluxLower.ids.has(w2.id) ||
      fluxLower.total < fluxOnly.total ||
      ![...fluxOnly.ids].every((id) => fluxLower.ids.has(id))
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: base_model case-insensitive mismatch",
        { fluxOnly, fluxLower }
      );
      process.exit(1);
    }

    const sdxlPartial = await countMatching(prisma, { baseModel: "sdxl" });
    if (
      !sdxlPartial.ids.has(w1.id) ||
      !sdxlPartial.ids.has(w3.id) ||
      sdxlPartial.ids.has(w2.id) ||
      sdxlPartial.total < 2
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: base_model substring sdxl must include fixture W1+W3, not W2",
        sdxlPartial
      );
      process.exit(1);
    }

    const comfyFull = `CatFiltComfy_v2.0_${suffix}`;
    const comfyV20 = await countMatching(prisma, { comfyVersion: comfyFull });
    if (!comfyV20.ids.has(w2.id) || comfyV20.total < 1) {
      console.error(
        "[workflowhub] catalog-filters-smoke: comfy_version full fixture mismatch",
        comfyV20
      );
      process.exit(1);
    }

    const comfyV20AltCase = await countMatching(prisma, {
      comfyVersion: comfyFull.replace("v2", "V2"),
    });
    if (
      !comfyV20AltCase.ids.has(w2.id) ||
      comfyV20AltCase.total < comfyV20.total ||
      ![...comfyV20.ids].every((id) => comfyV20AltCase.ids.has(id))
    ) {
      console.error(
        "[workflowhub] catalog-filters-smoke: comfy_version case-insensitive mismatch",
        { comfyV20, comfyV20AltCase }
      );
      process.exit(1);
    }

    const comfyPartial = await countMatching(prisma, {
      comfyVersion: `2.0_${suffix}`,
    });
    if (!comfyPartial.ids.has(w2.id) || comfyPartial.total < 1) {
      console.error(
        "[workflowhub] catalog-filters-smoke: comfy_version substring must include fixture W2",
        comfyPartial
      );
      process.exit(1);
    }

    const andMeta = await countMatching(prisma, {
      tagSlugs: [slugT2],
      baseModel: "SDXL",
    });
    if (andMeta.total !== 1 || !andMeta.ids.has(w3.id)) {
      console.error(
        "[workflowhub] catalog-filters-smoke: tag2 + SDXL should be W3 only",
        andMeta
      );
      process.exit(1);
    }

    const tripleAnd = await countMatching(prisma, {
      searchQuery: "Cat filter",
      tagSlugs: [slugT1],
      baseModel: "CatFiltFlux",
    });
    if (tripleAnd.total !== 1 || !tripleAnd.ids.has(w2.id)) {
      console.error(
        "[workflowhub] catalog-filters-smoke: q + tag + base_model AND failed",
        tripleAnd
      );
      process.exit(1);
    }

    console.log("[workflowhub] catalog-filters-smoke OK");
  } finally {
    await prisma.workflow.deleteMany({
      where: { slug: { in: [wfSlug1, wfSlug2, wfSlug3] } },
    });
    await prisma.tag.deleteMany({
      where: { slug: { in: [slugT1, slugT2] } },
    });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
