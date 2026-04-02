import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Applies parsed ComfyUI workflow node types to the DB after JSON upload/replace.
 *
 * Policy (PRD §5.2): admin overrides must not survive a new JSON parse — stale
 * manual lists are worse than resetting. Deletes **all** `WorkflowNode` rows for
 * the workflow, then inserts only `derived` from `nodeTypes`. Display list is
 * derived until the admin saves overrides again.
 */
export async function replaceDerivedWorkflowNodesInTransaction(
  tx: Prisma.TransactionClient,
  workflowId: string,
  nodeTypes: string[]
): Promise<void> {
  await tx.workflowNode.deleteMany({
    where: { workflowId },
  });
  if (nodeTypes.length === 0) {
    return;
  }
  await tx.workflowNode.createMany({
    data: nodeTypes.map((nodeType, sortOrder) => ({
      workflowId,
      nodeType,
      sortOrder,
      source: "derived" as const,
    })),
  });
}

export async function replaceDerivedWorkflowNodes(
  prisma: PrismaClient,
  workflowId: string,
  nodeTypes: string[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await replaceDerivedWorkflowNodesInTransaction(tx, workflowId, nodeTypes);
  });
}
