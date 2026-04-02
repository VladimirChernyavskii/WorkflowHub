"use client";

import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

const FILTER_INPUT_CLASS =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100";

type PublicTag = { id: string; slug: string; name: string };

type PublicWorkflowSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  baseModel: string;
  comfyVersion: string;
  authorDisplayName: string | null;
  uniqueDownloadCount: number;
  averageRating: number;
  reviewCount: number;
  publishedAt: string | null;
  updatedAt: string;
  tags: PublicTag[];
};

type PublicWorkflowListResponse = {
  workflows: PublicWorkflowSummary[];
  page: number;
  pageSize: number;
  total: number;
};

type ApiErrorBody = {
  error?: string;
  issues?: { path: string; message: string }[];
};

type SuggestionKind = "tag" | "base_model" | "comfy_version";

type SuggestionItem = { value: string; label?: string };

/** Prefix + current token after the last comma/whitespace (tag field). */
function tagPrefixAndNeedle(input: string): { prefix: string; needle: string } {
  let j = input.length - 1;
  while (j >= 0 && !/[\s,]/.test(input.charAt(j))) {
    j -= 1;
  }
  const needleStart = j + 1;
  return {
    prefix: input.slice(0, needleStart),
    needle: input.slice(needleStart),
  };
}

type CatalogSuggestionFieldProps = {
  kind: SuggestionKind;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
};

