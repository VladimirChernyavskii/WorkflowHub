import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getWorkflowById,
  patchWorkflowBodySchema,
  PublishValidationError,
  serializeAdminWorkflow,
  SlugConflictError,
  updateWorkflow,
} from "@/lib/admin/workflow-crud";
import { adminRouteGuard } from "@/lib/auth/admin-access";
import { getSessionUser } from "@/lib/get-session-user";

const idParamSchema = z.string().uuid();

function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  const denied = adminRouteGuard(user);
  if (denied) return denied;

  const { id } = await context.params;
  const idParsed = idParamSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const wf = await getWorkflowById(idParsed.data);
  if (!wf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeAdminWorkflow(wf));
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  const denied = adminRouteGuard(user);
  if (denied) return denied;

  const { id } = await context.params;
  const idParsed = idParamSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchWorkflowBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: zodIssues(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const wf = await updateWorkflow(idParsed.data, parsed.data);
    if (!wf) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeAdminWorkflow(wf));
  } catch (e) {
    if (e instanceof SlugConflictError) {
      return NextResponse.json(
        { error: e.message, field: e.field },
        { status: 409 }
      );
    }
    if (e instanceof PublishValidationError) {
      return NextResponse.json(
        { error: e.message, field: e.field },
        { status: 422 }
      );
    }
    throw e;
  }
}
