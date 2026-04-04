/**
 * AuthGuard — Protects Routes
 * ───────────────────────────
 * Uses Supabase session via useAuth hook.
 * Shows branded loading screen while checking.
 * Redirects to / if not authenticated.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const AuthGuard = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 gap-4">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                    <span className="text-3xl">🌱</span>
                </div>
                <div className="w-10 h-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading Krishi Sakhi...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
};

export default AuthGuard;
