import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This needs to be added to your .env
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: Request) {
  try {
    console.log("Update password API called");

    const body = await request.json();
    console.log("Request body:", body);

    const { token, newPassword } = body;

    // Validate input
    if (!token || !newPassword) {
      return NextResponse.json({
        message: "Token and new password are required"
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({
        message: "Password must be at least 6 characters long"
      }, { status: 400 });
    }

    try {
      // Decode and validate the token
      const decodedToken = JSON.parse(atob(token));
      const { userId, email, exp } = decodedToken;
      
      // Check if token is expired
      if (exp && Date.now() > exp * 1000) {
        return NextResponse.json({
          message: "Reset token has expired. Please request a new password reset."
        }, { status: 400 });
      }

      console.log("Updating password for user:", { userId, email });

      // Use Supabase Admin API to update the user's password
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (error) {
        console.error("Supabase Auth error:", error);
        return NextResponse.json({
          message: "Failed to update password. Please try again."
        }, { status: 500 });
      }

      console.log("Password updated successfully for user:", userId);

      return NextResponse.json({
        message: "Password updated successfully",
        success: true
      }, { status: 200 });

    } catch (tokenError) {
      console.error("Token validation error:", tokenError);
      return NextResponse.json({
        message: "Invalid reset token. Please request a new password reset."
      }, { status: 400 });
    }

  } catch (err) {
    console.error("Unexpected error in update password API:", err);
    return NextResponse.json({
      message: "Something went wrong. Please try again later."
    }, { status: 500 });
  }
}
