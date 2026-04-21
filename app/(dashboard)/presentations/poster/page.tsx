import { redirect } from "next/navigation";

export default function PosterPresentationPage() {
  redirect("/presentations?tab=poster");
}
