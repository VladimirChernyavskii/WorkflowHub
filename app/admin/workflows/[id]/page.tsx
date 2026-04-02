import { notFound } from "next/navigation";

import {
  getWorkflowById,
  serializeAdminWorkflow,
} from "@/lib/admin/workflow-crud";

import { EditWorkflowForm } from "./edit-workflow-form";

export default async function AdminEditWorkflowPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const wf = await getWorkflowById(id);
  if (!wf) {
    notFound();
  }
  return <EditWorkflowForm initial={serializeAdminWorkflow(wf)} />;
}
