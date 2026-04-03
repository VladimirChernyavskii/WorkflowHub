"use client";

import { useEffect, useState } from "react";
import { parseApiError } from "./api-error";
import type { CatalogSuggestionApiKind, SuggestionItem } from "./types";

export function useCatalogSuggestions(
  debouncedQ: string,
  kind: CatalogSuggestionApiKind
) {
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [sLoading, setSLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  useEffect(() => {
    if (debouncedQ.length === 0) {
      setItems([]);
      setHighlight(-1);
      return;
    }
    let cancelled = false;
    setSLoading(true);
    const sp = new URLSearchParams();
    sp.set("kind", kind);
    sp.set("q", debouncedQ);
    fetch(`/api/catalog/suggestions?${sp.toString()}`)
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok) {
          throw new Error(parseApiError(body, res.status));
        }
        return body as { suggestions: SuggestionItem[] };
      })
      .then((json) => {
        if (!cancelled) {
          setItems(json.suggestions ?? []);
          setHighlight(-1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setHighlight(-1);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, kind]);

  return { items, sLoading, highlight, setHighlight };
}
