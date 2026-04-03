import { MAX_TAG_PARAMS, MAX_TAG_VALUE_LEN } from "./constants";
import type { TagChip } from "./types";

export function tagKey(s: string): string {
  return s.trim().toLowerCase();
}

/** Unique needles for `tag=` query (case-insensitive dedupe, first wins). */
export function uniqTagNeedlesForQuery(chips: TagChip[], draft: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chips) {
    const t = c.needle.trim();
    if (!t) continue;
    const k = tagKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  const d = draft.trim();
  if (d) {
    const k = tagKey(d);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(d);
    }
  }
  return out;
}

export function tryAddChipToList(
  chips: TagChip[],
  needle: string,
  label?: string
): TagChip[] | null {
  const t = needle.trim();
  if (t.length === 0 || t.length > MAX_TAG_VALUE_LEN) return null;
  const k = tagKey(t);
  if (chips.some((c) => tagKey(c.needle) === k)) return null;
  const next = [...chips, { needle: t, label }];
  if (uniqTagNeedlesForQuery(next, "").length > MAX_TAG_PARAMS) return null;
  return next;
}
