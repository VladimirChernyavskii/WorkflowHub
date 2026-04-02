import type { PrismaClient } from "@prisma/client";

/**
 * Replaces only `derived` rows for the workflow; `admin` overrides are untouched.
 */
export async function replaceDerivedWorkflowNodes(
  prisma: PrismaClient,
  workflowId: string,
  nodeTypes: string[]
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.workflowNode.deleteMany({
      where: { workflowId, source: "derived" },
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
  });
}
