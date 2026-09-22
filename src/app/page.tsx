import { redirect } from "next/navigation";

/** Une seule redirection, sans auth() ici (le layout dashboard gère la session). */
export default function Home() {
  redirect("/dashboard");
}
