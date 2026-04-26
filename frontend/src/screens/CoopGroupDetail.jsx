/**
 * CoopGroupDetail — Full group view with sub-tabs
 * Tabs: Members | Resources | Help Board | Routes | Chat
 */
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Users, Package, HelpCircle, Map, MessageSquare,
    ArrowLeft, Plus, ChevronRight, AlertTriangle,
    CheckCircle2, Clock, Loader2, Send
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const TABS = [
    { id: 'members',   label: 'Members',   icon: Users },
    { id: 'resources', label: 'Resources', icon: Package },
    { id: 'help',      label: 'Help Board',icon: HelpCircle },
    { id: 'routes',    label: 'Routes',    icon: Map },
    { id: 'chat',      label: 'Chat',      icon: MessageSquare },
];

const urgencyColor = { low: 'text-slate-500 bg-slate-50', normal: 'text-blue-600 bg-blue-50', urgent: 'text-orange-600 bg-orange-100' };
const statusColor  = { open: 'text-green-700 bg-green-100', in_progress: 'text-blue-700 bg-blue-100', resolved: 'text-slate-600 bg-slate-100', expired: 'text-red-600 bg-red-50' };
const availColor   = { available: 'text-green-700 bg-green-100', in_use: 'text-amber-700 bg-amber-100', unavailable: 'text-red-600 bg-red-50' };

