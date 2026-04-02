import "server-only";

import { Prisma, WorkflowStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Tags only; no `currentFile` / nodes — public catalog list (TASK-020). */
const publicCatalogInclude = {
  workflowTags: { include: { tag: true } as const },
} satisfies Prisma.WorkflowInclude;

export type WorkflowPublicListRow = Prisma.WorkflowGetPayload<{
  include: typeof publicCatalogInclude;
}>;

/**
 * Public catalog row. Invariant: only `published` workflows are queried.
 * Default DB ordering is `publishedAt desc` (nulls last), then `updatedAt desc` — TASK-023 may add `sort` query.
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
}): Promise<{ rows: WorkflowPublicListRow[]; total: number }> {
  const where = { status: WorkflowStatus.published };

  const [rows, total] = await Promise.all([
    prisma.workflow.findMany({
      where,
      include: publicCatalogInclude,
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
