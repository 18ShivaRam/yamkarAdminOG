"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

export default function ForgotPasswordPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.message || "Please enter a valid registered email to reset the password")
      } else {
        setSuccess("If this email is registered, a password reset link has been sent.")
        setEmail("")
      }
    } catch (err) {
      setError("Something went wrong. Please try again later.")
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h1>
            <p className="text-gray-600">Enter your registered email to reset your password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="border-gray-200 focus:border-[#228B22] focus:ring-[#228B22] transition-colors duration-200"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#006DA8] hover:bg-[#006DA8] text-white font-bold transition-colors duration-200 py-5"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
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

            <div className="text-center">
              <a href="/signup" className="text-[#006DA8] hover:text-[#F8821E] transition-colors duration-200 text-sm hover:underline">
                Create Account
              </a>
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
