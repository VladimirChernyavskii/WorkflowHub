# ADR 0001: ComfyUI workflow JSON — supported shapes (PRD §14.2)

## Status

Accepted

## Context

ComfyUI can expose workflow graphs in more than one JSON shape. The catalog must extract **unique node type identifiers** for `WorkflowNode` rows with `source = derived`, and reject inputs that are not a recognized workflow.

## Decision

v1 supports **two** shapes, detected in this order:

1. **UI / full workflow export** — JSON object with a `nodes` array. Each element is an object with a string `type` (ComfyUI node class name). Traversal order is **array order**. Duplicate `type` values appear once in output (first occurrence wins).

2. **API / prompt graph** — JSON object whose values are node definitions: plain objects (not arrays) with a string `class_type`. Top-level keys are node ids (typically numeric strings). Traversal order is by **numeric node id ascending**; non-numeric keys sort after numeric ones, lexicographically by key. Duplicate `class_type` values appear once (first in that order wins).

If the root value is not a non-null object, or neither shape applies, parsing fails with a **shape error** (not a JSON syntax error).

JSON syntax errors are reported separately from shape errors so callers can distinguish corrupt bytes from wrong schema.

## Consequences

- New or wrapped export formats require updating the detector and this ADR.
- Production paths should log error **kinds** without echoing full user file contents.
