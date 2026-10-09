import { HrApprovalsPage } from "@/components/hr/approvals-page";

export default function Page() {
  return <HrApprovalsPage filterType="payroll" permission="hrPayroll:approve" />;
}
