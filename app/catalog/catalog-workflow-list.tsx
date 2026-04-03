"use client";

import type { Dispatch, SetStateAction } from "react";
import type { PublicWorkflowListResponse } from "./types";
import { CatalogWorkflowRow } from "./catalog-workflow-row";

export type CatalogWorkflowListProps = {
  error: string | null;
  loading: boolean;
  data: PublicWorkflowListResponse | null;
  page: number;
  totalPages: number;
  setPage: Dispatch<SetStateAction<number>>;
};

export function CatalogWorkflowList({
  error,
  loading,
  data,
  page,
  totalPages,
  setPage,
}: CatalogWorkflowListProps) {
  return (
    <>
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
              <CatalogWorkflowRow key={w.id} w={w} />
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
    </>
  );
}
