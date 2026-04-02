import { Prisma, WorkflowStatus } from "@prisma/client";

export type PublishedCatalogWhereParams = {
  /** Case-insensitive substring on title or description (TASK-021). */
  searchQuery?: string;
  /** Tag slugs; workflows must have every tag (AND) (TASK-022). */
  tagSlugs?: string[];
  /** Exact match on `workflows.base_model`. */
  baseModel?: string;
  /** Exact match on `workflows.comfy_version`. */
  comfyVersion?: string;
};

/** Published rows only; optional text search and catalog filters (TASK-021, TASK-022). */
export function buildPublishedCatalogWhere(
  params: PublishedCatalogWhereParams = {}
): Prisma.WorkflowWhereInput {
  const {
    searchQuery,
    tagSlugs = [],
    baseModel,
    comfyVersion,
  } = params;

  const and: Prisma.WorkflowWhereInput[] = [];

  if (searchQuery) {
    and.push({
      OR: [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } },
      ],
    });
  }

  const uniqueTagSlugs = [...new Set(tagSlugs)];
  for (const slug of uniqueTagSlugs) {
    and.push({
      workflowTags: { some: { tag: { slug } } },
    });
  }

  if (baseModel) {
    and.push({ baseModel });
  }

  if (comfyVersion) {
    and.push({ comfyVersion });
  }

  const base: Prisma.WorkflowWhereInput = {
    status: WorkflowStatus.published,
  };

  if (and.length === 0) {
    return base;
  }

  return {
    ...base,
    AND: and,
  };
}
