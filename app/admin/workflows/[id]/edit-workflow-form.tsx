"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminNav } from "@/app/admin/admin-nav";
import type { SerializedAdminWorkflow } from "@/lib/admin/workflow-crud";

type Props = { initial: SerializedAdminWorkflow };

export function EditWorkflowForm({ initial }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const defaultTagLine = useMemo(
    () => initial.tags.map((t) => t.slug).join(", "),
    [initial.tags]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const tagSlugsRaw = String(fd.get("tagSlugs") ?? "").trim();
    const tagSlugs = tagSlugsRaw
      ? tagSlugsRaw.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
      : [];

    const body = {
      title: String(fd.get("title") ?? "").trim(),
      slug: String(fd.get("slug") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim(),
      status: String(fd.get("status") ?? "draft"),
      baseModel: String(fd.get("baseModel") ?? "").trim(),
      comfyVersion: String(fd.get("comfyVersion") ?? "").trim(),
      authorDisplayName: String(fd.get("authorDisplayName") ?? "").trim(),
      tagSlugs,
    };

    setPending(true);
    try {
      const res = await fetch(`/api/admin/workflows/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        field?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      router.refresh();
      router.push("/admin");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <AdminNav />
      <h1 className="text-2xl font-semibold tracking-tight">Edit workflow</h1>
      <p className="mt-1 font-mono text-xs text-neutral-500">{initial.id}</p>

      {!initial.hasWorkflowFile ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          No workflow JSON uploaded yet. Publishing is allowed for metadata
          testing; TASK-019 will require a valid file before publish.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Title
          </span>
          <input
            name="title"
            required
            defaultValue={initial.title}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Slug
          </span>
          <input
            name="slug"
            required
            defaultValue={initial.slug}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Description
          </span>
          <textarea
            name="description"
            required
            rows={4}
            defaultValue={initial.description}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Status
          </span>
          <select
            name="status"
            required
            defaultValue={initial.status}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Base model
          </span>
          <input
            name="baseModel"
            required
            defaultValue={initial.baseModel}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            ComfyUI version
          </span>
          <input
            name="comfyVersion"
            required
            defaultValue={initial.comfyVersion}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Author display name
          </span>
          <input
            name="authorDisplayName"
            required
            defaultValue={initial.authorDisplayName}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Tags (comma-separated slugs)
          </span>
          <input
            name="tagSlugs"
            key={defaultTagLine}
            defaultValue={defaultTagLine}
            placeholder="portrait, flux"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        {initial.publishedAt ? (
          <p className="text-xs text-neutral-500">
            First published: {new Date(initial.publishedAt).toLocaleString()}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
          >
            Back to list
          </Link>
        </div>
      </form>
    </main>
  );
}
