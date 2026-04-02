import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
      <Link
        href="/admin"
        className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
      >
        Workflows
      </Link>
      <Link
        href="/admin/workflows/new"
        className="text-sm text-neutral-600 underline underline-offset-4 dark:text-neutral-400"
      >
        New workflow
      </Link>
      <Link
        href="/"
        className="ml-auto text-sm text-neutral-500 dark:text-neutral-500"
      >
        Site home
      </Link>
    </nav>
  );
}
