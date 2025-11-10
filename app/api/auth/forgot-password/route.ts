import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendPasswordResetEmail } from "@/lib/emailService";

export async function POST(request: Request) {
  try {
    console.log("Forgot password API called");

    const body = await request.json();
    console.log("Request body:", body);

    const { email } = body;

    // Validate email input
    if (!email || typeof email !== "string") {
      console.log("Invalid email input:", email);
      return NextResponse.json({
        message: "Please enter a valid registered email to reset the password"
      }, { status: 400 });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("Invalid email format:", email);
      return NextResponse.json({
        message: "Please enter a valid email address"
      }, { status: 400 });
    }

    console.log("Checking if email exists in database:", email);

    // Check if user exists in the database
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, name, phone")
      .eq("email", email)
      .single();

    console.log("Database query result:", { user, error });

    if (error) {
      console.log("Database error:", error);
      if (error.code === 'PGRST116') {
        // No rows returned - user doesn't exist
        return NextResponse.json({
          message: "Please enter a valid registered email to reset the password"
        }, { status: 400 });
      }
      return NextResponse.json({
        message: "Database error occurred. Please try again later."
      }, { status: 500 });
    }

    if (!user) {
      console.log("No user found with email:", email);
      return NextResponse.json({
        message: "Please enter a valid registered email to reset the password"
      }, { status: 400 });
    }

    console.log("User found:", { id: user.id, email: user.email, name: user.name, phone: user.phone });

    if (!user.id) {
      console.log("No Supabase Auth ID found for user");
      return NextResponse.json({
        message: "User account not properly configured. Please contact support."
      }, { status: 400 });
    }

    // Generate a secure reset token
    const expiryHours = parseInt(process.env.RESET_TOKEN_EXPIRY_HOURS || '1');
    const resetToken = btoa(JSON.stringify({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * expiryHours) // Configurable expiration
    }));

    const baseUrl = process.env.RESET_PASSWORD_URL || process.env.BASE_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3001';
    const resetUrl = `${baseUrl}${baseUrl.includes('/reset-password') ? '' : '/reset-password'}?token=${resetToken}`;

    console.log(`Generated reset URL: ${resetUrl}`);

    // Send password reset email using SMTP
    console.log(`Sending password reset email to: ${email}`);
    
    const emailSent = await sendPasswordResetEmail(email, user.name || 'User', resetUrl);
    
    if (!emailSent) {
      console.error('Failed to send password reset email');
      return NextResponse.json({
        message: "Failed to send reset email. Please try again later or contact support."
      }, { status: 500 });
    }
    
    console.log(`Password reset email sent successfully to: ${email}`);

    return NextResponse.json({
      message: "If this email is registered, a password reset link has been sent."
    }, { status: 200 });

  } catch (err) {
    console.error("Unexpected error in forgot password API:", err);
    return NextResponse.json({
      message: "Something went wrong. Please try again later."
    }, { status: 500 });
  }
}