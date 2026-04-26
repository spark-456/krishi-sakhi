import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

/**
 * AdminGuard — wraps admin routes.
 * Checks that the logged-in farmer has role = 'admin'.
 * Redirects to /dashboard if not admin.
 */
const AdminGuard = ({ children }) => {
    const { user } = useAuth();
    const [role, setRole] = useState(null); // null = loading
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!user?.id) return;
        supabase
            .from('farmers')
            .select('role')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                setRole(data?.role || 'farmer');
                setChecked(true);
            });
    }, [user?.id]);

    if (!checked) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (role !== 'admin') return <Navigate to="/dashboard" replace />;
    return children;
};

export default AdminGuard;
