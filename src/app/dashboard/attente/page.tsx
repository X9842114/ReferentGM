import { redirect } from "next/navigation";

/** Les comptes en attente sont gérés par AccountGate — page de secours. */
export default function AttentePage() {
  redirect("/dashboard");
}
