import Link from "next/link";

import { listWorkflowsForAdmin, serializeAdminWorkflow } from "@/lib/admin/workflow-crud";

import { AdminNav } from "./admin-nav";

export default async function AdminHomePage() {
  const rows = await listWorkflowsForAdmin();
  const workflows = rows.map(serializeAdminWorkflow);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <AdminNav />
      <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Admin catalog: all statuses. Public listing will only show published
        workflows in a later task.
      </p>

      {workflows.length === 0 ? (
        <p className="mt-8 text-neutral-600 dark:text-neutral-400">
          No workflows yet.{" "}
          <Link
            href="/admin/workflows/new"
            className="font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-100"
          >
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {workflows.map((w) => (
                <tr
                  key={w.id}
                  className="border-b border-neutral-100 last:border-0 dark:border-neutral-800/80"
                >
                  <td className="px-4 py-3 text-neutral-900 dark:text-neutral-100">
                    {w.title}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                    {w.slug}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize dark:bg-neutral-800">
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {new Date(w.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/workflows/${w.id}`}
                      className="font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-100"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
