import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">WorkflowHub</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        Next.js scaffold is ready.
      </p>
      <Link
        href="/login"
        className="text-sm font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-100"
      >
        Sign in
      </Link>
    </main>
  );
}
