import { DocumentDetail, issueActions } from "@/components/warehouse/document-pages";
import { issueStatusOptions } from "@/lib/inventory/catalog";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DocumentDetail
      resource="issues"
      id={id}
      permission="inventory:read"
      titleKey="issueNumber"
      statusOptions={issueStatusOptions}
      actions={issueActions}
      auditResource="stockIssues"
    />
  );
}
