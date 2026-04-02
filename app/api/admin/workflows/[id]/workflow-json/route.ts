import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getWorkflowById,
  serializeAdminWorkflow,
} from "@/lib/admin/workflow-crud";
import {
  commitWorkflowJsonUpload,
  readWorkflowJsonBytes,
  WorkflowJsonUploadError,
} from "@/lib/admin/workflow-json-upload";
import {
  ComfyWorkflowJsonSyntaxError,
  ComfyWorkflowShapeError,
} from "@/lib/comfy/parse-workflow-node-types";
import { adminRouteGuard } from "@/lib/auth/admin-access";
import { getSessionUser } from "@/lib/get-session-user";
import { prisma } from "@/lib/prisma";

const idParamSchema = z.string().uuid();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  const denied = adminRouteGuard(user);
  if (denied) return denied;

  const { id } = await context.params;
  const idParsed = idParamSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const exists = await prisma.workflow.findUnique({
    where: { id: idParsed.data },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readWorkflowJsonBytes(request);
  } catch (e) {
    if (e instanceof WorkflowJsonUploadError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  try {
    await commitWorkflowJsonUpload(idParsed.data, bytes);
  } catch (e) {
    if (
      e instanceof ComfyWorkflowJsonSyntaxError ||
      e instanceof ComfyWorkflowShapeError
    ) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    throw e;
  }

  const wf = await getWorkflowById(idParsed.data);
  if (!wf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(serializeAdminWorkflow(wf));
}
