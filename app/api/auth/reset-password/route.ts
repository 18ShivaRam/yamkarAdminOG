import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    console.log("Reset password API called");
    
    const body = await request.json();
    console.log("Request body:", body);
    
    const { token, newPassword } = body;
    
    // Validate input
    if (!token || typeof token !== "string") {
      console.log("Invalid token:", token);
      return NextResponse.json({ 
        message: "Invalid reset token" 
      }, { status: 400 });
    }
    
    if (!newPassword || typeof newPassword !== "string") {
      console.log("Invalid password input");
      return NextResponse.json({ 
        message: "Please provide a valid password" 
      }, { status: 400 });
    }
    
    if (newPassword.length < 6) {
      console.log("Password too short");
      return NextResponse.json({ 
        message: "Password must be at least 6 characters long" 
      }, { status: 400 });
    }
    
    console.log("Validating reset token:", token);
    
    // TODO: In production, you would:
    // 1. Decode and validate the JWT token
    // 2. Check if the token is expired
    // 3. Get the user ID from the token
    // 4. Update the password in the database
    
    // For now, we'll simulate the token validation
    // In a real implementation, you'd use a library like jsonwebtoken
    
    try {
      // Simulate token validation (replace with actual JWT validation)
      const decodedToken = JSON.parse(atob(token.split('.')[1] || '{}'));
      const userId = decodedToken.userId;
      const expiresAt = decodedToken.exp;
      
      console.log("Decoded token:", { userId, expiresAt });
      
      // Check if token is expired
      if (expiresAt && Date.now() > expiresAt * 1000) {
        console.log("Token expired");
        return NextResponse.json({ 
          message: "Reset token has expired. Please request a new password reset." 
        }, { status: 400 });
      }
      
      if (!userId) {
        console.log("No user ID in token");
        return NextResponse.json({ 
          message: "Invalid reset token" 
        }, { status: 400 });
      }
      
      // Update the user's password in the database
      console.log("Updating password for user:", userId);
      
      const { data, error } = await supabase
        .from("users")
        .update({ password: newPassword })
        .eq("id", userId)
        .select("id, email, name");
      
      console.log("Database update result:", { data, error });
      
      if (error) {
        console.log("Database error:", error);
        return NextResponse.json({ 
          message: "Failed to update password. Please try again." 
        }, { status: 500 });
      }
      
      if (!data || data.length === 0) {
        console.log("No user found with ID:", userId);
        return NextResponse.json({ 
          message: "User not found" 
        }, { status: 400 });
      }
      
      console.log("Password updated successfully for user:", data[0].email);
      
      // TODO: Invalidate the reset token (mark as used)
      
      return NextResponse.json({ 
        message: "Password updated successfully" 
      }, { status: 200 });
      
    } catch (tokenError) {
      console.log("Token validation error:", tokenError);
      return NextResponse.json({ 
        message: "Invalid reset token" 
      }, { status: 400 });
    }
    
  } catch (err) {
    console.error("Unexpected error in reset password API:", err);
    return NextResponse.json({ 
      message: "Something went wrong. Please try again later." 
    }, { status: 500 });
  }
} 
