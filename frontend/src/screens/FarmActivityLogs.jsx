/**
 * FarmActivityLogs — DB-Backed Activity Timeline
 * ────────────────────────────────────────────────
 * MIMIC_DEV: Fetches from activity_logs table (starts clean).
 * Only shows logs that were explicitly created by user actions.
 * FAB to add new activity via AddActivityModal.
 */
import React, { useState, useEffect } from 'react';
import {
    Search, Filter, Sprout, Droplets, ShieldAlert, Scissors,
    FlaskConical, Bug, Ruler, FileEdit, Shovel, Wheat,
    Plus, ClipboardList, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import AddActivityModal from '../components/AddActivityModal';

const ACTIVITY_ICONS = {
    planting: { icon: Sprout, color: 'bg-green-100 text-green-600' },
    irrigation: { icon: Droplets, color: 'bg-blue-100 text-blue-600' },
    fertilizer: { icon: FlaskConical, color: 'bg-emerald-100 text-emerald-600' },
    pesticide: { icon: Bug, color: 'bg-amber-100 text-amber-600' },
    weeding: { icon: Shovel, color: 'bg-lime-100 text-lime-600' },
    pruning: { icon: Scissors, color: 'bg-orange-100 text-orange-600' },
    harvest: { icon: Wheat, color: 'bg-yellow-100 text-yellow-700' },
    soil_test: { icon: FlaskConical, color: 'bg-purple-100 text-purple-600' },
    disease_alert: { icon: ShieldAlert, color: 'bg-red-100 text-red-600' },
    growth_update: { icon: Ruler, color: 'bg-teal-100 text-teal-600' },
    other: { icon: FileEdit, color: 'bg-slate-100 text-slate-600' },
};

const FILTER_TABS = ['All', 'Planting', 'Irrigation', 'Fertilizer', 'Harvest', 'Disease'];

const FarmActivityLogs = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [farms, setFarms] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (user?.id) fetchAll();
    }, [user?.id]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            // Fetch activity logs
            const { data: logData } = await supabase
                .from('activity_logs').select('*').eq('farmer_id', user.id)
                .order('date', { ascending: false });
            setLogs(logData || []);

            // Fetch farm names for display
            const { data: farmData } = await supabase
                .from('farms').select('id, farm_name').eq('farmer_id', user.id);
            const farmMap = {};
            (farmData || []).forEach(f => { farmMap[f.id] = f.farm_name; });
            setFarms(farmMap);
        } catch (err) {
            console.error('[Activity] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteLog = async (logId) => {
        try {
            await supabase.from('activity_logs').delete().eq('id', logId);
            setLogs(prev => prev.filter(l => l.id !== logId));
        } catch (err) {
            console.error('[Activity] Delete error:', err);
        }
    };

    const filteredLogs = logs.filter(log => {
        const matchesFilter = filter === 'All' || log.activity_type === filter.toLowerCase();
        const matchesSearch = !searchQuery ||
            log.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.crop_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
                <header className="bg-white border-b border-slate-100 px-6 py-5">
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight">Activity Logs</h1>
                </header>
                <main className="flex-1 p-6 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Activity Logs</h1>
                        <p className="text-xs text-slate-500 mt-0.5">{logs.length} {logs.length === 1 ? 'entry' : 'entries'} logged</p>
                    </div>
                    <button className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-full transition-colors border border-slate-200">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input type="text" placeholder="Search activities..."
                        className="w-full bg-slate-100/80 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
                    {FILTER_TABS.map((cat) => (
                        <button key={cat} onClick={() => setFilter(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === cat
                                ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-6 relative">
                {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <ClipboardList className="w-10 h-10 text-slate-400" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 mb-2">
                            {logs.length === 0 ? 'No Activities Logged Yet' : 'No Matching Activities'}
                        </h2>
                        <p className="text-sm text-slate-500 mb-6 max-w-xs">
                            {logs.length === 0
                                ? 'Start logging your farm activities to track progress and share context with Ask Sakhi.'
                                : `No activities match "${filter}" filter${searchQuery ? ` and "${searchQuery}"` : ''}.`}
                        </p>
                        {logs.length === 0 && (
                            <button onClick={() => setShowModal(true)}
                                className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2">
                                <Plus className="w-5 h-5" /> Log First Activity
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Timeline Line */}
                        <div className="absolute left-[39px] top-6 bottom-6 w-px bg-slate-200" />

                        <div className="space-y-5 relative z-10">
                            {filteredLogs.map((log) => {
                                const typeInfo = ACTIVITY_ICONS[log.activity_type] || ACTIVITY_ICONS.other;
                                const Icon = typeInfo.icon;

                                return (
                                    <div key={log.id} className="relative pl-12 group">
                                        {/* Timeline Dot */}
                                        <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm ${typeInfo.color} bg-white`}>
                                            <Icon className="w-4 h-4" />
                                        </div>

                                        {/* Card */}
                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 group-hover:border-primary/20 transition-colors">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <h3 className="font-bold text-slate-800 text-sm flex-1">{log.title}</h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2 flex-shrink-0">{formatDate(log.date)}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium mb-2">
                                                {farms[log.farm_id] || 'General'}{log.crop_name ? ` • ${log.crop_name}` : ''}
                                            </p>
                                            {log.description && (
                                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    {log.description}
                                                </p>
                                            )}
                                            <div className="mt-2 flex justify-between items-center text-[11px] font-bold text-slate-400">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] capitalize ${typeInfo.color}`}>
                                                    {log.activity_type?.replace('_', ' ')}
                                                </span>
                                                <button onClick={() => handleDeleteLog(log.id)}
                                                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </main>

            {/* FAB */}
            <button onClick={() => setShowModal(true)}
                className="fixed bottom-24 right-4 max-w-md z-30 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all active:scale-95">
                <Plus className="w-6 h-6" />
            </button>

            {/* Add Activity Modal */}
            <AddActivityModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                farmerId={user?.id}
                onActivityAdded={fetchAll}
            />
        </div>
    );
};

export default FarmActivityLogs;
