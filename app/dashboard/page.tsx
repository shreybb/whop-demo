import { redirect } from "next/navigation";

/** Legacy path: the admin console moved to /admin. */
export default function LegacyDashboard() {
  redirect("/admin");
}
