import { AdvisorApprovalClient } from "./advisor-approval-client";
import { getAdvisorApprovalPageData } from "@/server/public-token-data";

export default async function AdvisorApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getAdvisorApprovalPageData(token);

  return (
    <AdvisorApprovalClient
      token={token}
      initialSubmission={data.submission}
      initialFiles={data.files}
      initialAlreadyResponded={data.alreadyResponded}
      initialResponseMessage={data.responseMessage}
      initialError={data.error}
    />
  );
}
