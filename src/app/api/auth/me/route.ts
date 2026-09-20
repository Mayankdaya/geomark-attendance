import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

/** GET /api/auth/me — current logged-in user or null */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
