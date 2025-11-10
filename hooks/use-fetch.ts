"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { apiClient } from "@/lib/api-interceptor"
import type { ApiResponse } from "@/types"

interface UseFetchOptions<T> {
  url: string
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: any
  onSuccess?: (data: T) => void
  onError?: (error: string) => void
  showLoading?: boolean
  loadingText?: string
  retryOnAuthError?: boolean
}

export function useFetch<T>({
  url,
  method = "GET",
  body,
  onSuccess,
  onError,
  showLoading = false, // Don't show global loading by default for useFetch
  loadingText,
  retryOnAuthError = true
}: UseFetchOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.request<T>(url, {
        method,
        body,
        showLoading,
        loadingText,
        retryOnAuthError,
        onLoadingStart: () => setIsLoading(true),
        onLoadingEnd: () => setIsLoading(false)
      })

      if (!response.success) {
        throw new Error(response.error || "Something went wrong")
      }

      if (response.data) {
        setData(response.data)
        onSuccess?.(response.data)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message)
      onError?.(message)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [url, method, body, showLoading, loadingText, retryOnAuthError, onSuccess, onError, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Return refetch function for manual triggering
  return { data, error, isLoading, refetch: fetchData }
}

// Enhanced hook for manual API calls
export function useApiCall() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const callApi = useCallback(async <T>(
    url: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: any
      showLoading?: boolean
      loadingText?: string
      retryOnAuthError?: boolean
      showErrorToast?: boolean
    } = {}
  ): Promise<T | null> => {
    const {
      method = "GET",
      body,
      showLoading = true,
      loadingText,
      retryOnAuthError = true,
      showErrorToast = true
    } = options

    try {
      setIsLoading(true)
      setError(null)

      const response = await apiClient.request<T>(url, {
        method,
        body,
        showLoading,
        loadingText,
        retryOnAuthError
      })

      if (!response.success) {
        throw new Error(response.error || "Something went wrong")
      }

      return response.data || null
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message)
      
      if (showErrorToast) {
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        })
      }
      
      return null
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  return { callApi, isLoading, error }
}

