import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

import {
  ComfyWorkflowJsonSyntaxError,
  ComfyWorkflowShapeError,
  parseComfyWorkflowNodeTypesFromString,
} from "../lib/comfy/parse-workflow-node-types";
import { replaceDerivedWorkflowNodes } from "../lib/comfy/replace-derived-workflow-nodes";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`[workflowhub] ${label}: expected ${e}, got ${a}`);
    process.exit(1);
  }
}

async function main() {
  const root = process.cwd();
  const apiPath = resolve(root, "fixtures/comfy-workflow-api-sample.json");
  const uiPath = resolve(root, "fixtures/comfy-workflow-ui-sample.json");

  const apiRaw = await readFile(apiPath, "utf8");
  const apiTypes = parseComfyWorkflowNodeTypesFromString(apiRaw);
  assertEqual("API sample node types", apiTypes, [
    "CheckpointLoaderSimple",
    "KSampler",
  ]);

  const uiRaw = await readFile(uiPath, "utf8");
  const uiTypes = parseComfyWorkflowNodeTypesFromString(uiRaw);
  assertEqual("UI sample node types", uiTypes, ["Foo", "Bar"]);

  let syntaxOk = false;
  try {
    parseComfyWorkflowNodeTypesFromString("{ not json");
  } catch (e) {
    if (e instanceof ComfyWorkflowJsonSyntaxError) syntaxOk = true;
  }
  if (!syntaxOk) {
    console.error("[workflowhub] Expected ComfyWorkflowJsonSyntaxError");
    process.exit(1);
  }

  let shapeOk = false;
  try {
    parseComfyWorkflowNodeTypesFromString("{}");
  } catch (e) {
    if (e instanceof ComfyWorkflowShapeError) shapeOk = true;
  }
  if (!shapeOk) {
    console.error("[workflowhub] Expected ComfyWorkflowShapeError for {}");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.log(
      "[workflowhub] comfy parse smoke OK (parse only; skip DB without DATABASE_URL)"
    );
    return;
  }

  const prisma = new PrismaClient();
  const suffix = `${Date.now()}`;
  const wfSlug = `workflowhub_comfy_parse_${suffix}`;

  try {
    const wf = await prisma.workflow.create({
      data: {
        slug: wfSlug,
        title: "comfy parse smoke",
        description: "smoke",
        status: "draft",
        baseModel: "SDXL",
        comfyVersion: "1.0",
        authorDisplayName: "smoke",
      },
    });

    await prisma.workflowNode.createMany({
      data: [
        {
          workflowId: wf.id,
          nodeType: "AdminOnly",
          sortOrder: 0,
          source: "admin",
        },
      ],
    });

    await replaceDerivedWorkflowNodes(prisma, wf.id, apiTypes);

    const rows = await prisma.workflowNode.findMany({
      where: { workflowId: wf.id },
      orderBy: { sortOrder: "asc" },
    });

    const derived = rows.filter((r) => r.source === "derived");
    const admin = rows.filter((r) => r.source === "admin");
    assertEqual(
      "derived node types after JSON replace",
      derived.map((r) => r.nodeType),
      ["CheckpointLoaderSimple", "KSampler"]
    );
    assertEqual(
      "admin overrides cleared after JSON replace (PRD §5.2)",
      admin.map((r) => r.nodeType),
      []
    );
  } finally {
    await prisma.workflow
      .delete({ where: { slug: wfSlug } })
      .catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log("[workflowhub] comfy parse smoke OK (parse + DB)");
}

main().catch((err) => {
  console.error("[workflowhub] comfy parse smoke failed:", err);
  process.exit(1);
});
