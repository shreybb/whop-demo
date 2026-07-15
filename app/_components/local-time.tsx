"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the VIEWER's timezone. Server components format in
 * the server's zone (UTC on Vercel), so this formats after hydration in the
 * browser instead — blank during SSR, which avoids hydration mismatches.
 */
export function LocalTime({ iso }: { iso: string | null | undefined }) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!iso) return setText("—");
    const d = new Date(iso);
    setText(
      Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
    );
  }, [iso]);
  return <time dateTime={iso ?? undefined}>{text}</time>;
}
