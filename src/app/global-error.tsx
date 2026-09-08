"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="max-w-md text-center">
          <p className="text-xs tracking-[0.18em] text-teal-300 uppercase">
            Critical failure
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            The application could not start
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            {error.message || "An unexpected root-level error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-teal-300 px-4 py-2 text-sm font-medium text-slate-950"
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
