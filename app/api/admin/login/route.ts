import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, adminSessionToken } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (typeof password !== "string" || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, adminSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ success: true });
}
