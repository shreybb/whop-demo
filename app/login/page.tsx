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
          Sign in — or create an account below. New here? You&apos;ll pick your
          role right after.
        </p>
      </div>
      <LoginForm next={searchParams.next} />
    </main>
  );
}
