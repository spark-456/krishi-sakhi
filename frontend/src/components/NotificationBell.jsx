import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

import { getNotifications } from '../lib/backendClient';
import { subscribeToDataRefresh, shouldRefresh } from '../lib/appEvents';

const NotificationBell = ({ token, className = '' }) => {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!token) return;

        const fetchSummary = async () => {
            try {
                const data = await getNotifications({ token, unreadOnly: false, limit: 5 });
                setUnreadCount(data?.unread_count || 0);
            } catch (error) {
                console.error('[Notifications] Summary fetch failed:', error);
            }
        };

        fetchSummary();
        const interval = window.setInterval(fetchSummary, 60000);
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['notifications', 'tickets', 'community'])) {
                fetchSummary();
            }
        });
        return () => {
            window.clearInterval(interval);
            unsubscribe();
        };
    }, [token]);

    return (
        <Link
            to="/notifications"
            className={`relative flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 border border-white/15 text-white hover:bg-white/15 transition-colors ${className}`}
            aria-label="Notifications"
        >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    );
};

export default NotificationBell;
