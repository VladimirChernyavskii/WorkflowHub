"use client";

import Link from "next/link";
import type { PublicWorkflowSummary } from "./types";

export function CatalogWorkflowRow({ w }: { w: PublicWorkflowSummary }) {
  return (
    <li className="px-4 py-4">
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
  );
}
