/**
 * AuthGuard — Protected Route Wrapper
 * ────────────────────────────────────
 * Shows a full-page spinner while auth state loads.
 * Redirects to '/' if not authenticated.
 * Renders children if authenticated.
 *
 * @see frontend-engineer.md §5
 */
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Spinner from './ui/Spinner'

const AuthGuard = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth()

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-3xl">🌱</span>
                </div>
                <Spinner size="lg" label="Loading your farm data..." />
                <p className="text-sm text-slate-500 font-medium animate-pulse">Loading your farm data...</p>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />
    }

    return children
}

export default AuthGuard
