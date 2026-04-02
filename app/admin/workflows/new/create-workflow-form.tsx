"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminNav } from "@/app/admin/admin-nav";

export function CreateWorkflowForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const tagSlugsRaw = String(fd.get("tagSlugs") ?? "").trim();
    const tagSlugs = tagSlugsRaw
      ? tagSlugsRaw.split(/[,]+/).map((s) => s.trim()).filter(Boolean)
      : undefined;

    const body = {
      title: String(fd.get("title") ?? "").trim(),
      slug: String(fd.get("slug") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim(),
      status: "draft",
      baseModel: String(fd.get("baseModel") ?? "").trim(),
      comfyVersion: String(fd.get("comfyVersion") ?? "").trim(),
      authorDisplayName: String(fd.get("authorDisplayName") ?? "").trim(),
      ...(tagSlugs && tagSlugs.length > 0 ? { tagSlugs } : {}),
    };

    setPending(true);
    try {
      const res = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.id) {
        router.push(`/admin/workflows/${data.id}`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <AdminNav />
      <h1 className="text-2xl font-semibold tracking-tight">New workflow</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Creates a draft. You can publish after editing from the detail page.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Title
          </span>
          <input
            name="title"
            required
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
            placeholder="my-workflow"
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
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Base model
          </span>
          <input
            name="baseModel"
            required
            placeholder="SDXL"
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
            placeholder="0.3.x"
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
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            Tags (comma-separated slugs)
          </span>
          <input
            name="tagSlugs"
            placeholder="portrait, flux"
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {pending ? "Saving…" : "Create draft"}
          </button>
          <Link
            href="/admin"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 dark:border-neutral-600 dark:text-neutral-200"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
