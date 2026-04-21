import { redirect } from "next/navigation";

export default function OralPresentationPage() {
  redirect("/presentations?tab=oral");
}
