import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAuth } from "@/lib/supabase-server";

/** POST-only sign-out (GET would make sign-out prefetchable/CSRF-able). */
export async function POST(req: NextRequest): Promise<Response> {
  const { error } = await getSupabaseAuth().auth.signOut();
  if (error) console.error("[auth] signOut failed:", error.message);
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
