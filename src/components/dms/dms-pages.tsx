"use client";

import { useState } from "react";
import { DmsList } from "@/components/dms/dms-list";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  documentStatusOptions,
  documentTypeOptions,
  dcrStatusOptions,
  externalStatusOptions,
  labelFor,
  workflowTone,
} from "@/lib/dms/catalog";

function StatusCell({ value, options }: { value: unknown; options: Array<{ label: string; value: string }> }) {
  const status = String(value || "");
  return <StatusBadge label={labelFor(options, status)} tone={workflowTone(status)} />;
}

export function DocumentRegistryPage() {
  const [status, setStatus] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [review, setReview] = useState("");
  return (
    <DmsList
      title="Document registry"
      description="Controlled documents with the current working status and the effective version, when one exists."
      resource="documents"
      permission="dmsDocument:read"
      createHref="/dms/documents/new"
      createLabel="New document"
      exportColumns={["documentNumber", "title", "documentType", "status", "currentVersionLabel", "effectiveVersionLabel", "ownerId", "nextReviewDate"]}
      filterValues={{
        status: status === "all" ? "" : status,
        documentType: documentType === "all" ? "" : documentType,
        review,
      }}
      filters={
        <>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="min-h-11 md:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {documentStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger className="min-h-11 md:w-52">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {documentTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={review || "any"} onValueChange={(value) => setReview(value === "any" ? "" : value)}>
            <SelectTrigger className="min-h-11 md:w-44">
              <SelectValue placeholder="Review" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any review date</SelectItem>
              <SelectItem value="due">Due or overdue</SelectItem>
              <SelectItem value="overdue">Overdue only</SelectItem>
              <SelectItem value="due_soon">Due soon</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
      columns={[
        { key: "documentNumber", header: "Number" },
        { key: "title", header: "Title" },
        { key: "documentType", header: "Type", hideOnMobile: true },
        {
          key: "status",
          header: "Working status",
          cell: (row) => <StatusCell value={row.status} options={documentStatusOptions} />,
        },
        { key: "effectiveVersionLabel", header: "Effective", hideOnMobile: true },
        { key: "nextReviewDate", header: "Next review", hideOnMobile: true },
      ]}
      rowHref={(row) => `/dms/documents/${row.id}`}
    />
  );
}

export function ChangeRequestListPage() {
  const [status, setStatus] = useState("all");
  return (
    <DmsList
      title="Document change requests"
      description="Requests to create, revise, withdraw, or retire a controlled document. Approving a request does not close the linked change control."
      resource="changeRequests"
      permission="dmsChangeRequest:read"
      createHref="/dms/change-requests/new"
      createLabel="New request"
      exportColumns={["requestNumber", "title", "requestType", "status", "documentId", "changeControlId"]}
      filterValues={{ status: status === "all" ? "" : status }}
      filters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="min-h-11 md:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {dcrStatusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      columns={[
        { key: "requestNumber", header: "Number" },
        { key: "title", header: "Title" },
        { key: "requestType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusCell value={row.status} options={dcrStatusOptions} /> },
      ]}
      rowHref={(row) => `/dms/change-requests/${row.id}`}
    />
  );
}

export function ExternalDocumentListPage() {
  return (
    <DmsList
      title="External documents"
      description="Vendor certificates and external regulatory documents with expiry reminders."
      resource="externalDocuments"
      permission="dmsExternal:read"
      createHref="/dms/external/new"
      createLabel="Register external document"
      exportColumns={["externalNumber", "title", "issuer", "expiryDate", "status"]}
      columns={[
        { key: "externalNumber", header: "Number" },
        { key: "title", header: "Title" },
        { key: "issuer", header: "Issuer", hideOnMobile: true },
        { key: "expiryDate", header: "Expiry" },
        { key: "status", header: "Status", cell: (row) => <StatusCell value={row.status} options={externalStatusOptions} /> },
      ]}
      rowHref={(row) => `/dms/external/${row.id}`}
    />
  );
}

export function PeriodicReviewListPage() {
  return (
    <DmsList
      title="Periodic reviews"
      description="Completed reviews. Due and overdue documents are highlighted on the registry."
      resource="periodicReviews"
      permission="dmsPeriodicReview:read"
      exportColumns={["reviewNumber", "documentNumber", "decision", "nextReviewDate", "status"]}
      columns={[
        { key: "reviewNumber", header: "Review" },
        { key: "documentNumber", header: "Document" },
        { key: "decision", header: "Decision" },
        { key: "nextReviewDate", header: "Next review", hideOnMobile: true },
      ]}
      rowHref={(row) => `/dms/documents/${String(row.documentId || "")}`}
    />
  );
}

export function TemplateListPage() {
  return (
    <DmsList
      title="Numbering templates"
      description="Prefixes and review intervals by document type. Numbers are still issued by the server-side series."
      resource="templates"
      permission="dmsNumbering:read"
      createHref="/dms/templates/new"
      createLabel="New template"
      exportColumns={["prefix", "label", "documentType", "reviewIntervalDays", "status"]}
      columns={[
        { key: "prefix", header: "Prefix" },
        { key: "label", header: "Label" },
        { key: "documentType", header: "Type", hideOnMobile: true },
        { key: "reviewIntervalDays", header: "Review days", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/dms/templates"}
    />
  );
}

export function DmsAuditListPage() {
  return (
    <DmsList
      title="Document control audit"
      description="Module copy of document actions. The central audit trail remains the system of record."
      resource="audit"
      permission="dmsAudit:read"
      exportColumns={["action", "resourceId", "description", "actorEmail", "createdAt"]}
      columns={[
        { key: "action", header: "Action" },
        { key: "description", header: "Description" },
        { key: "actorEmail", header: "Actor", hideOnMobile: true },
        { key: "createdAt", header: "When", hideOnMobile: true },
      ]}
      rowHref={() => "/dms/audit"}
    />
  );
}

export function TrainingImpactListPage() {
  const [departmentId, setDepartmentId] = useState("");
  return (
    <DmsList
      title="SOP training impact"
      description="Effective documents flagged for retraining. Completion is recorded in the LMS, not by opening the file."
      resource="documents"
      permission="dmsDocument:read"
      exportColumns={["documentNumber", "title", "effectiveVersionLabel", "trainingImpactStatus", "trainingCourseId"]}
      filterValues={{ status: "effective", departmentId }}
      filters={
        <Input
          className="min-h-11 md:w-52"
          placeholder="Department ID"
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
        />
      }
      columns={[
        { key: "documentNumber", header: "Number" },
        { key: "title", header: "Title" },
        { key: "effectiveVersionLabel", header: "Effective version", hideOnMobile: true },
        { key: "trainingImpactStatus", header: "Training impact" },
      ]}
      rowHref={(row) => `/dms/documents/${row.id}`}
    />
  );
}
