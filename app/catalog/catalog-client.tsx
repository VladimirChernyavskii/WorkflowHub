"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { parseApiError } from "./api-error";
import { buildCatalogQuery } from "./build-catalog-query";
import { CatalogSuggestionField } from "./catalog-suggestion-field";
import { CatalogTagFilter } from "./catalog-tag-filter";
import { CatalogWorkflowList } from "./catalog-workflow-list";
import { DEBOUNCE_MS, PAGE_SIZE } from "./constants";
import type { PublicWorkflowListResponse, TagChip } from "./types";
import { uniqTagNeedlesForQuery } from "./tag-utils";
import { useDebouncedValue } from "./use-debounced-value";

export function CatalogClient() {
  const [qInput, setQInput] = useState("");
  const qDebounced = useDebouncedValue(qInput.trim(), DEBOUNCE_MS);
  const [tagChips, setTagChips] = useState<TagChip[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [comfyVersion, setComfyVersion] = useState("");
  const [sort, setSort] = useState<"date" | "rating" | "downloads">("date");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<PublicWorkflowListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const tagSlugs = useMemo(
    () => uniqTagNeedlesForQuery(tagChips, tagDraft),
    [tagChips, tagDraft]
  );

  const queryString = useMemo(
    () =>
      buildCatalogQuery({
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
          throw new Error(parseApiError(body, res.status));
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
            kind="base_model"
            label="Base model"
            placeholder="Substring match (case-insensitive)"
            value={baseModel}
            onChange={(next) => {
              setBaseModel(next);
              setPage(1);
            }}
          />
          <div className="sm:col-span-2">
            <CatalogTagFilter
              tagChips={tagChips}
              setTagChips={setTagChips}
              tagDraft={tagDraft}
              setTagDraft={setTagDraft}
              onFilterChange={() => setPage(1)}
            />
          </div>
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

      <CatalogWorkflowList
        error={error}
        loading={loading}
        data={data}
        page={page}
        totalPages={totalPages}
        setPage={setPage}
      />
    </div>
  );
}
