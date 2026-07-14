import { redirect } from "next/navigation";
import { requireUser, roleHome } from "@/lib/auth";
import { RolePicker } from "./role-picker";

export const metadata = { title: "Choose your role — CreatorJobs" };
export const dynamic = "force-dynamic";

export default async function RoleOnboardingPage() {
  const profile = await requireUser();
  // Role is one-time; already-decided users have no business here.
  if (profile.role) redirect(roleHome(profile.role));

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to CreatorJobs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One quick question — are you here to hire, or to get hired? This
          sets up your workspace and can&apos;t be changed later.
        </p>
      </div>
      <RolePicker defaultName={profile.display_name ?? ""} />
    </main>
  );
}
