import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in — CreatorJobs" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">CreatorJobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with a magic link — no password. Works for buyers and sellers
          alike; new here, you&apos;ll pick your role right after.
        </p>
      </div>
      {searchParams.error === "auth" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          That link expired or was already used. Request a fresh one below.
        </p>
      )}
      <LoginForm next={searchParams.next} />
    </main>
  );
}
