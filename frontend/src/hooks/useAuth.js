/**
 * useAuth Hook
 * ──────────────────────────────────────────────────
 * Provides session, user, loading status, and auth actions.
 *
 * API:
 *   const { user, session, isLoading, isAuthenticated, signOut } = useAuth()
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
    const [session, setSession] = useState(null)
    const [user, setUser] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
            setUser(data.session?.user || null)
            setIsLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session)
                setUser(session?.user || null)
                setIsLoading(false)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
    }

    return {
        session,
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut,
    }
}
