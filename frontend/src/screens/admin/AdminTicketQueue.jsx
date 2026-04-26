/**
 * AdminTicketQueue — Admin ticket management view
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket, Filter, ChevronRight, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const statusColor  = { open:'bg-green-100 text-green-700', assigned:'bg-blue-100 text-blue-700', in_progress:'bg-amber-100 text-amber-700', waiting_farmer:'bg-purple-100 text-purple-700', resolved:'bg-slate-100 text-slate-600', closed:'bg-slate-100 text-slate-400' };
const priorityColor= { low:'bg-slate-50 text-slate-500', medium:'bg-blue-50 text-blue-600', high:'bg-orange-50 text-orange-600', critical:'bg-red-100 text-red-700' };

const AdminTicketQueue = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('open'); // open | in_progress | resolved | all

    useEffect(() => {
        if (!session?.access_token) return;
        setLoading(true);
        const q = filter === 'all' ? '' : `?status=${filter}`;
        fetch(`${API}/api/v1/admin/tickets${q}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        }).then(r => r.json()).then(setTickets).finally(() => setLoading(false));
    }, [session, filter]);

    const criticalCount = tickets.filter(t => t.priority === 'critical').length;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Admin
                </button>
                <div className="flex items-center gap-3">
                    <Ticket className="w-6 h-6 text-white/80" />
                    <div>
                        <h1 className="text-xl font-bold">Ticket Queue</h1>
                        {criticalCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-orange-200 mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                {criticalCount} critical
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Filter tabs */}
            <div className="flex gap-1 px-4 py-3 overflow-x-auto no-scrollbar">
                {['open','in_progress','resolved','all'].map(s => (
                    <button key={s} onClick={() => setFilter(s)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap capitalize transition-all flex-shrink-0 ${filter === s ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-100'}`}>
                        {s.replace(/_/g, ' ')}
                    </button>
                ))}
            </div>

            <main className="p-4 space-y-2">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                        <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-semibold">No tickets in this view</p>
                    </div>
                ) : (
                    tickets.map(t => (
                        <Link key={t.id} to={`/admin/tickets/${t.id}`}
                            className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-slate-800 truncate">{t.subject}</p>
                                    {t.farmers && (
                                        <p className="text-xs text-slate-500 mt-0.5">{t.farmers.full_name} — {t.farmers.district}</p>
                                    )}
                                    <p className="text-xs text-slate-400 capitalize mt-0.5">{t.category?.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[t.status]}`}>{t.status?.replace(/_/g,' ')}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColor[t.priority]}`}>{t.priority}</span>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                        </Link>
                    ))
                )}
            </main>
        </div>
    );
};

export default AdminTicketQueue;
