import React, { useEffect, useState } from 'react';
import {
    Bell, BookOpen, ChevronRight, CloudSun, IndianRupee, Loader2, MessageSquare,
    ScanSearch, Sprout, TrendingUp, Users, ShieldCheck, CalendarDays, TriangleAlert
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../hooks/useAuth';
import { getCropRecommendation, getFarmerToday, getWeather } from '../lib/backendClient';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';

const formatInr = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const taskTone = {
    high: 'bg-rose-50 border-rose-100 text-rose-800',
    medium: 'bg-amber-50 border-amber-100 text-amber-800',
    low: 'bg-slate-50 border-slate-100 text-slate-700',
};

const taskActionLabel = {
    weather: 'Open Sakhi',
    activity: 'Open Activity',
    crop_stage: 'Scan Crop',
    finance: 'Open Finance',
    ticket: 'View Tickets',
    community: 'Open Community',
};

const HomeDashboard = () => {
    const { user, session } = useAuth();
    const navigate = useNavigate();
    const [todayView, setTodayView] = useState(null);
    const [cropRec, setCropRec] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id && session?.access_token) {
            fetchDashboard();
        }
    }, [user?.id, session?.access_token]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['dashboard', 'activity', 'finance', 'tickets', 'community', 'farms', 'notifications']) && user?.id && session?.access_token) {
                fetchDashboard();
            }
        });
        return unsubscribe;
    }, [user?.id, session?.access_token]);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const [today, liveWeather] = await Promise.all([
                getFarmerToday({ token: session.access_token }),
                getWeather({ token: session.access_token }).catch(() => null),
            ]);
            const mergedToday = {
                ...today,
                weather: liveWeather?.temp != null
                    ? { ...(today?.weather || {}), ...liveWeather }
                    : (today?.weather || {}),
            };
            setTodayView(mergedToday);

            const primaryFarm = mergedToday?.season_timeline?.[0];
            if (primaryFarm?.crop_id) {
                setCropRec(primaryFarm.crop_name);
            } else if ((mergedToday?.quick_stats?.farm_count || 0) > 0) {
                const rec = await getCropRecommendation({ farmId: null, token: session.access_token }).catch(() => null);
                setCropRec(rec?.top_recommendation || null);
            } else {
                setCropRec(null);
            }
        } catch (err) {
            console.error('[Dashboard] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const weather = todayView?.weather || {};
    const taskCount = todayView?.today_tasks?.length ?? todayView?.daily_brief?.task_count ?? 0;
    const greetingHour = new Date().getHours();
    const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';

    if (loading) {
        return (
            <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
                <header className="bg-primary px-6 py-6 text-primary-foreground shadow-md rounded-b-3xl">
                    <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-white/20 rounded w-1/3" />
                        <div className="h-6 bg-white/20 rounded w-2/3" />
                    </div>
                </header>
                <main className="flex-1 p-5 space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-3xl h-24 animate-pulse" />
                    ))}
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-primary px-6 pt-8 pb-10 text-primary-foreground shadow-md rounded-b-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-white/80 font-medium">{greeting} 👋</p>
                        <h1 className="text-2xl font-bold tracking-tight mt-1">{todayView?.farmer?.full_name || 'Farmer'}</h1>
                        <p className="text-xs text-white/60 mt-1">
                            {[todayView?.farmer?.district, todayView?.farmer?.state].filter(Boolean).join(', ') || 'Location not set'}
                        </p>
                    </div>
                    <NotificationBell token={session?.access_token} />
                </div>

                <div className="mt-5 rounded-3xl bg-white/15 backdrop-blur p-4 border border-white/20">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Today Brief</p>
                            <h2 className="text-xl font-extrabold mt-1">{todayView?.daily_brief?.headline || 'Ready for today'}</h2>
                            <p className="text-sm text-white/80 mt-2 leading-relaxed">{todayView?.daily_brief?.body}</p>
                        </div>
                        <div className="rounded-2xl bg-white/15 p-3 flex-shrink-0">
                            <ShieldCheck className="w-6 h-6 text-emerald-200" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="rounded-2xl bg-white/10 p-3">
                            <p className="text-[11px] text-white/60 font-bold uppercase tracking-wider">Tasks</p>
                            <p className="text-lg font-extrabold mt-1">{taskCount}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-3">
                            <p className="text-[11px] text-white/60 font-bold uppercase tracking-wider">Temp</p>
                            <p className="text-lg font-extrabold mt-1">{weather?.temp != null ? `${Math.round(weather.temp)}°` : '--'}</p>
                        </div>
                        <div className="rounded-2xl bg-white/10 p-3">
                            <p className="text-[11px] text-white/60 font-bold uppercase tracking-wider">Rain</p>
                            <p className="text-lg font-extrabold mt-1">{weather?.rainfall != null ? `${weather.rainfall} mm` : '--'}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-5 space-y-5 -mt-6 relative z-10">
                <section className="grid grid-cols-2 gap-3">
                    <Link to="/assistant" className="rounded-3xl bg-emerald-600 text-white p-4 shadow-lg shadow-emerald-200">
                        <MessageSquare className="w-5 h-5 mb-3" />
                        <p className="text-sm font-bold">Ask Sakhi</p>
                        <p className="text-xs text-emerald-100 mt-1">Advice, logging, tickets</p>
                    </Link>
                    <Link to="/camera" className="rounded-3xl bg-white p-4 border border-slate-100 shadow-sm">
                        <ScanSearch className="w-5 h-5 mb-3 text-blue-600" />
                        <p className="text-sm font-bold text-slate-800">Scan Crop</p>
                        <p className="text-xs text-slate-500 mt-1">Pest and soil checks</p>
                    </Link>
                    <Link to="/finance" className="rounded-3xl bg-white p-4 border border-slate-100 shadow-sm">
                        <IndianRupee className="w-5 h-5 mb-3 text-amber-600" />
                        <p className="text-sm font-bold text-slate-800">Profit & Cost</p>
                        <p className="text-xs text-slate-500 mt-1">Track expenses and sales</p>
                    </Link>
                    <Link to="/community" className="rounded-3xl bg-white p-4 border border-slate-100 shadow-sm">
                        <Users className="w-5 h-5 mb-3 text-indigo-600" />
                        <p className="text-sm font-bold text-slate-800">SakhiNet</p>
                        <p className="text-xs text-slate-500 mt-1">Groups, help, and routes</p>
                    </Link>
                </section>

                <Link to="/blog" className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">Field Updates</p>
                            <p className="text-xs text-slate-500">Blogs, alerts, and useful posts</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                </Link>

                <section className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Farms</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-2">{todayView?.quick_stats?.farm_count || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Crops</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-2">{todayView?.quick_stats?.active_crop_count || 0}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Alerts</p>
                        <p className="text-2xl font-extrabold text-rose-600 mt-2">{todayView?.quick_stats?.unread_notification_count || 0}</p>
                    </div>
                </section>

                {todayView?.today_tasks?.length > 0 && (
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Today Priorities</p>
                                <h3 className="text-lg font-bold text-slate-800 mt-1">What to do next</h3>
                            </div>
                            <TriangleAlert className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="space-y-3">
                            {todayView.today_tasks.map((task) => (
                                <button
                                    key={`${task.title}-${task.route}`}
                                    onClick={() => navigate(task.route)}
                                    className={`w-full text-left rounded-2xl border p-4 ${taskTone[task.priority] || taskTone.low}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold">{task.title}</p>
                                            <p className="text-xs mt-1 leading-relaxed opacity-90">{task.subtitle}</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider">{taskActionLabel[task.kind] || 'Open'}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {todayView?.season_timeline?.length > 0 && (
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Season Timeline</p>
                                <h3 className="text-lg font-bold text-slate-800 mt-1">Crop progress at a glance</h3>
                            </div>
                            <CalendarDays className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="space-y-4">
                            {todayView.season_timeline.map((item) => (
                                <div key={item.crop_id} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.crop_name}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.farm_name || 'Farm not linked'} • {item.current_stage?.replace(/_/g, ' ')}</p>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                                            {item.days_since_sowing != null ? `Day ${item.days_since_sowing}` : 'New crop'}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-3">
                                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${Math.max(item.progress_pct || 0, 6)}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                                        <span>Now: {item.current_stage?.replace(/_/g, ' ')}</span>
                                        <span>Next: {item.next_stage?.replace(/_/g, ' ')}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed mt-3">{item.hint}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                <section className="grid grid-cols-1 gap-4">
                    <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Finance Pulse</p>
                                <h3 className="text-lg font-bold text-slate-800 mt-1">Profit and spend snapshot</h3>
                            </div>
                            <TrendingUp className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Spend</p>
                                <p className="text-sm font-extrabold text-slate-800 mt-1">{formatInr(todayView?.finance_summary?.expense_total)}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Revenue</p>
                                <p className="text-sm font-extrabold text-emerald-700 mt-1">{formatInr(todayView?.finance_summary?.revenue_total)}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">P/L</p>
                                <p className={`text-sm font-extrabold mt-1 ${(todayView?.finance_summary?.profit_loss || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {formatInr(todayView?.finance_summary?.profit_loss)}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                            <span>Top expense: {todayView?.finance_summary?.top_expense_category || 'Not enough data'}</span>
                            <Link to="/finance" className="font-semibold text-primary inline-flex items-center gap-1">Open Finance <ChevronRight className="w-3 h-3" /></Link>
                        </div>
                    </div>

                    <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Community Pulse</p>
                                <h3 className="text-lg font-bold text-slate-800 mt-1">Your SakhiNet network</h3>
                            </div>
                            <Users className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="rounded-2xl bg-indigo-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Groups</p>
                                <p className="text-xl font-extrabold text-slate-800 mt-1">{todayView?.community_summary?.group_count || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-orange-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400">Urgent Help</p>
                                <p className="text-xl font-extrabold text-slate-800 mt-1">{todayView?.community_summary?.urgent_help_requests || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-blue-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Resources</p>
                                <p className="text-xl font-extrabold text-slate-800 mt-1">{todayView?.community_summary?.available_resources || 0}</p>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Routes</p>
                                <p className="text-xl font-extrabold text-slate-800 mt-1">{todayView?.community_summary?.active_routes || 0}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                            <span>Use SakhiNet for labour, transport, and local help.</span>
                            <Link to="/community" className="font-semibold text-primary inline-flex items-center gap-1">Open Community <ChevronRight className="w-3 h-3" /></Link>
                        </div>
                    </div>
                </section>

                {(todayView?.recommended_posts?.length > 0 || cropRec) && (
                    <section className="rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Field Intelligence</p>
                                <h3 className="text-lg font-bold text-slate-800 mt-1">What to learn or plan next</h3>
                            </div>
                            <BookOpen className="w-5 h-5 text-emerald-600" />
                        </div>
                        {cropRec && (
                            <button
                                onClick={() => navigate('/assistant', { state: { prefillMessage: `Should I plan my next season around ${cropRec}? Use my current farm and finance data.` } })}
                                className="w-full rounded-2xl bg-white/90 border border-emerald-100 p-4 text-left mb-3"
                            >
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Next Season Suggestion</p>
                                <p className="text-base font-bold text-slate-800 mt-1">{cropRec}</p>
                                <p className="text-xs text-slate-500 mt-1">Ask Sakhi to turn this into a planting and budgeting plan.</p>
                            </button>
                        )}
                        <div className="space-y-3">
                            {(todayView?.recommended_posts || []).map((post) => (
                                <Link key={post.id} to={`/blog/${post.id}`} className="block rounded-2xl bg-white/80 border border-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">{post.category?.replace(/_/g, ' ')}</p>
                                            <p className="text-sm font-bold text-slate-800 mt-1">{post.title}</p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{post.summary}</p>
                                        </div>
                                        <Bell className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

export default HomeDashboard;
