import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-2 font-heading text-3xl font-semibold">
          This route is not on the plant map
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page does not exist yet. Return to the command center or open a
          planned module from the sidebar.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Back to command center</Link>
        </Button>
      </div>
    </div>
  );
}
