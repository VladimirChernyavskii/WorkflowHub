import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listPublishedWorkflows,
  serializePublicWorkflowSummary,
} from "@/lib/catalog/workflow-list";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_Q_LENGTH = 200;
const MAX_FILTER_STRING_LENGTH = 200;
const MAX_TAG_PARAMS = 20;
const MAX_TAG_SLUG_LENGTH = 100;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  q: z.string().max(MAX_SEARCH_Q_LENGTH).optional(),
  base_model: z.string().max(MAX_FILTER_STRING_LENGTH).optional(),
  comfy_version: z.string().max(MAX_FILTER_STRING_LENGTH).optional(),
  sort: z.enum(["date", "rating", "downloads"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

type CatalogIssue = { path: string; message: string };

function parseTagSlugs(
  searchParams: URLSearchParams
): { slugs: string[] } | { issues: CatalogIssue[] } {
  const raw = searchParams.getAll("tag");
  const slugs: string[] = [];
  for (const entry of raw) {
    const t = entry.trim();
    if (t.length === 0) {
      continue;
    }
    if (t.length > MAX_TAG_SLUG_LENGTH) {
      return {
        issues: [
          {
            path: "tag",
            message: `Each tag slug must be at most ${MAX_TAG_SLUG_LENGTH} characters`,
          },
        ],
      };
    }
    slugs.push(t);
  }
  if (slugs.length > MAX_TAG_PARAMS) {
    return {
      issues: [
        {
          path: "tag",
          message: `At most ${MAX_TAG_PARAMS} tag query parameters allowed`,
        },
      ],
    };
  }
  return { slugs: [...new Set(slugs)] };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: zodIssues(parsed.error) },
      { status: 400 }
    );
  }

  const tagParsed = parseTagSlugs(url.searchParams);
  if ("issues" in tagParsed) {
    return NextResponse.json(
      { error: "Invalid query", issues: tagParsed.issues },
      { status: 400 }
    );
  }
  const { slugs: tagSlugs } = tagParsed;

  const { page, pageSize, q, base_model, comfy_version, sort, order } =
    parsed.data;
  const skip = (page - 1) * pageSize;
  const qTrimmed = q?.trim() ?? "";
  const searchQuery =
    qTrimmed.length > 0 ? qTrimmed : undefined;

  const baseModelTrim = base_model?.trim() ?? "";
  const baseModel =
    baseModelTrim.length > 0 ? baseModelTrim : undefined;

  const comfyVersionTrim = comfy_version?.trim() ?? "";
  const comfyVersion =
    comfyVersionTrim.length > 0 ? comfyVersionTrim : undefined;

  const { rows, total } = await listPublishedWorkflows({
    skip,
    take: pageSize,
    searchQuery,
    tagSlugs: tagSlugs.length > 0 ? tagSlugs : undefined,
    baseModel,
    comfyVersion,
    sort,
    order,
  });

  return NextResponse.json({
    workflows: rows.map(serializePublicWorkflowSummary),
    page,
    pageSize,
    total,
  });
}
