"use client"

import { supabase } from './supabaseClient'

// Enhanced fetch wrapper with session handling and loading states
export interface ApiRequestOptions extends RequestInit {
  showLoading?: boolean
  loadingText?: string
  retryOnAuthError?: boolean
  onLoadingStart?: () => void
  onLoadingEnd?: () => void
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  success: boolean
  status: number
}

class ApiInterceptor {
  private static instance: ApiInterceptor
  private loadingCount = 0
  private globalLoadingCallbacks: {
    onStart?: () => void
    onEnd?: () => void
  } = {}

  static getInstance(): ApiInterceptor {
    if (!ApiInterceptor.instance) {
      ApiInterceptor.instance = new ApiInterceptor()
    }
    return ApiInterceptor.instance
  }

  setGlobalLoadingCallbacks(callbacks: { onStart?: () => void; onEnd?: () => void }) {
    this.globalLoadingCallbacks = callbacks
  }

  private startLoading() {
    this.loadingCount++
    if (this.loadingCount === 1 && this.globalLoadingCallbacks.onStart) {
      this.globalLoadingCallbacks.onStart()
    }
  }

  private endLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1)
    if (this.loadingCount === 0 && this.globalLoadingCallbacks.onEnd) {
      this.globalLoadingCallbacks.onEnd()
    }
  }

  async request<T = any>(
    url: string, 
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      showLoading = true,
      loadingText = 'Loading...',
      retryOnAuthError = true,
      onLoadingStart,
      onLoadingEnd,
      ...fetchOptions
    } = options

    // Start loading indicators
    if (showLoading) {
      this.startLoading()
      onLoadingStart?.()
    }

    try {
      // Get current session and validate it
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        throw new Error('Authentication error. Please log in again.')
      }

      // Add authorization header if session exists
      const headers = new Headers(fetchOptions.headers)
      if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`)
      }
      headers.set('Content-Type', 'application/json')

      // Make the request
      const response = await fetch(url, {
        ...fetchOptions,
        headers
      })

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        console.log('Authentication error detected, attempting token refresh...')
        
        if (retryOnAuthError) {
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError || !refreshData.session) {
            console.error('Token refresh failed:', refreshError)
            // Force logout and redirect to login
            await supabase.auth.signOut()
            if (typeof window !== 'undefined') {
              window.location.href = '/'
            }
            throw new Error('Session expired. Please log in again.')
          }

          // Retry the request with new token
          const newHeaders = new Headers(fetchOptions.headers)
          newHeaders.set('Authorization', `Bearer ${refreshData.session.access_token}`)
          newHeaders.set('Content-Type', 'application/json')

          const retryResponse = await fetch(url, {
            ...fetchOptions,
            headers: newHeaders
          })

          if (!retryResponse.ok) {
            const errorData = await retryResponse.json().catch(() => ({}))
            throw new Error(errorData.message || `HTTP ${retryResponse.status}: ${retryResponse.statusText}`)
          }

          const retryData = await retryResponse.json()
          return {
            data: retryData.data || retryData,
            success: true,
            status: retryResponse.status
          }
        } else {
          throw new Error('Authentication required. Please log in again.')
        }
      }

      // Handle other HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      // Parse successful response
      const data = await response.json()
      return {
        data: data.data || data,
        success: true,
        status: response.status
      }

    } catch (error) {
      console.error('API request failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      
      return {
        error: errorMessage,
        success: false,
        status: 500
      }
    } finally {
      // End loading indicators
      if (showLoading) {
        this.endLoading()
        onLoadingEnd?.()
      }
    }
  }

  // Convenience methods for different HTTP verbs
  async get<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' })
  }

  async post<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async put<T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    })
  }

  async delete<T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' })
  }
}

// Export singleton instance
export const apiClient = ApiInterceptor.getInstance()

// Enhanced useFetch hook that uses the API interceptor
export function useApiRequest() {
  return {
    get: apiClient.get.bind(apiClient),
    post: apiClient.post.bind(apiClient),
    put: apiClient.put.bind(apiClient),
    delete: apiClient.delete.bind(apiClient),
    request: apiClient.request.bind(apiClient)
  }
}
