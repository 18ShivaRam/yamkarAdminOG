import React from 'react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-gray-300 border-t-[#006DA8]',
          sizeClasses[size]
        )}
      />
      {text && (
        <p className="text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  text?: string
  className?: string
  children: React.ReactNode
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  text = 'Loading...',
  className,
  children
}) => {
  return (
    <div className={cn('relative', className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <LoadingSpinner size="lg" text={text} />
        </div>
      )}
    </div>
  )
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean
  loadingText?: string
  children: React.ReactNode
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  isLoading,
  loadingText,
  children,
  disabled,
  className,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200',
        className
      )}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      {isLoading ? (loadingText || 'Loading...') : children}
    </button>
  )
}
