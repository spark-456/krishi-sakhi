import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ticket, Plus, ChevronRight, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';
import { API_BASE } from '../lib/apiBase';

const API = API_BASE;

const statusBadge = {
    open:           'bg-green-100 text-green-700',
    assigned:       'bg-blue-100 text-blue-700',
    in_progress:    'bg-amber-100 text-amber-700',
    waiting_farmer: 'bg-purple-100 text-purple-700',
    resolved:       'bg-slate-100 text-slate-600',
    closed:         'bg-slate-100 text-slate-400',
};
const priorityBadge = {
    low:      'bg-slate-50 text-slate-500',
    medium:   'bg-blue-50 text-blue-600',
    high:     'bg-orange-50 text-orange-600',
    critical: 'bg-red-100 text-red-700',
};

const MyTickets = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchTickets = async () => {
        if (!session?.access_token) return;
        setLoading(true);
        try {
            const response = await fetch(`${API}/api/v1/tickets`, { headers: { Authorization: `Bearer ${session.access_token}` } });
            setTickets(response.ok ? await response.json() : []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [session?.access_token]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['tickets', 'notifications']) && session?.access_token) {
                fetchTickets();
            }
        });
        return unsubscribe;
    }, [session?.access_token]);

    const openCount = tickets.filter(t => !['resolved','closed'].includes(t.status)).length;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-primary px-6 pt-10 pb-8 text-white rounded-b-[2.5rem] shadow-lg">
                <div className="flex items-center gap-3 mb-1">
                    <Ticket className="w-5 h-5 text-white/80" />
                    <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">Support</p>
                </div>
                <h1 className="text-2xl font-bold">My Tickets</h1>
                {openCount > 0 && <p className="text-sm text-white/70 mt-1">{openCount} open ticket{openCount > 1 ? 's' : ''}</p>}
            </header>

            <main className="p-4 space-y-3">
                <Link
                    to="/tickets/new"
                    className="flex items-center gap-2 justify-center p-3.5 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Support Ticket
                </Link>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                        <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-semibold">No tickets yet</p>
                        <p className="text-slate-400 text-sm mt-1">Raise one if you need help from KVK</p>
                    </div>
                ) : (
                    tickets.map(t => (
                        <Link
                            key={t.id}
                            to={`/tickets/${t.id}`}
                            className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all p-4"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-sm text-slate-800 flex-1">{t.subject}</p>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${statusBadge[t.status]}`}>
                                    {t.status?.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityBadge[t.priority]}`}>
                                    {t.priority}
                                </span>
                                <span className="text-[11px] text-slate-400 capitalize">{t.category?.replace(/_/g, ' ')}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                        </Link>
                    ))
                )}
            </main>
        </div>
    );
};

export default MyTickets;
