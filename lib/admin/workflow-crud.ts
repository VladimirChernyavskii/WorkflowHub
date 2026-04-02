import "server-only";

import { Prisma, WorkflowStatus, type Workflow } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** URL-safe slug: lowercase, hyphens, a-z0-9 only after normalization. */
const SLUG_MAX = 128;
const TEXT_MAX = 10_000;

export function normalizeSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s;
}

function normalizeTagSlug(raw: string): string {
  return normalizeSlug(raw);
}

const nonEmptyTrimmed = z
  .string()
  .trim()
  .min(1, "Required")
  .max(TEXT_MAX);

const slugField = z
  .string()
  .trim()
  .min(1, "Slug required")
  .max(SLUG_MAX)
  .transform(normalizeSlug)
  .refine((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), {
    message: "Slug must be URL-safe (lowercase letters, digits, hyphens)",
  });

const workflowStatusZ = z.enum(["draft", "published", "archived"]);

const tagSlugsArraySchema = z.array(z.string().trim().min(1).max(SLUG_MAX)).transform((arr) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const s = normalizeTagSlug(raw);
    if (!s || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
});

export const workflowTagSlugsSchema = tagSlugsArraySchema.optional();

/** POST body: full metadata; default status draft. */
export const createWorkflowBodySchema = z.object({
  title: nonEmptyTrimmed.max(500),
  slug: slugField,
  description: nonEmptyTrimmed,
  status: workflowStatusZ.optional().default("draft"),
  baseModel: nonEmptyTrimmed.max(200),
  comfyVersion: nonEmptyTrimmed.max(200),
  authorDisplayName: nonEmptyTrimmed.max(200),
  tagSlugs: workflowTagSlugsSchema,
});

export type CreateWorkflowBody = z.infer<typeof createWorkflowBodySchema>;

/** PATCH: partial fields; `tagSlugs` when present replaces all links (use [] to clear). */
export const patchWorkflowBodySchema = z
  .object({
    title: nonEmptyTrimmed.max(500).optional(),
    slug: slugField.optional(),
    description: nonEmptyTrimmed.optional(),
    status: workflowStatusZ.optional(),
    baseModel: nonEmptyTrimmed.max(200).optional(),
    comfyVersion: nonEmptyTrimmed.max(200).optional(),
    authorDisplayName: nonEmptyTrimmed.max(200).optional(),
    tagSlugs: tagSlugsArraySchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field required",
  });

export type PatchWorkflowBody = z.infer<typeof patchWorkflowBodySchema>;

export type WorkflowWithTags = Prisma.WorkflowGetPayload<{
  include: {
    workflowTags: { include: { tag: true } };
    currentFile: { select: { id: true } };
  };
}>;

export const workflowAdminInclude = {
  workflowTags: { include: { tag: true } as const },
  currentFile: { select: { id: true } },
} satisfies Prisma.WorkflowInclude;

/**
 * Publish policy: all catalog-facing metadata must be non-empty (already enforced on create).
 * On PATCH, merged state must satisfy the same before status can be `published`.
 */
export function assertPublishableMetadata(fields: {
  title: string;
  slug: string;
  description: string;
  baseModel: string;
  comfyVersion: string;
  authorDisplayName: string;
}): void {
  const entries: [string, string][] = [
    ["title", fields.title],
    ["slug", fields.slug],
    ["description", fields.description],
    ["baseModel", fields.baseModel],
    ["comfyVersion", fields.comfyVersion],
    ["authorDisplayName", fields.authorDisplayName],
  ];
  for (const [key, v] of entries) {
    if (!v.trim()) {
      throw new PublishValidationError(
        `Cannot publish: "${key}" must be non-empty`,
        key
      );
    }
  }
}

export class PublishValidationError extends Error {
  constructor(
    message: string,
    readonly field: string
  ) {
    super(message);
    this.name = "PublishValidationError";
  }
}

function tagNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function syncWorkflowTags(
  tx: Prisma.TransactionClient,
  workflowId: string,
  tagSlugs: string[]
): Promise<void> {
  await tx.workflowTag.deleteMany({ where: { workflowId } });
  if (tagSlugs.length === 0) return;

  for (const slug of tagSlugs) {
    await tx.tag.upsert({
      where: { slug },
      create: { slug, name: tagNameFromSlug(slug) || slug },
      update: {},
    });
  }

  const tags = await tx.tag.findMany({
    where: { slug: { in: tagSlugs } },
  });
  const bySlug = new Map(tags.map((t) => [t.slug, t.id]));
  const rows = tagSlugs
    .map((slug) => {
      const tagId = bySlug.get(slug);
      return tagId ? { workflowId, tagId } : null;
    })
    .filter((r): r is { workflowId: string; tagId: string } => r !== null);

  if (rows.length > 0) {
    await tx.workflowTag.createMany({ data: rows });
  }
}

