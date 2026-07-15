import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/app/_components/site-header";

export const metadata: Metadata = {
  title: "CreatorJobs — Marketplace Console",
  description: "Whop-powered marketplace prototype: orders, sellers, webhook log.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col gap-6">
          <SiteHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
