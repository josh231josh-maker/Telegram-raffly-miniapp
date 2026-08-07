import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function POST() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
  return NextResponse.json({ success: true });
}
