import Link from "next/link";

import { isGitHubOAuthConfigured } from "@/lib/auth/github-oauth";
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
  const githubOk = isGitHubOAuthConfigured(env);
  const anyOAuth = googleOk || githubOk;
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
          Continue with Google or GitHub.
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
      {anyOAuth ? (
        <div className="flex flex-col items-center gap-3">
          {googleOk ? (
            <a
              href="/api/auth/google"
              className="rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
            >
              Sign in with Google
            </a>
          ) : null}
          {githubOk ? (
            <a
              href="/api/auth/github"
              className="rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              Sign in with GitHub
            </a>
          ) : null}
        </div>
      ) : (
        <p className="max-w-md text-center text-sm text-neutral-600 dark:text-neutral-400">
          Sign-in is not available on this deployment.
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
