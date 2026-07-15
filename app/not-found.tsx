"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** App-wide 404: tell the user, then send them home on a 5s countdown. */
export default function NotFound() {
  const [seconds, setSeconds] = useState(5);
  const router = useRouter();

  useEffect(() => {
    if (seconds <= 0) {
      router.push("/");
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, router]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        That page doesn&apos;t exist
      </h1>
      <p className="text-sm text-muted-foreground">
        Taking you back to the marketplace in{" "}
        <span className="font-semibold text-foreground">{seconds}</span>…
      </p>
      <Link
        href="/"
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Go home now
      </Link>
    </main>
  );
}
