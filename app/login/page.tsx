import Link from "next/link";

import { isGoogleOAuthConfigured } from "@/lib/auth/google-oauth";
import { env } from "@/lib/env";

const ERROR_COPY: Record<string, string> = {
  oauth_config:
    "Sign-in is not configured. Ask an administrator or try again later.",
  oauth_state:
    "We could not verify the sign-in request. Please try again.",
  oauth_failed: "Sign-in failed. Please try again.",
};

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const q = await searchParams;
  const googleOk = isGoogleOAuthConfigured(env);
  const err = q.error;
  const errorMessage =
    err && ERROR_COPY[err]
      ? ERROR_COPY[err]
      : err
        ? ERROR_COPY.oauth_failed
        : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          Continue with your Google account.
        </p>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="max-w-md text-center text-sm text-red-600 dark:text-red-400"
        >
          {errorMessage}
        </p>
      ) : null}
      {googleOk ? (
        <a
          href="/api/auth/google"
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
        >
          Sign in with Google
        </a>
      ) : (
        <p className="max-w-md text-center text-sm text-neutral-600 dark:text-neutral-400">
          Google sign-in is not available on this deployment.
        </p>
      )}
      <Link
        href="/"
        className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        Back to home
      </Link>
    </main>
  );
}