function CatalogSuggestionField({
  kind,
  label,
  placeholder,
  value,
  onChange,
}: CatalogSuggestionFieldProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [sLoading, setSLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const apiNeedle = useMemo(() => {
    if (kind === "tag") {
      return tagPrefixAndNeedle(value).needle.trim();
    }
    return value.trim();
  }, [kind, value]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(apiNeedle), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [apiNeedle]);

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
          const err = body as ApiErrorBody;
          const msg =
            err.issues?.map((i) => `${i.path}: ${i.message}`).join("; ") ||
            err.error ||
            `Request failed (${res.status})`;
          throw new Error(msg);
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

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  const showList =
    open && debouncedQ.length > 0 && (sLoading || items.length > 0);

  function applyPick(item: SuggestionItem) {
    if (kind === "tag") {
      const { prefix } = tagPrefixAndNeedle(value);
      onChange(prefix + item.value);
    } else {
      onChange(item.value);
    }
    setOpen(false);
    setHighlight(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setHighlight(-1);
      return;
    }
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h <= 0 ? items.length - 1 : h - 1));
      return;
    }
    if (e.key === "Enter" && highlight >= 0 && items[highlight]) {
      e.preventDefault();
      applyPick(items[highlight]!);
    }
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
        {label}
      </span>
      <div ref={containerRef} className="relative">
        <input
          type="text"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={showList}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (apiNeedle.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={FILTER_INPUT_CLASS}
        />
        {showList ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white py-1 text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
          >
            {sLoading ? (
              <li className="px-3 py-2 text-neutral-500">Loading…</li>
            ) : (
              items.map((item, i) => (
                <li key={`${item.value}-${i}`} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === highlight}
                    className={`flex w-full flex-col px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                      i === highlight ? "bg-neutral-100 dark:bg-neutral-800" : ""
                    }`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => applyPick(item)}
                  >
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {item.value}
                    </span>
                    {item.label && item.label !== item.value ? (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {item.label}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </label>
  );
}

function buildQuery(params: {
  page: number;
  pageSize: number;
  q: string;
  tagSlugs: string[];
  baseModel: string;
  comfyVersion: string;
  sort: "date" | "rating" | "downloads";
  order: "asc" | "desc";
}): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q.length > 0) {
    sp.set("q", params.q);
  }
  for (const t of params.tagSlugs) {
    sp.append("tag", t);
  }
  const bm = params.baseModel.trim();
  if (bm.length > 0) {
    sp.set("base_model", bm);
  }
  const cv = params.comfyVersion.trim();
  if (cv.length > 0) {
    sp.set("comfy_version", cv);
  }
  sp.set("sort", params.sort);
  sp.set("order", params.order);
  return sp.toString();
}

export function CatalogClient() {
  const [qInput, setQInput] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [tagSlugsInput, setTagSlugsInput] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [comfyVersion, setComfyVersion] = useState("");
  const [sort, setSort] = useState<"date" | "rating" | "downloads">("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PublicWorkflowListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(qInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const tagSlugs = useMemo(
    () =>
      tagSlugsInput
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [tagSlugsInput]
  );

  const queryString = useMemo(
    () =>
      buildQuery({
        page,
        pageSize: PAGE_SIZE,
        q: qDebounced,
        tagSlugs,
        baseModel,
        comfyVersion,
        sort,
        order,
      }),
    [page, qDebounced, tagSlugs, baseModel, comfyVersion, sort, order]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/workflows?${queryString}`)
      .then(async (res) => {
        const body: unknown = await res.json();
        if (!res.ok) {
          const err = body as ApiErrorBody;
          const msg =
            err.issues?.map((i) => `${i.path}: ${i.message}`).join("; ") ||
            err.error ||
            `Request failed (${res.status})`;
          throw new Error(msg);
        }
        return body as PublicWorkflowListResponse;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const totalPages =
    data && data.pageSize > 0
      ? Math.max(1, Math.ceil(data.total / data.pageSize))
      : 1;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <p className="mb-6 text-sm">
        <Link
          href="/"
          className="font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-100"
        >
          Home
        </Link>
      </p>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Published workflows only. Dense list — no thumbnails (PRD §5.1).
        </p>
      </header>

      <section
        className="mb-8 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40"
        aria-label="Search and filters"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              Search
            </span>
            <input
              type="search"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Title or description…"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <CatalogSuggestionField
            kind="tag"
            label="Tag slugs"
            placeholder="e.g. portrait, upscaling (comma or space)"
            value={tagSlugsInput}
            onChange={(next) => {
              setTagSlugsInput(next);
              setPage(1);
            }}
          />
          <CatalogSuggestionField
            kind="base_model"
            label="Base model"
            placeholder="Substring match (case-insensitive)"
            value={baseModel}
            onChange={(next) => {
              setBaseModel(next);
              setPage(1);
            }}
          />
          <CatalogSuggestionField
            kind="comfy_version"
            label="ComfyUI version"
            placeholder="Substring match (case-insensitive)"
            value={comfyVersion}
            onChange={(next) => {
              setComfyVersion(next);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              Sort by
            </span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="date">Date</option>
              <option value="rating">Rating</option>
              <option value="downloads">Downloads</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              Order
            </span>
            <select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value as typeof order);
                setPage(1);
              }}
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Loading…
        </p>
      ) : null}

      {!loading && !error && data ? (
        <>
          <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            {data.total === 0
              ? "No workflows match your filters."
              : `Showing ${data.workflows.length} of ${data.total} (page ${data.page} of ${totalPages})`}
          </p>

          <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg dark:divide-neutral-800 dark:border-neutral-800">
            {data.workflows.map((w) => (
              <li key={w.id} className="px-4 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    <Link
                      href={`/workflows/${w.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {w.title}
                    </Link>
                  </h2>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                    <span>
                      Rating:{" "}
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {w.averageRating.toFixed(2)}
                      </span>{" "}
                      ({w.reviewCount} reviews)
                    </span>
                    <span>
                      Downloads:{" "}
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {w.uniqueDownloadCount}
                      </span>
                    </span>
                  </div>
                </div>
                {w.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-neutral-700 dark:text-neutral-300">
                    {w.description}
                  </p>
                ) : null}
                <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                  <div>
                    <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
                      Base model:{" "}
                    </dt>
                    <dd className="inline">{w.baseModel || "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
                      ComfyUI:{" "}
                    </dt>
                    <dd className="inline">{w.comfyVersion || "—"}</dd>
                  </div>
                  {w.authorDisplayName ? (
                    <div>
                      <dt className="inline font-medium text-neutral-700 dark:text-neutral-300">
                        Author:{" "}
                      </dt>
                      <dd className="inline">{w.authorDisplayName}</dd>
                    </div>
                  ) : null}
                </dl>
                {w.tags.length > 0 ? (
                  <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      Tags:{" "}
                    </span>
                    {w.tags.map((t) => t.name || t.slug).join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav
              className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 pt-6 dark:border-neutral-800"
              aria-label="Pagination"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
