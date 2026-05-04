/**
 * CommunityHub — SakhiNet farmer community page (farmer-side)
 * Shows: AI suggestions, joined groups, discovery, quick actions
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Users, Plus, ChevronRight, Lightbulb, AlertTriangle,
    HandshakeIcon, MapPin, Loader2, Search, UserCheck, Wrench, Route, HandHelping, BookOpen
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';
import { API_BASE } from '../lib/apiBase';

const API = API_BASE;

const CommunityHub = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const token = session?.access_token;

    const [tab, setTab] = useState('my'); // 'my' | 'discover'
    const [myGroups, setMyGroups] = useState([]);
    const [nearbyGroups, setNearbyGroups] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState(null);

    useEffect(() => { if (token) fetchAll(); }, [token]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['community', 'notifications']) && token) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [token]);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [myRes, sugRes] = await Promise.all([
                fetch(`${API}/api/v1/cooperative/my-groups`, { headers }),
                fetch(`${API}/api/v1/cooperative/suggestions`, { headers }),
            ]);
            setMyGroups(myRes.ok ? await myRes.json() : []);
            const sugData = sugRes.ok ? await sugRes.json() : {};
            setSuggestions(sugData.suggestions || []);

            // Fetch nearby discovery groups
            const nearRes = await fetch(`${API}/api/v1/cooperative/groups`, { headers });
            setNearbyGroups(nearRes.ok ? await nearRes.json() : []);
        } catch (e) {
            console.error('[Community] Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const joinGroup = async (groupId) => {
        setJoiningId(groupId);
        try {
            await fetch(`${API}/api/v1/cooperative/groups/${groupId}/join`, { method: 'POST', headers });
            await fetchAll();
        } catch (e) {
            console.error('[Community] Join error:', e);
        } finally {
            setJoiningId(null);
        }
    };

    const joinedIds = new Set(myGroups.map(m => m.cooperative_groups?.id).filter(Boolean));
    const primaryGroupId = myGroups.find((m) => m.cooperative_groups?.id)?.cooperative_groups?.id || null;

    const urgentCount = suggestions.filter(s => s.type === 'urgent_help_request').length;
    const compactSuggestions = suggestions.slice(0, 2);

    const openGroupAction = (path) => {
        if (primaryGroupId) {
            navigate(`${path}?groupId=${primaryGroupId}`);
            return;
        }
        navigate('/community/create-group');
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-primary px-6 pt-10 pb-8 text-white rounded-b-[2.5rem] relative overflow-hidden shadow-lg">
                <div className="absolute right-0 top-0 w-40 h-40 bg-white/5 rounded-full translate-x-12 -translate-y-12" />
                <p className="text-xs text-white/70 uppercase tracking-widest font-semibold mb-1">SakhiNet</p>
                <h1 className="text-2xl font-bold tracking-tight">Community</h1>
                <p className="text-sm text-white/70 mt-1">Connect, share, and grow together</p>

                {urgentCount > 0 && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-orange-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {urgentCount} urgent help request{urgentCount > 1 ? 's' : ''} in your groups
                    </div>
                )}
            </header>

            <main className="flex-1 p-5 space-y-5">
                <section className="grid grid-cols-2 gap-3">
                    <button onClick={() => navigate('/blog')} className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm text-left">
                        <BookOpen className="w-5 h-5 text-indigo-600 mb-2" />
                        <p className="text-sm font-bold text-slate-800">Field Updates</p>
                        <p className="text-[11px] text-slate-500 mt-1">Blogs, weather, pest alerts</p>
                    </button>
                    <button onClick={() => navigate('/assistant', { state: { prefillMessage: 'Help me use SakhiNet for labour, transport, or local equipment sharing.' } })} className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm text-left">
                        <Lightbulb className="w-5 h-5 text-amber-500 mb-2" />
                        <p className="text-sm font-bold text-slate-800">Ask Sakhi</p>
                        <p className="text-[11px] text-slate-500 mt-1">Find the right community action</p>
                    </button>
                </section>

                <section className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Groups</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-2">{myGroups.length}</p>
                        <p className="text-[11px] text-slate-500 mt-1">joined</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Urgent</p>
                        <p className="text-2xl font-extrabold text-orange-600 mt-2">{urgentCount}</p>
                        <p className="text-[11px] text-slate-500 mt-1">help requests</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 border border-slate-100 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Nearby</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-2">{nearbyGroups.filter(g => !joinedIds.has(g.id)).length}</p>
                        <p className="text-[11px] text-slate-500 mt-1">to discover</p>
                    </div>
                </section>

                {myGroups.length > 0 && (
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Utility Shortcuts</p>
                                <h2 className="text-base font-bold text-slate-800 mt-1">Use SakhiNet for actual field coordination</h2>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <button onClick={() => openGroupAction('/community/create-help')} className="rounded-2xl bg-orange-50 px-3 py-4 text-left">
                                <HandHelping className="w-5 h-5 text-orange-600 mb-2" />
                                <p className="text-xs font-bold text-slate-800">Need Help</p>
                                <p className="text-[11px] text-slate-500 mt-1">Ask group</p>
                            </button>
                            <button onClick={() => openGroupAction('/community/add-resource')} className="rounded-2xl bg-blue-50 px-3 py-4 text-left">
                                <Wrench className="w-5 h-5 text-blue-600 mb-2" />
                                <p className="text-xs font-bold text-slate-800">Share Resource</p>
                                <p className="text-[11px] text-slate-500 mt-1">Tools, labour</p>
                            </button>
                            <button onClick={() => openGroupAction('/community/add-route')} className="rounded-2xl bg-emerald-50 px-3 py-4 text-left">
                                <Route className="w-5 h-5 text-emerald-600 mb-2" />
                                <p className="text-xs font-bold text-slate-800">Add Route</p>
                                <p className="text-[11px] text-slate-500 mt-1">Transport pool</p>
                            </button>
                        </div>
                    </section>
                )}

                {compactSuggestions.length > 0 && (
                    <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                <h2 className="text-sm font-bold text-slate-700">Suggested Next Steps</h2>
                            </div>
                            {suggestions.length > compactSuggestions.length && (
                                <span className="text-[11px] font-semibold text-slate-400">
                                    +{suggestions.length - compactSuggestions.length} more
                                </span>
                            )}
                        </div>
                        <div className="space-y-2">
                            {compactSuggestions.map((s, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-2xl border ${
                                    s.type === 'urgent_help_request' ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'
                                }`}>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                        s.type === 'urgent_help_request' ? 'bg-orange-100' : 'bg-blue-50'
                                    }`}>
                                        {s.type === 'urgent_help_request'
                                            ? <AlertTriangle className="w-4 h-4 text-orange-600" />
                                            : <Users className="w-4 h-4 text-blue-600" />
                                        }
                                    </div>
                                    <p className="text-xs font-medium text-slate-700 flex-1">{s.title}</p>
                                    {s.type === 'group_to_join' ? (
                                        <button
                                            onClick={() => joinGroup(s.group_id)}
                                            disabled={joiningId === s.group_id}
                                            className="flex-shrink-0 text-[11px] font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            {joiningId === s.group_id ? '...' : 'Join'}
                                        </button>
                                    ) : (
                                        <Link
                                            to={`/community/groups/${s.group_id}`}
                                            className="flex-shrink-0 text-[11px] font-semibold text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            View
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                    {[
                        { id: 'my', label: 'My Groups', count: myGroups.length },
                        { id: 'discover', label: 'Discover' },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                                tab === t.id
                                    ? 'bg-white text-green-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {t.label}
                            {t.count != null && <span className="ml-1.5 bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : tab === 'my' ? (
                    /* My Groups */
                    <div className="space-y-3">
                        {myGroups.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                                <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600 font-semibold">No groups yet</p>
                                <p className="text-slate-400 text-sm mt-1">Join or create one from Discover</p>
                            </div>
                        ) : (
                            myGroups.map((m) => {
                                const g = m.cooperative_groups;
                                if (!g) return null;
                                return (
                                    <Link
                                        key={g.id}
                                        to={`/community/groups/${g.id}`}
                                        className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow active:scale-[0.98]"
                                    >
                                        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <HandshakeIcon className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 truncate">{g.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{g.member_count} members • {m.role}</p>
                                            {g.description && <p className="text-xs text-slate-400 truncate mt-0.5">{g.description}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                                    </Link>
                                );
                            })
                        )}
                    </div>
                ) : (
                    /* Discover */
                    <div className="space-y-3">
                        {nearbyGroups.filter(g => !joinedIds.has(g.id)).length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-600 font-semibold">You've joined all nearby groups!</p>
                            </div>
                        ) : (
                            nearbyGroups
                                .filter(g => !joinedIds.has(g.id))
                                .map((g) => (
                                    <div
                                        key={g.id}
                                        className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                                    >
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-6 h-6 text-blue-500" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 truncate">{g.name}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{g.district} • {g.member_count} members</p>
                                            {g.description && <p className="text-xs text-slate-400 truncate mt-0.5">{g.description}</p>}
                                        </div>
                                        <button
                                            onClick={() => joinGroup(g.id)}
                                            disabled={joiningId === g.id}
                                            className="flex-shrink-0 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                                        >
                                            {joiningId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                                            Join
                                        </button>
                                    </div>
                                ))
                        )}
                    </div>
                )}

                {/* Create Group FAB */}
                <Link
                    to="/community/create-group"
                    className="fixed bottom-28 right-4 w-14 h-14 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-full shadow-xl flex items-center justify-center transition-all z-40"
                    title="Create a new group"
                >
                    <Plus className="w-7 h-7" />
                </Link>
            </main>
        </div>
    );
};

export default CommunityHub;
