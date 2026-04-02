import { Prisma } from "@prisma/client";

import { buildPublishedCatalogWhere } from "@/lib/catalog/published-catalog-where";
import { prisma } from "@/lib/prisma";

/** Tags only; no `currentFile` / nodes — public catalog list (TASK-020). */
const publicCatalogInclude = {
  workflowTags: { include: { tag: true } as const },
} satisfies Prisma.WorkflowInclude;

export type WorkflowPublicListRow = Prisma.WorkflowGetPayload<{
  include: typeof publicCatalogInclude;
}>;

export type CatalogSortKind = "date" | "rating" | "downloads";
export type CatalogSortOrder = "asc" | "desc";

/** PRD §14: catalog list ordering (stable `id` tie-break). */
export function buildCatalogOrderBy(
  sort: CatalogSortKind,
  order: CatalogSortOrder
): Prisma.WorkflowOrderByWithRelationInput[] {
  const tieBreak: Prisma.WorkflowOrderByWithRelationInput = { id: "asc" };

  if (sort === "rating") {
    return [{ averageRating: order }, tieBreak];
  }
  if (sort === "downloads") {
    return [{ uniqueDownloadCount: order }, tieBreak];
  }

  const publishedNulls = order === "desc" ? "last" : "first";
  return [
    { publishedAt: { sort: order, nulls: publishedNulls } },
    { updatedAt: order },
    tieBreak,
  ];
}

/**
 * Public catalog row. Invariant: only `published` workflows are queried.
 * Default ordering: `sort=date`, `order=desc` — see `buildCatalogOrderBy`.
 */
export function serializePublicWorkflowSummary(w: WorkflowPublicListRow) {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    description: w.description,
    baseModel: w.baseModel,
    comfyVersion: w.comfyVersion,
    authorDisplayName: w.authorDisplayName,
    uniqueDownloadCount: w.uniqueDownloadCount,
    averageRating: Number(w.averageRating),
    reviewCount: w.reviewCount,
    publishedAt: w.publishedAt?.toISOString() ?? null,
    updatedAt: w.updatedAt.toISOString(),
    tags: w.workflowTags.map((wt) => ({
      id: wt.tag.id,
      slug: wt.tag.slug,
      name: wt.tag.name,
    })),
  };
}

export async function listPublishedWorkflows(params: {
  skip: number;
  take: number;
  /** Non-empty substring; case-insensitive match on title or description (TASK-021). */
  searchQuery?: string;
  /**
   * Repeated `tag=` values; AND across values. Each matches if some linked tag's slug or name
   * contains the substring (case-insensitive, TASK-041).
   */
  tagSlugs?: string[];
  /** `base_model` case-insensitive substring (TASK-041). */
  baseModel?: string;
  /** `comfy_version` case-insensitive substring (TASK-041). */
  comfyVersion?: string;
  /** PRD §5.1 / §14; defaults preserve pre–TASK-023 behavior. */
  sort?: CatalogSortKind;
  order?: CatalogSortOrder;
}): Promise<{ rows: WorkflowPublicListRow[]; total: number }> {
  const where = buildPublishedCatalogWhere({
    searchQuery: params.searchQuery,
    tagSlugs: params.tagSlugs,
    baseModel: params.baseModel,
    comfyVersion: params.comfyVersion,
  });

  const sort = params.sort ?? "date";
  const order = params.order ?? "desc";
  const orderBy = buildCatalogOrderBy(sort, order);

  const [rows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      include: publicCatalogInclude,
      orderBy,
      skip: params.skip,
      take: params.take,
    }),
    prisma.workflow.count({ where }),
  ]);

  return { rows, total };
}
