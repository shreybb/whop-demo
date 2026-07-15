import { requireRole } from "@/lib/auth";

/** Seller shell: hard role gate. Header is rendered by the root layout. */
export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("seller");
  return <>{children}</>;
}
