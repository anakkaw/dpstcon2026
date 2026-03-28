import { ActivateClient } from "./activate-client";
import { getActivatePageData } from "@/server/public-token-data";

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getActivatePageData(token);

  return (
    <ActivateClient
      token={token}
      initialStatus={data.status}
      initialUserName={data.userName}
      initialEmail={data.email}
      initialError={data.errorMsg}
    />
  );
}
