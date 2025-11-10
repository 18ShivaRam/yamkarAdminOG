"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')
  
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // Validate passwords
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!token) {
      setError("Invalid reset token. Please request a new password reset.")
      return
    }

    setIsLoading(true)

    try {
      // Decode and validate the token
      const decodedToken = JSON.parse(atob(token))
      const { userId, exp } = decodedToken
      
      // Check if token is expired
      if (exp && Date.now() > exp * 1000) {
        setError("Reset token has expired. Please request a new password reset.")
        return
      }

      // First, sign in the user temporarily to update their password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: decodedToken.email,
        password: 'temp' // This will fail, but we need to handle password reset differently
      });

      // Since we can't sign in without the old password, we need to use Supabase's password reset flow
      // For now, let's create a new API endpoint to handle this properly
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: token,
          newPassword: newPassword 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.log("Password update error:", result)
        setError(result.message || "Failed to reset password. Please try again.")
      } else {
        console.log("Password updated successfully:", result)
        setSuccess("Your password has been updated successfully!")
        setNewPassword("")
        setConfirmPassword("")
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/")
        }, 3000)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Invalid reset token. Please request a new password reset.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f0f4ff] to-[#F8F8FF] p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-28 w-72 relative transform hover:scale-105 transition-transform duration-300">
            <Image
              src="/images/V Cards yamkar logo_page-0001.jpg"
              alt="Yamkar Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
              className="drop-shadow-lg"
            />
          </div>
          <p className="text-[#006DA8] text-base font-medium tracking-wide">Employee Management System</p>
        </div>

        <div className="bg-white/95 backdrop-blur-sm p-8 rounded-xl shadow-lg border border-gray-100">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h1>
            <p className="text-gray-600">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="border-gray-200 focus:border-[#228B22] focus:ring-[#228B22] transition-colors duration-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="border-gray-200 focus:border-[#228B22] focus:ring-[#228B22] transition-colors duration-200 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#006DA8] hover:bg-[#006DA8] text-white font-bold transition-colors duration-200 py-5"
              disabled={isLoading}
            >
              {isLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div className="text-center">
              <button
                onClick={() => router.push("/")}
                className="text-[#006DA8] hover:text-[#F8821E] transition-colors duration-200 text-sm hover:underline"
              >
                ← Back to Login
              </button>
            </div>

            <div className="text-center text-sm text-gray-400">
              © {new Date().getFullYear()} Yamkar. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}