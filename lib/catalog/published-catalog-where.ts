import { Prisma, WorkflowStatus } from "@prisma/client";

export type PublishedCatalogWhereParams = {
  /** Case-insensitive substring on title or description (TASK-021). */
  searchQuery?: string;
  /** Tag slugs; workflows must have every tag (AND); full-string match, case-insensitive (TASK-022, TASK-040). */
  tagSlugs?: string[];
  /** Full-string match on `workflows.base_model`, case-insensitive (TASK-040). */
  baseModel?: string;
  /** Full-string match on `workflows.comfy_version`, case-insensitive (TASK-040). */
  comfyVersion?: string;
};

/** Published rows only; optional text search and catalog filters (TASK-021, TASK-022, TASK-040). */
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
      workflowTags: {
        some: {
          tag: { slug: { equals: slug, mode: "insensitive" } },
        },
      },
    });
  }

  if (baseModel) {
    and.push({
      baseModel: { equals: baseModel, mode: "insensitive" },
    });
  }

  if (comfyVersion) {
    and.push({
      comfyVersion: { equals: comfyVersion, mode: "insensitive" },
    });
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
