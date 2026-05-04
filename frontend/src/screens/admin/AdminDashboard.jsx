/**
 * AdminDashboard — Extension worker overview
 * Shows aggregate stats, recent tickets, recent registrations
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Users, Ticket, FileText, Network, AlertTriangle,
    ChevronRight, Loader2, BarChart3, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../lib/apiBase';

const API = API_BASE;

const AdminDashboard = () => {
    const { session } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.access_token) {
            fetch(`${API}/api/v1/admin/dashboard`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
                .then(r => r.json())
                .then(setData)
                .finally(() => setLoading(false));
        }
    }, [session]);

    const statusColor = {
        open: 'text-green-700 bg-green-100',
        assigned: 'text-blue-700 bg-blue-100',
        in_progress: 'text-amber-700 bg-amber-100',
        resolved: 'text-slate-600 bg-slate-100',
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-6 pt-10 pb-8 text-white rounded-b-[2.5rem] shadow-lg">
                <p className="text-xs text-white/70 uppercase tracking-widest font-semibold mb-1">Admin Portal</p>
                <h1 className="text-2xl font-bold">Extension Worker Dashboard</h1>
                <p className="text-sm text-white/70 mt-1">Krishi Sakhi — KVK Management View</p>
            </header>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
            ) : (
                <main className="p-5 space-y-5">
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Total Farmers',  value: data?.stats?.total_farmers,      icon: Users,       color: 'from-green-500 to-emerald-700', link: '/admin/farmers' },
                            { label: 'Open Tickets',   value: data?.stats?.open_tickets,       icon: Ticket,      color: 'from-blue-500 to-blue-700',     link: '/admin/tickets' },
                            { label: 'Critical',       value: data?.stats?.critical_tickets,   icon: AlertTriangle, color: 'from-red-500 to-rose-700',    link: '/admin/tickets?priority=critical' },
                            { label: 'Posts Published',value: data?.stats?.published_posts,    icon: FileText,    color: 'from-purple-500 to-violet-700', link: '/admin/blog' },
                        ].map(({ label, value, icon: Icon, color, link }) => (
                            <Link key={label} to={link} className={`bg-gradient-to-br ${color} text-white rounded-2xl p-4 shadow-md active:scale-95 transition-transform`}>
                                <Icon className="w-5 h-5 mb-2 opacity-80" />
                                <p className="text-2xl font-extrabold">{value ?? '—'}</p>
                                <p className="text-xs text-white/80 font-medium mt-0.5">{label}</p>
                            </Link>
                        ))}
                    </div>

                    {/* Quick links */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { label: 'Farmers',    path: '/admin/farmers',       icon: Users    },
                            { label: 'Blog',       path: '/admin/blog',          icon: FileText },
                            { label: 'Network',    path: '/admin/network',       icon: Network  },
                        ].map(({ label, path, icon: Icon }) => (
                            <Link key={label} to={path}
                                className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow active:scale-95">
                                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                                    <Icon className="w-5 h-5 text-green-700" />
                                </div>
                                <span className="text-xs font-bold text-slate-600">{label}</span>
                            </Link>
                        ))}
                    </div>

                    {/* Recent Tickets */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Tickets</h2>
                            <Link to="/admin/tickets" className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                View all <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {(data?.recent_tickets || []).map(t => (
                                <Link key={t.id} to={`/admin/tickets/${t.id}`}
                                    className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{t.subject}</p>
                                        <p className="text-xs text-slate-500 capitalize mt-0.5">{t.category?.replace(/_/g, ' ')}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor[t.status] || 'bg-slate-100 text-slate-600'}`}>
                                        {t.status?.replace(/_/g, ' ')}
                                    </span>
                                </Link>
                            ))}
                            {!data?.recent_tickets?.length && (
                                <div className="text-center py-6 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">
                                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-400" />
                                    No open tickets — all clear!
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Recent Registrations */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Recent Farmers</h2>
                            <Link to="/admin/farmers" className="text-xs text-green-700 font-semibold flex items-center gap-1">
                                All <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-2">
                            {(data?.recent_registrations || []).map(f => (
                                <Link key={f.id} to={`/admin/farmers/${f.id}`}
                                    className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all">
                                    <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <span className="font-bold text-green-700 text-sm">{f.full_name?.[0] || '?'}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{f.full_name}</p>
                                        <p className="text-xs text-slate-500">{f.district}, {f.state}</p>
                                    </div>
                                    <p className="text-[11px] text-slate-400 flex-shrink-0">
                                        {new Date(f.created_at).toLocaleDateString('en-IN')}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                </main>
            )}
        </div>
    );
};

export default AdminDashboard;
