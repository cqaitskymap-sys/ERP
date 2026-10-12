"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { listArtwork, type ArtworkRow } from "@/lib/artwork/client";
import { artworkDecisionLabel, artworkDecisionTone, artworkStatusLabel, artworkStatusTone } from "@/lib/artwork/status";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ArtworkList({
  title,
  description,
  resource,
  columns,
  createHref,
  rowHref,
  emptyTitle,
}: {
  title: string;
  description: string;
  resource: string;
  columns: DataTableColumn<ArtworkRow>[];
  createHref?: string;
  rowHref?: (row: ArtworkRow) => string;
  emptyTitle: string;
}) {
  return (
    <RequirePermission permission="artwork:read">
      <Inner
        title={title}
        description={description}
        resource={resource}
        columns={columns}
        createHref={createHref}
        rowHref={rowHref}
        emptyTitle={emptyTitle}
      />
    </RequirePermission>
  );
}

function Inner({
  title,
  description,
  resource,
  columns,
  createHref,
  rowHref,
  emptyTitle,
}: {
  title: string;
  description: string;
  resource: string;
  columns: DataTableColumn<ArtworkRow>[];
  createHref?: string;
  rowHref?: (row: ArtworkRow) => string;
  emptyTitle: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ArtworkRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listArtwork(resource, { pageSize: 50 })
        .then((result) => {
          if (!ignore) setRows(result.rows);
        })
        .catch((error) => {
          if (!ignore) toast.error("Unable to load artwork", publicMasterError(error));
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [resource]);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          createHref ? (
            <Button asChild className="min-h-11">
              <Link href={createHref}>
                <Plus className="size-4" />
                New artwork
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyDescription="Jobs appear here as soon as packaging raises them."
        onRowClick={rowHref ? (row) => router.push(rowHref(row)) : undefined}
      />
    </div>
  );
}

export function ArtworkStatusCell({ status }: { status: unknown }) {
  return <StatusBadge label={artworkStatusLabel(status)} tone={artworkStatusTone(status)} />;
}

export function ArtworkDecisionCell({ decision }: { decision: unknown }) {
  return <StatusBadge label={artworkDecisionLabel(decision)} tone={artworkDecisionTone(decision)} />;
}
