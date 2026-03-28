import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/server/auth-helpers";
import { getTrackTeamPageData } from "@/server/track-team-data";
import { TrackTeamClient } from "./track-team-client";

export default async function TrackTeamPage() {
  const authContext = await getServerAuthContext();

  if (!authContext?.user.isActive) {
    redirect("/login");
  }

  const data = await getTrackTeamPageData(authContext.user);

  return (
    <TrackTeamClient
      initialTracks={data.tracks}
      initialSelectedTrack={data.selectedTrackId}
      initialMembers={data.members}
      initialAvailable={data.available}
    />
  );
}