const CoopGroupDetail = () => {
    const { groupId } = useParams();
    const { session } = useAuth();
    const navigate = useNavigate();
    const token = session?.access_token;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const [tab, setTab] = useState('members');
    const [group, setGroup]       = useState(null);
    const [members, setMembers]   = useState([]);
    const [resources, setResources] = useState([]);
    const [helpRequests, setHelp] = useState([]);
    const [routes, setRoutes]     = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatMsg, setChatMsg]   = useState('');
    const [loading, setLoading]   = useState(true);
    const [sending, setSending]   = useState(false);

    useEffect(() => { if (token && groupId) fetchAll(); }, [token, groupId, tab]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['community']) && token && groupId) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [token, groupId, tab]);

    const get = (path) => fetch(`${API}/api/v1/cooperative/groups/${groupId}${path}`, { headers }).then(r => r.ok ? r.json() : []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            if (!group) setGroup(await get(''));
            if (tab === 'members')   setMembers(await get('/members'));
            if (tab === 'resources') setResources(await get('/resources'));
            if (tab === 'help')      setHelp(await get('/help-requests'));
            if (tab === 'routes')    setRoutes(await get('/routes'));
            if (tab === 'chat')      setMessages(await get('/messages'));
        } finally { setLoading(false); }
    };

    const sendChat = async () => {
        if (!chatMsg.trim()) return;
        setSending(true);
        try {
            await fetch(`${API}/api/v1/cooperative/groups/${groupId}/messages`, {
                method: 'POST', headers,
                body: JSON.stringify({ message: chatMsg, message_type: 'text' }),
            });
            setChatMsg('');
            setMessages(await get('/messages'));
        } finally { setSending(false); }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header */}
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/community')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Community
                </button>
                <h1 className="text-xl font-bold truncate">{group?.name || 'Loading…'}</h1>
                {group && (
                    <p className="text-xs text-white/70 mt-0.5">{group.district} • {group.member_count} members</p>
                )}
            </header>

            {/* Tab Bar */}
            <div className="flex gap-1 px-4 pt-4 overflow-x-auto no-scrollbar">
                {TABS.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                                tab === t.id ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-100'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            <main className="flex-1 p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : (
                    <>
                        {/* Members */}
                        {tab === 'members' && (
                            <div className="space-y-2 mt-2">
                                {members.map((m, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="text-green-700 font-bold text-sm">
                                                {m.farmers?.full_name?.[0] || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-800">{m.farmers?.full_name}</p>
                                            <p className="text-xs text-slate-500">{m.farmers?.district} {m.farmers?.village ? `• ${m.farmers.village}` : ''}</p>
                                        </div>
                                        {m.role === 'admin' && (
                                            <span className="ml-auto text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Admin</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Resources */}
                        {tab === 'resources' && (
                            <div className="space-y-2 mt-2">
                                <Link to={`/community/add-resource?groupId=${groupId}`}
                                    className="flex items-center gap-2 justify-center p-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                                    <Plus className="w-4 h-4" /> Share a resource
                                </Link>
                                {resources.map((r) => (
                                    <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-semibold text-sm text-slate-800">{r.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 capitalize">{r.resource_type} {r.quantity ? `• ${r.quantity}` : ''}</p>
                                                {r.cost_per_use && <p className="text-xs text-green-700 font-medium mt-1">💰 {r.cost_per_use}</p>}
                                                {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
                                            </div>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${availColor[r.availability_status] || 'text-slate-600 bg-slate-100'}`}>
                                                {r.availability_status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2">by {r.farmers?.full_name || 'Member'}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Help Board */}
                        {tab === 'help' && (
                            <div className="space-y-2 mt-2">
                                <Link to={`/community/create-help?groupId=${groupId}`}
                                    className="flex items-center gap-2 justify-center p-3 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl text-sm text-orange-600 font-semibold hover:bg-orange-100 transition-colors">
                                    <Plus className="w-4 h-4" /> Post a help request
                                </Link>
                                {helpRequests.map((h) => (
                                    <div key={h.id} className={`bg-white p-4 rounded-2xl border shadow-sm ${h.urgency === 'urgent' ? 'border-orange-200' : 'border-slate-100'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm text-slate-800">{h.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 capitalize">{h.category?.replace(/_/g, ' ')}</p>
                                                {h.description && <p className="text-xs text-slate-400 mt-1">{h.description}</p>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyColor[h.urgency]}`}>
                                                    {h.urgency}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[h.status]}`}>
                                                    {h.status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2">by {h.farmers?.full_name || 'Member'}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Routes */}
                        {tab === 'routes' && (
                            <div className="space-y-2 mt-2">
                                <Link to={`/community/add-route?groupId=${groupId}`}
                                    className="flex items-center gap-2 justify-center p-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-500 hover:bg-slate-50 transition-colors">
                                    <Plus className="w-4 h-4" /> Share a route
                                </Link>
                                {routes.map((r) => (
                                    <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                        <p className="font-semibold text-sm text-slate-800">{r.route_name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 capitalize">→ {r.destination_name} ({r.destination_type})</p>
                                        {r.frequency && <p className="text-xs text-green-700 mt-1">🗓 {r.frequency}</p>}
                                        {r.notes && <p className="text-xs text-slate-400 mt-1">{r.notes}</p>}
                                    </div>
                                ))}
                                {routes.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm">No shared routes yet</div>
                                )}
                            </div>
                        )}

                        {/* Chat */}
                        {tab === 'chat' && (
                            <div className="flex flex-col h-full mt-2">
                                <div className="flex-1 space-y-2 mb-4 max-h-[55vh] overflow-y-auto pr-1">
                                    {messages.map((m) => (
                                        <div key={m.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-700">{m.farmers?.full_name || 'Member'}</span>
                                                {m.message_type !== 'text' && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${m.message_type === 'alert' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {m.message_type}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 ml-auto">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-sm text-slate-700">{m.message}</p>
                                        </div>
                                    ))}
                                    {messages.length === 0 && (
                                        <div className="text-center py-8 text-slate-400 text-sm">No messages yet — say hello!</div>
                                    )}
                                </div>
                                {/* Chat input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={chatMsg}
                                        onChange={e => setChatMsg(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendChat()}
                                        placeholder="Type a message…"
                                        className="flex-1 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                                    />
                                    <button
                                        onClick={sendChat}
                                        disabled={sending || !chatMsg.trim()}
                                        className="w-12 h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl flex items-center justify-center transition-colors"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default CoopGroupDetail;
