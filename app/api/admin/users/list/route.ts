import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminSupabase } from "@/lib/supabaseClient";

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Supabase url/anon key not configured");
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Ensure this route is always treated as dynamic since it reads request headers
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    if (!adminSupabase) {
      return NextResponse.json({ message: "Server not configured for admin operations" }, { status: 500 });
    }

    // Validate caller as admin
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

    const { data: adminProfile, error: profileErr } = await publicClient
      .from("users")
      .select("id, role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || !adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Fetch users list using admin client to avoid RLS issues
    const { data, error } = await adminSupabase
      .from("users")
      .select("id, name, email, phone, role")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error listing users:", error);
      return NextResponse.json({ message: "Failed to list users" }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] }, { status: 200 });
  } catch (err) {
    console.error("Unexpected error in admin users list:", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
