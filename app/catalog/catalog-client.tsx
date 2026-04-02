"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

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
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              Tag slugs
            </span>
            <input
              type="text"
              value={tagSlugsInput}
              onChange={(e) => {
                setTagSlugsInput(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. portrait, upscaling (comma or space)"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              Base model
            </span>
            <input
              type="text"
              value={baseModel}
              onChange={(e) => {
                setBaseModel(e.target.value);
                setPage(1);
              }}
              placeholder="Exact match"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-900 dark:text-neutral-100">
              ComfyUI version
            </span>
            <input
              type="text"
              value={comfyVersion}
              onChange={(e) => {
                setComfyVersion(e.target.value);
                setPage(1);
              }}
              placeholder="Exact match"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </label>
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
