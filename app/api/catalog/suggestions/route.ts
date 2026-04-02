import { NextResponse } from "next/server";
import { WorkflowStatus } from "@prisma/client";
import { z } from "zod";

import {
  CATALOG_SUGGESTIONS_LIMIT,
  MAX_FILTER_STRING_LENGTH,
} from "@/lib/catalog/query-limits";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  kind: z.enum(["tag", "base_model", "comfy_version"]),
  q: z.string().max(MAX_FILTER_STRING_LENGTH).optional(),
});

function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

type CatalogSuggestionItem = { value: string; label?: string };

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

  const qTrimmed = parsed.data.q?.trim() ?? "";
  if (qTrimmed.length === 0) {
    return NextResponse.json({ suggestions: [] as CatalogSuggestionItem[] });
  }

  const { kind } = parsed.data;
  const take = CATALOG_SUGGESTIONS_LIMIT;
  const published = WorkflowStatus.published;

  if (kind === "tag") {
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { slug: { contains: qTrimmed, mode: "insensitive" } },
          { name: { contains: qTrimmed, mode: "insensitive" } },
        ],
        workflowTags: {
          some: { workflow: { status: published } },
        },
      },
      select: { slug: true, name: true },
      orderBy: { slug: "asc" },
      take,
    });
    const suggestions: CatalogSuggestionItem[] = tags.map((t) => ({
      value: t.slug,
      label: t.name,
    }));
    return NextResponse.json({ suggestions });
  }

  if (kind === "base_model") {
    const rows = await prisma.workflow.findMany({
      where: {
        status: published,
        NOT: { baseModel: "" },
        baseModel: { contains: qTrimmed, mode: "insensitive" },
      },
      distinct: ["baseModel"],
      select: { baseModel: true },
      orderBy: { baseModel: "asc" },
      take,
    });
    const suggestions: CatalogSuggestionItem[] = rows.map((r) => ({
      value: r.baseModel,
    }));
    return NextResponse.json({ suggestions });
  }

  const rows = await prisma.workflow.findMany({
    where: {
      status: published,
      NOT: { comfyVersion: "" },
      comfyVersion: { contains: qTrimmed, mode: "insensitive" },
    },
    distinct: ["comfyVersion"],
    select: { comfyVersion: true },
    orderBy: { comfyVersion: "asc" },
    take,
  });
  const suggestions: CatalogSuggestionItem[] = rows.map((r) => ({
    value: r.comfyVersion,
  }));
  return NextResponse.json({ suggestions });
}
