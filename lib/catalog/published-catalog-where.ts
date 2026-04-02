import { Prisma, WorkflowStatus } from "@prisma/client";

export type PublishedCatalogWhereParams = {
  /** Case-insensitive substring on title or description (TASK-021). */
  searchQuery?: string;
  /**
   * Values from repeated `tag=` query params; AND across values.
   * Each value matches if some linked tag has slug OR name containing the substring (case-insensitive, TASK-041).
   */
  tagSlugs?: string[];
  /** Case-insensitive substring match on `workflows.base_model` (TASK-041). */
  baseModel?: string;
  /** Case-insensitive substring match on `workflows.comfy_version` (TASK-041). */
  comfyVersion?: string;
};

/** Published rows only; optional text search and catalog filters (TASK-021, TASK-022, TASK-041). */
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

  const uniqueTagNeedles = [...new Set(tagSlugs)];
  for (const needle of uniqueTagNeedles) {
    and.push({
      workflowTags: {
        some: {
          OR: [
            { tag: { slug: { contains: needle, mode: "insensitive" } } },
            { tag: { name: { contains: needle, mode: "insensitive" } } },
          ],
        },
      },
    });
  }

  if (baseModel) {
    and.push({
      baseModel: { contains: baseModel, mode: "insensitive" },
    });
  }

  if (comfyVersion) {
    and.push({
      comfyVersion: { contains: comfyVersion, mode: "insensitive" },
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
