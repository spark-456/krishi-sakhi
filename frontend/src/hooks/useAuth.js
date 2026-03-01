/**
 * useAuth Hook
 * ────────────
 * Wraps Supabase auth session state. Provides reactive auth status
 * across the app without prop drilling.
 *
 * session === undefined → still loading
 * session === null      → logged out
 * session === object    → logged in
 *
 * @see frontend-engineer.md §4
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
    const [session, setSession] = useState(undefined) // undefined = loading

    useEffect(() => {
        // 1. Get current session on mount
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
        })

        // 2. Listen for auth state changes (sign in, sign out, token refresh)
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setSession(null)
    }

    return {
        session,
        user: session?.user ?? null,
        isLoading: session === undefined,
        isAuthenticated: Boolean(session),
        signOut,
    }
}
