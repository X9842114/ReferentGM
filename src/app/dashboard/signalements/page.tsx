import { redirect } from "next/navigation";

export default function LegacySignalementsPage() {
  redirect("/dashboard/signaler");
}
