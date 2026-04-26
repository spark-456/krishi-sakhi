import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../lib/backendClient';
import { dispatchDataRefresh } from '../lib/appEvents';

const typeStyles = {
    ticket: 'bg-rose-50 text-rose-700',
    community: 'bg-blue-50 text-blue-700',
    weather_nudge: 'bg-amber-50 text-amber-700',
    crop_nudge: 'bg-emerald-50 text-emerald-700',
    irrigation_nudge: 'bg-cyan-50 text-cyan-700',
    harvest_nudge: 'bg-purple-50 text-purple-700',
    admin_ticket: 'bg-slate-100 text-slate-700',
    info: 'bg-slate-100 text-slate-700',
};

const NotificationsScreen = () => {
    const navigate = useNavigate();
    const { session } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    useEffect(() => {
        if (session?.access_token) {
            fetchNotifications();
        }
    }, [session?.access_token]);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const data = await getNotifications({ token: session.access_token, limit: 50 });
            setNotifications(data?.notifications || []);
            setUnreadCount(data?.unread_count || 0);
        } catch (error) {
            console.error('[Notifications] Fetch failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const openNotification = async (notification) => {
        try {
            if (!notification.is_read) {
                await markNotificationRead({ notificationId: notification.id, token: session.access_token });
                setNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
                setUnreadCount((prev) => Math.max(prev - 1, 0));
                dispatchDataRefresh(['notifications']);
            }
        } catch (error) {
            console.error('[Notifications] Read update failed:', error);
        }

        if (notification.action_url) {
            navigate(notification.action_url);
        }
    };

    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        try {
            await markAllNotificationsRead({ token: session.access_token });
            setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
            setUnreadCount(0);
            dispatchDataRefresh(['notifications']);
        } catch (error) {
            console.error('[Notifications] Mark-all failed:', error);
        } finally {
            setMarkingAll(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-primary px-6 pt-10 pb-7 text-white rounded-b-[2.5rem] shadow-lg">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">Updates</p>
                            <h1 className="text-2xl font-bold">Notifications</h1>
                        </div>
                    </div>
                    <button
                        onClick={handleMarkAllRead}
                        disabled={markingAll || unreadCount === 0}
                        className="text-xs font-semibold px-3 py-2 rounded-xl bg-white/10 border border-white/15 hover:bg-white/15 disabled:opacity-50 transition-colors"
                    >
                        {markingAll ? '...' : 'Mark all read'}
                    </button>
                </div>
                <p className="text-sm text-white/70 mt-3">{unreadCount} unread alert{unreadCount === 1 ? '' : 's'}</p>
            </header>

            <main className="p-5">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm text-center py-14 px-6">
                        <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-700 font-semibold">No notifications yet</p>
                        <p className="text-sm text-slate-400 mt-1">Ticket updates, SakhiNet replies, and nudges will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {notifications.map((notification) => (
                            <button
                                key={notification.id}
                                onClick={() => openNotification(notification)}
                                className={`w-full text-left bg-white rounded-2xl border shadow-sm p-4 transition-all hover:shadow-md ${notification.is_read ? 'border-slate-100' : 'border-green-200 ring-1 ring-green-100'}`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${typeStyles[notification.type] || typeStyles.info}`}>
                                        {notification.is_read ? <Bell className="w-5 h-5" /> : <CheckCheck className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-bold text-slate-800">{notification.title}</p>
                                            {!notification.is_read && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">New</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{notification.message}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${typeStyles[notification.type] || typeStyles.info}`}>
                                                {notification.type?.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[11px] text-slate-400">
                                                {new Date(notification.created_at).toLocaleString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default NotificationsScreen;
