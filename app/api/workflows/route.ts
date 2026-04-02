import { NextResponse } from "next/server";
import { z } from "zod";

import {
  listPublishedWorkflows,
  serializePublicWorkflowSummary,
} from "@/lib/catalog/workflow-list";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
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

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;

  const { rows, total } = await listPublishedWorkflows({ skip, take: pageSize });

  return NextResponse.json({
    workflows: rows.map(serializePublicWorkflowSummary),
    page,
    pageSize,
    total,
  });
}
