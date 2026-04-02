/**
 * ComfyUI workflow JSON → unique node type ids (derived list).
 * Supported shapes: docs/adr/0001-comfy-workflow-json-formats.md
 */

const SHAPE_MESSAGE =
  "Unrecognized ComfyUI workflow JSON: expected UI export (nodes[].type) or API graph (class_type per node).";

export class ComfyWorkflowJsonSyntaxError extends Error {
  readonly code = "COMFY_JSON_SYNTAX" as const;
  constructor(message = "Invalid JSON.") {
    super(message);
    this.name = "ComfyWorkflowJsonSyntaxError";
  }
}

export class ComfyWorkflowShapeError extends Error {
  readonly code = "COMFY_WORKFLOW_SHAPE" as const;
  constructor(message = SHAPE_MESSAGE) {
    super(message);
    this.name = "ComfyWorkflowShapeError";
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function uniqueInOrder(types: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of types) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** UI export: root.nodes[].type */
function tryExtractFromUi(root: Record<string, unknown>): string[] | null {
  const nodes = root.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return null;
  }
  const ordered: string[] = [];
  for (const n of nodes) {
    if (!isPlainObject(n)) {
      throw new ComfyWorkflowShapeError(
        "Invalid ComfyUI UI workflow: nodes[] entries must be objects."
      );
    }
    const t = n.type;
    if (typeof t !== "string") {
      throw new ComfyWorkflowShapeError(
        "Invalid ComfyUI UI workflow: each node must have a string type."
      );
    }
    ordered.push(t);
  }
  return uniqueInOrder(ordered);
}

type ApiEntry = { key: string; idNum: number | null; type: string };

/** API graph: values are { class_type, inputs, ... } */
function tryExtractFromApi(root: Record<string, unknown>): string[] | null {
  const entries: ApiEntry[] = [];
  for (const [key, v] of Object.entries(root)) {
    if (key === "nodes") continue;
    if (!isPlainObject(v)) continue;
    const classType = v.class_type;
    if (typeof classType !== "string") continue;
    const idNum = Number(key);
    const parsed =
      Number.isFinite(idNum) && String(idNum) === key ? idNum : null;
    entries.push({ key, idNum: parsed, type: classType });
  }
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => {
    if (a.idNum !== null && b.idNum !== null) {
      return a.idNum - b.idNum;
    }
    if (a.idNum !== null) return -1;
    if (b.idNum !== null) return 1;
    return a.key.localeCompare(b.key);
  });
  return uniqueInOrder(entries.map((e) => e.type));
}

/**
 * Parse an already-parsed JSON value into unique node types (order per ADR 0001).
 */
export function extractComfyWorkflowNodeTypes(value: unknown): string[] {
  if (!isPlainObject(value)) {
    throw new ComfyWorkflowShapeError(
      "ComfyUI workflow JSON must be a JSON object at the root."
    );
  }

  const fromUi = tryExtractFromUi(value);
  if (fromUi !== null) {
    return fromUi;
  }

  const fromApi = tryExtractFromApi(value);
  if (fromApi !== null) {
    return fromApi;
  }

  throw new ComfyWorkflowShapeError();
}

export function parseComfyWorkflowNodeTypesFromString(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ComfyWorkflowJsonSyntaxError();
  }
  return extractComfyWorkflowNodeTypes(parsed);
}