export type SerializedAdminWorkflow = ReturnType<typeof serializeAdminWorkflow>;

export function serializeAdminWorkflow(w: WorkflowWithTags) {
  return {
    id: w.id,
    slug: w.slug,
    title: w.title,
    description: w.description,
    status: w.status,
    baseModel: w.baseModel,
    comfyVersion: w.comfyVersion,
    authorDisplayName: w.authorDisplayName,
    uniqueDownloadCount: w.uniqueDownloadCount,
    averageRating: Number(w.averageRating),
    reviewCount: w.reviewCount,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    publishedAt: w.publishedAt?.toISOString() ?? null,
    hasWorkflowFile: !!w.currentFile,
    tags: w.workflowTags.map((wt) => ({
      id: wt.tag.id,
      slug: wt.tag.slug,
      name: wt.tag.name,
    })),
  };
}

export async function createWorkflow(
  data: CreateWorkflowBody
): Promise<WorkflowWithTags> {
  if (data.status === "published") {
    assertPublishableMetadata({
      title: data.title,
      slug: data.slug,
      description: data.description,
      baseModel: data.baseModel,
      comfyVersion: data.comfyVersion,
      authorDisplayName: data.authorDisplayName,
    });
  }

  const now = new Date();
  const publishedAt =
    data.status === "published" ? now : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const wf = await tx.workflow.create({
        data: {
          title: data.title.trim(),
          slug: data.slug,
          description: data.description.trim(),
          status: data.status as WorkflowStatus,
          baseModel: data.baseModel.trim(),
          comfyVersion: data.comfyVersion.trim(),
          authorDisplayName: data.authorDisplayName.trim(),
          publishedAt,
        },
      });
      if (data.tagSlugs?.length) {
        await syncWorkflowTags(tx, wf.id, data.tagSlugs);
      }
      const full = await tx.workflow.findUniqueOrThrow({
        where: { id: wf.id },
        include: workflowAdminInclude,
      });
      return full;
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const target = (e.meta?.target as string[] | undefined) ?? [];
      const field = target.includes("slug") ? "slug" : "unknown";
      throw new SlugConflictError(field);
    }
    throw e;
  }
}

export class SlugConflictError extends Error {
  constructor(readonly field: string) {
    super("Slug already exists");
    this.name = "SlugConflictError";
  }
}

export function mergePatchWithWorkflow(
  existing: Workflow,
  patch: PatchWorkflowBody
): {
  title: string;
  slug: string;
  description: string;
  status: WorkflowStatus;
  baseModel: string;
  comfyVersion: string;
  authorDisplayName: string;
} {
  return {
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    slug: patch.slug !== undefined ? patch.slug : existing.slug,
    description:
      patch.description !== undefined
        ? patch.description.trim()
        : existing.description,
    status:
      patch.status !== undefined
        ? (patch.status as WorkflowStatus)
        : existing.status,
    baseModel:
      patch.baseModel !== undefined
        ? patch.baseModel.trim()
        : existing.baseModel,
    comfyVersion:
      patch.comfyVersion !== undefined
        ? patch.comfyVersion.trim()
        : existing.comfyVersion,
    authorDisplayName:
      patch.authorDisplayName !== undefined
        ? patch.authorDisplayName.trim()
        : existing.authorDisplayName,
  };
}

export async function updateWorkflow(
  id: string,
  patch: PatchWorkflowBody
): Promise<WorkflowWithTags | null> {
  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) return null;

  const merged = mergePatchWithWorkflow(existing, patch);
  if (merged.status === "published") {
    assertPublishableMetadata(merged);
  }

  const publishedAt =
    merged.status === "published"
      ? existing.publishedAt ?? new Date()
      : existing.publishedAt;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.workflow.update({
        where: { id },
        data: {
          title: merged.title,
          slug: merged.slug,
          description: merged.description,
          status: merged.status,
          baseModel: merged.baseModel,
          comfyVersion: merged.comfyVersion,
          authorDisplayName: merged.authorDisplayName,
          publishedAt,
        },
      });

      if (patch.tagSlugs !== undefined) {
        await syncWorkflowTags(tx, id, patch.tagSlugs);
      }

      return tx.workflow.findUniqueOrThrow({
        where: { id },
        include: workflowAdminInclude,
      });
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const target = (e.meta?.target as string[] | undefined) ?? [];
      const field = target.includes("slug") ? "slug" : "unknown";
      throw new SlugConflictError(field);
    }
    throw e;
  }
}

export async function getWorkflowById(
  id: string
): Promise<WorkflowWithTags | null> {
  return prisma.workflow.findUnique({
    where: { id },
    include: workflowAdminInclude,
  });
}

export async function listWorkflowsForAdmin(): Promise<WorkflowWithTags[]> {
  return prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
    include: workflowAdminInclude,
  });
}
