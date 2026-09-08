"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Application error
        </p>
        <h1 className="mt-2 font-heading text-2xl font-semibold">
          Something interrupted this workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The screen failed to render. Retry the view or return to the command
          center. No manufacturing data was changed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Retry</Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            Go to command center
          </Button>
        </div>
      </div>
    </div>
  );
}
