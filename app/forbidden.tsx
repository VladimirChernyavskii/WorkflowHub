export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        You do not have permission to view this page.
      </p>
    </main>
  );
}
