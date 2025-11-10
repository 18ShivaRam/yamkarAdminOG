import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSupabase } from "@/lib/supabaseClient";

// Utility to build a Supabase public client (for token validation and profile checks)
function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase url/anon key not configured");
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

function generateTempPassword(length = 12) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return pwd;
}

export async function POST(request: Request) {
  try {
    if (!adminSupabase) {
      return NextResponse.json({ message: "Server not configured for admin operations" }, { status: 500 });
    }

    // Auth: ensure the caller is an authenticated admin
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const publicClient = getPublicClient();
    const { data: userData, error: userErr } = await publicClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    // Ensure caller has admin role
    const { data: adminProfile, error: profileErr } = await publicClient
      .from("users")
      .select("id, role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId, email, newPassword } = body || {} as { userId?: string; email?: string; newPassword?: string };

    if (!userId && !email) {
      return NextResponse.json({ message: "Provide userId or email" }, { status: 400 });
    }

    let targetUserId = userId as string | undefined;

    // Resolve user id from email if necessary
    if (!targetUserId && email) {
      const { data: targetUser, error: targetErr } = await publicClient
        .from("users")
        .select("id, email")
        .eq("email", email)
        .single();

      if (targetErr || !targetUser?.id) {
        return NextResponse.json({ message: "User with provided email not found" }, { status: 404 });
      }
      targetUserId = targetUser.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ message: "Target user not resolved" }, { status: 400 });
    }

    const tempPassword = newPassword && typeof newPassword === "string" && newPassword.length >= 8
      ? newPassword
      : generateTempPassword(12);

    // Perform admin password update
    const { data: updated, error: updErr } = await adminSupabase.auth.admin.updateUserById(targetUserId, {
      password: tempPassword,
    });

    if (updErr) {
      console.error("Password reset error:", updErr);
      return NextResponse.json({ message: updErr.message || "Failed to reset password" }, { status: 500 });
    }

    // Respond with success; only return the generated password if we generated it (to avoid echoing sensitive user-provided values)
    const response: any = { success: true, userId: targetUserId };
    if (!newPassword) {
      response.tempPassword = tempPassword;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("Unexpected error in admin reset-password:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
