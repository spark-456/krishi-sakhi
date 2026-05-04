/**
 * CoopGroupDetail — Full group view with sub-tabs
 * Tabs: Members | Resources | Help Board | Routes | Chat
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    Users, Package, HelpCircle, Map, MessageSquare,
    ArrowLeft, Plus, AlertTriangle, Loader2, Send, BookOpen,
    HandHeart, XCircle, CheckCircle2, Clock3
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { dispatchDataRefresh, shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';
import { API_BASE } from '../lib/apiBase';

const API = API_BASE;

const TABS = [
    { id: 'members', label: 'Members', icon: Users },
    { id: 'resources', label: 'Resources', icon: Package },
    { id: 'help', label: 'Help Board', icon: HelpCircle },
    { id: 'routes', label: 'Routes', icon: Map },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
];

const urgencyColor = { low: 'text-slate-500 bg-slate-50', normal: 'text-blue-600 bg-blue-50', urgent: 'text-orange-600 bg-orange-100' };
const statusColor = { open: 'text-green-700 bg-green-100', in_progress: 'text-blue-700 bg-blue-100', resolved: 'text-slate-600 bg-slate-100', expired: 'text-red-600 bg-red-50' };
const availColor = { available: 'text-green-700 bg-green-100', in_use: 'text-amber-700 bg-amber-100', unavailable: 'text-red-600 bg-red-50' };
const messageTypeStyle = {
    text: 'bg-slate-100 text-slate-500',
    help_request: 'bg-orange-100 text-orange-700',
    help_update: 'bg-orange-50 text-orange-700',
    resource_share: 'bg-blue-100 text-blue-700',
    resource_update: 'bg-blue-50 text-blue-700',
    route_share: 'bg-emerald-100 text-emerald-700',
    route_update: 'bg-emerald-50 text-emerald-700',
    alert: 'bg-rose-100 text-rose-700',
};

const messageTypeLabel = {
    text: 'chat',
    help_request: 'help',
    help_update: 'help update',
    resource_share: 'resource',
    resource_update: 'resource update',
    route_share: 'route',
    route_update: 'route update',
    alert: 'alert',
};

const routeTypeLabel = {
    mandi: 'Market / Mandi',
    bank: 'Town / Service',
};

function parseCommunityEvent(message = '') {
    const text = String(message || '');
    const lower = text.toLowerCase();

    if (lower.includes('posted a help request')) {
        return {
            kind: 'help',
            ctaLabel: 'Open Help Board',
            tab: 'help',
            accent: 'orange',
        };
    }
    if (lower.includes('responded to help request') || lower.includes('marked help request')) {
        return {
            kind: 'help',
            ctaLabel: 'Review Help',
            tab: 'help',
            accent: 'orange',
        };
    }
    if (lower.includes('shared a resource') || lower.includes('resource:')) {
        return {
            kind: 'resources',
            ctaLabel: 'Open Resources',
            tab: 'resources',
            accent: 'blue',
        };
    }
    if (lower.includes('shared a route') || lower.includes('route:')) {
        return {
            kind: 'routes',
            ctaLabel: 'Open Routes',
            tab: 'routes',
            accent: 'emerald',
        };
    }
    return null;
}

const CoopGroupDetail = () => {
    const { groupId } = useParams();
    const { session, user } = useAuth();
    const navigate = useNavigate();
    const token = session?.access_token;
    const currentFarmerId = user?.id || null;
    const headers = useMemo(
        () => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }),
        [token]
    );

    const [tab, setTab] = useState('help');
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    const [resources, setResources] = useState([]);
    const [helpRequests, setHelp] = useState([]);
    const [routes, setRoutes] = useState([]);
    const [messages, setMessages] = useState([]);
    const [responseMap, setResponseMap] = useState({});
    const [decisionNotes, setDecisionNotes] = useState({});
    const [expandedHelpId, setExpandedHelpId] = useState(null);
    const [chatMsg, setChatMsg] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [actionKey, setActionKey] = useState('');
    const [toast, setToast] = useState(null);

    useEffect(() => {
        if (!toast) return undefined;
        const timer = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        if (token && groupId) {
            fetchAll();
        }
    }, [token, groupId]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['community']) && token && groupId) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [token, groupId]);

    const showToast = (message) => setToast(message);

    const get = async (path) => {
        const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}${path}`, { headers });
        if (!response.ok) return [];
        return response.json();
    };

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [groupData, memberData, resourceData, helpData, routeData, messageData] = await Promise.all([
                get(''),
                get('/members'),
                get('/resources'),
                get('/help-requests'),
                get('/routes'),
                get('/messages'),
            ]);
            setGroup(groupData || null);
            setMembers(memberData || []);
            setResources(resourceData || []);
            setHelp(helpData || []);
            setRoutes(routeData || []);
            setMessages(messageData || []);
        } finally {
            setLoading(false);
        }
    };

    const fetchHelpResponses = async (requestId, force = false) => {
        if (!force && responseMap[requestId]) return;
        const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/help-requests/${requestId}/responses`, { headers });
        const payload = response.ok ? await response.json() : [];
        setResponseMap((prev) => ({ ...prev, [requestId]: payload }));
    };

    const sendChat = async (presetMessage = null, presetType = 'text') => {
        const outbound = (presetMessage ?? chatMsg).trim();
        if (!outbound) return;
        setSending(true);
        try {
            await fetch(`${API}/api/v1/cooperative/groups/${groupId}/messages`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ message: outbound, message_type: presetType }),
            });
            if (!presetMessage) setChatMsg('');
            await fetchAll();
            dispatchDataRefresh(['community']);
        } finally {
            setSending(false);
        }
    };

    const handleHelpDecision = async (requestId, decision) => {
        setActionKey(`help-${requestId}-${decision}`);
        try {
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/help-requests/${requestId}/decision`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    decision,
                    note: decisionNotes[requestId]?.trim() || null,
                }),
            });
            if (!response.ok) throw new Error('Failed to send help response');
            await Promise.all([fetchAll(), fetchHelpResponses(requestId, true)]);
            dispatchDataRefresh(['community', 'notifications']);
            showToast(decision === 'can_help' ? 'Response sent: you can help' : 'Response sent');
        } catch (error) {
            showToast(error.message || 'Failed to respond');
        } finally {
            setActionKey('');
        }
    };

    const markHelpResolved = async (requestId) => {
        setActionKey(`resolve-${requestId}`);
        try {
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/help-requests/${requestId}?status=resolved`, {
                method: 'PATCH',
                headers,
            });
            if (!response.ok) throw new Error('Failed to resolve request');
            await fetchAll();
            dispatchDataRefresh(['community', 'notifications']);
            showToast('Help request resolved');
        } catch (error) {
            showToast(error.message || 'Failed to resolve request');
        } finally {
            setActionKey('');
        }
    };

    const handleResourceDecision = async (resourceId, decision) => {
        setActionKey(`resource-${resourceId}-${decision}`);
        try {
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/resources/${resourceId}/decision`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    decision,
                    note: decisionNotes[resourceId]?.trim() || null,
                }),
            });
            if (!response.ok) throw new Error('Failed to respond to resource');
            await fetchAll();
            dispatchDataRefresh(['community', 'notifications']);
            showToast(decision === 'interested' ? 'Interest shared in group chat' : 'Response shared');
        } catch (error) {
            showToast(error.message || 'Failed to respond');
        } finally {
            setActionKey('');
        }
    };

    const handleRouteDecision = async (routeId, decision) => {
        setActionKey(`route-${routeId}-${decision}`);
        try {
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/routes/${routeId}/decision`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    decision,
                    note: decisionNotes[routeId]?.trim() || null,
                }),
            });
            if (!response.ok) throw new Error('Failed to respond to route');
            await fetchAll();
            dispatchDataRefresh(['community', 'notifications']);
            showToast(decision === 'join' ? 'Route response shared in chat' : 'Response shared');
        } catch (error) {
            showToast(error.message || 'Failed to respond');
        } finally {
            setActionKey('');
        }
    };

    const toggleHelpDetails = async (requestId) => {
        const nextId = expandedHelpId === requestId ? null : requestId;
        setExpandedHelpId(nextId);
        if (nextId) await fetchHelpResponses(requestId);
    };

    const recentActivity = messages.slice(-4).reverse();

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            {toast && (
                <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                    {toast}
                </div>
            )}

            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/community')} className="mb-3 flex items-center gap-1 text-sm text-white/80 hover:text-white">
                    <ArrowLeft className="w-4 h-4" /> Community
                </button>
                <h1 className="truncate text-xl font-bold">{group?.name || 'Loading…'}</h1>
                {group && (
                    <p className="mt-0.5 text-xs text-white/70">{group.district} • {group.member_count} members</p>
                )}
            </header>

            <div className="px-4 pt-4">
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Members</p>
                        <p className="mt-2 text-xl font-extrabold text-slate-800">{group?.member_count || members.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Open Help</p>
                        <p className="mt-2 text-xl font-extrabold text-orange-600">{helpRequests.filter((item) => item.status !== 'resolved').length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Shared</p>
                        <p className="mt-2 text-xl font-extrabold text-slate-800">{resources.length + routes.length}</p>
                    </div>
                </div>
            </div>

            <main className="flex-1 p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                    </div>
                ) : (
                    <>
                        <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Actions</p>
                                    <h2 className="mt-1 text-base font-bold text-slate-800">Post once, update the whole group</h2>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <Link to={`/community/create-help?groupId=${groupId}`} className="rounded-2xl bg-orange-50 px-3 py-3 text-center">
                                    <HelpCircle className="mx-auto mb-1.5 h-4 w-4 text-orange-600" />
                                    <span className="text-[11px] font-bold text-orange-700">Need Help</span>
                                </Link>
                                <Link to={`/community/add-resource?groupId=${groupId}`} className="rounded-2xl bg-blue-50 px-3 py-3 text-center">
                                    <Package className="mx-auto mb-1.5 h-4 w-4 text-blue-600" />
                                    <span className="text-[11px] font-bold text-blue-700">Resource</span>
                                </Link>
                                <Link to={`/community/add-route?groupId=${groupId}`} className="rounded-2xl bg-emerald-50 px-3 py-3 text-center">
                                    <Map className="mx-auto mb-1.5 h-4 w-4 text-emerald-600" />
                                    <span className="text-[11px] font-bold text-emerald-700">Route</span>
                                </Link>
                                <button onClick={() => navigate('/blog')} className="rounded-2xl bg-indigo-50 px-3 py-3 text-center">
                                    <BookOpen className="mx-auto mb-1.5 h-4 w-4 text-indigo-600" />
                                    <span className="text-[11px] font-bold text-indigo-700">Updates</span>
                                </button>
                            </div>
                        </section>

                        <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recent Group Activity</p>
                                    <h2 className="mt-1 text-sm font-bold text-slate-800">Board and chat stay in sync</h2>
                                </div>
                                <button onClick={() => setTab('chat')} className="text-xs font-semibold text-green-700">
                                    Open chat
                                </button>
                            </div>
                            <div className="space-y-2">
                                {recentActivity.length === 0 ? (
                                    <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                                        No activity yet. Post a help request, resource, or route to start.
                                    </div>
                                ) : (
                                    recentActivity.map((message) => (
                                        <div key={message.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700">{message.farmers?.full_name || 'Member'}</span>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${messageTypeStyle[message.message_type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {messageTypeLabel[message.message_type] || message.message_type}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700">{message.message}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>

                        <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
                            {TABS.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setTab(item.id)}
                                        className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                                            tab === item.id ? 'bg-green-600 text-white shadow-sm' : 'border border-slate-100 bg-white text-slate-500'
                                        }`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>

                        {tab === 'members' && (
                            <div className="mt-3 space-y-2">
                                {members.map((member, index) => (
                                    <div key={index} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-green-100">
                                            <span className="text-sm font-bold text-green-700">
                                                {member.farmers?.full_name?.[0] || '?'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">{member.farmers?.full_name}</p>
                                            <p className="text-xs text-slate-500">{member.farmers?.district}{member.farmers?.village ? ` • ${member.farmers.village}` : ''}</p>
                                        </div>
                                        {member.role === 'admin' && (
                                            <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Admin</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {tab === 'resources' && (
                            <div className="mt-3 space-y-3">
                                <Link
                                    to={`/community/add-resource?groupId=${groupId}`}
                                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500 transition-colors hover:bg-slate-50"
                                >
                                    <Plus className="h-4 w-4" /> Share a resource
                                </Link>
                                {resources.length === 0 && (
                                    <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-500">
                                        No shared resources yet. Add a tractor, sprayer, transport option, or storage space.
                                    </div>
                                )}
                                {resources.map((resource) => {
                                    const ownPost = resource.farmer_id === currentFarmerId;
                                    return (
                                        <div key={resource.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800">{resource.title}</p>
                                                    <p className="mt-0.5 text-xs capitalize text-slate-500">{resource.resource_type}{resource.quantity ? ` • ${resource.quantity}` : ''}</p>
                                                    {resource.cost_per_use && <p className="mt-1 text-xs font-medium text-green-700">💰 {resource.cost_per_use}</p>}
                                                    {resource.description && <p className="mt-1 text-xs text-slate-400">{resource.description}</p>}
                                                </div>
                                                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${availColor[resource.availability_status] || 'bg-slate-100 text-slate-600'}`}>
                                                    {resource.availability_status?.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-[11px] text-slate-400">by {resource.farmers?.full_name || 'Member'}</p>
                                            {!ownPost && (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={decisionNotes[resource.id] || ''}
                                                        onChange={(event) => setDecisionNotes((prev) => ({ ...prev, [resource.id]: event.target.value }))}
                                                        placeholder="Optional note for the owner"
                                                        className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                    />
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResourceDecision(resource.id, 'interested')}
                                                            disabled={actionKey === `resource-${resource.id}-interested`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                                                        >
                                                            {actionKey === `resource-${resource.id}-interested` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandHeart className="h-3.5 w-3.5" />}
                                                            I Need This
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResourceDecision(resource.id, 'pass')}
                                                            disabled={actionKey === `resource-${resource.id}-pass`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
                                                        >
                                                            {actionKey === `resource-${resource.id}-pass` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                            Not Now
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {tab === 'help' && (
                            <div className="mt-3 space-y-3">
                                <Link
                                    to={`/community/create-help?groupId=${groupId}`}
                                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-100"
                                >
                                    <Plus className="h-4 w-4" /> Post a help request
                                </Link>
                                {helpRequests.length === 0 && (
                                    <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-500">
                                        No help requests yet. Use the help board for labour, tools, transport, or advice.
                                    </div>
                                )}
                                {helpRequests.map((request) => {
                                    const ownRequest = request.farmer_id === currentFarmerId;
                                    const responses = responseMap[request.id] || [];
                                    const isExpanded = expandedHelpId === request.id;
                                    return (
                                        <div key={request.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${request.urgency === 'urgent' ? 'border-orange-200' : 'border-slate-100'}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-slate-800">{request.title}</p>
                                                    <p className="mt-0.5 text-xs capitalize text-slate-500">{request.category?.replace(/_/g, ' ')}</p>
                                                    {request.description && <p className="mt-1 text-xs text-slate-400">{request.description}</p>}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${urgencyColor[request.urgency]}`}>
                                                        {request.urgency}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor[request.status]}`}>
                                                        {request.status?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                                                <span>by {request.farmers?.full_name || 'Member'}</span>
                                                <span>•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleHelpDetails(request.id)}
                                                    className="font-semibold text-slate-500"
                                                >
                                                    {responses.length > 0 ? `${responses.length} responses` : 'Review responses'}
                                                </button>
                                            </div>

                                            {!ownRequest && request.status !== 'resolved' && (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={decisionNotes[request.id] || ''}
                                                        onChange={(event) => setDecisionNotes((prev) => ({ ...prev, [request.id]: event.target.value }))}
                                                        placeholder="Optional note for the requester"
                                                        className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-200"
                                                    />
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleHelpDecision(request.id, 'can_help')}
                                                            disabled={actionKey === `help-${request.id}-can_help`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                                                        >
                                                            {actionKey === `help-${request.id}-can_help` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandHeart className="h-3.5 w-3.5" />}
                                                            I Can Help
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleHelpDecision(request.id, 'cannot_help')}
                                                            disabled={actionKey === `help-${request.id}-cannot_help`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
                                                        >
                                                            {actionKey === `help-${request.id}-cannot_help` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                            Not This Time
                                                        </button>
                                                    </div>
                                                </>
                                            )}

                                            {ownRequest && request.status !== 'resolved' && (
                                                <button
                                                    type="button"
                                                    onClick={() => markHelpResolved(request.id)}
                                                    disabled={actionKey === `resolve-${request.id}`}
                                                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700 disabled:opacity-60"
                                                >
                                                    {actionKey === `resolve-${request.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    Mark Resolved
                                                </button>
                                            )}

                                            {isExpanded && (
                                                <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                                                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                        Responses
                                                    </div>
                                                    {responses.length === 0 ? (
                                                        <p className="text-xs text-slate-500">No member responses yet.</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {responses.map((response) => (
                                                                <div key={response.id} className="rounded-2xl bg-white px-3 py-2">
                                                                    <p className="text-xs font-semibold text-slate-700">{response.farmers?.full_name || 'Member'}</p>
                                                                    <p className="mt-1 text-xs text-slate-500">{response.message}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {tab === 'routes' && (
                            <div className="mt-3 space-y-3">
                                <Link
                                    to={`/community/add-route?groupId=${groupId}`}
                                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500 transition-colors hover:bg-slate-50"
                                >
                                    <Plus className="h-4 w-4" /> Share a route
                                </Link>
                                {routes.length === 0 && (
                                    <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-sm text-slate-500">
                                        No shared routes yet. Add a mandi trip, storage ride, or input pickup run.
                                    </div>
                                )}
                                {routes.map((route) => {
                                    const ownRoute = route.created_by === currentFarmerId;
                                    return (
                                        <div key={route.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                                            <p className="text-sm font-semibold text-slate-800">{route.route_name}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">→ {route.destination_name}{route.destination_type ? ` (${routeTypeLabel[route.destination_type] || route.destination_type})` : ''}</p>
                                            {route.frequency && <p className="mt-1 text-xs text-green-700">🗓 {route.frequency}</p>}
                                            {route.notes && <p className="mt-1 text-xs text-slate-400">{route.notes}</p>}
                                            <p className="mt-2 text-[11px] text-slate-400">by {route.farmers?.full_name || 'Member'}</p>
                                            {!ownRoute && (
                                                <>
                                                    <input
                                                        type="text"
                                                        value={decisionNotes[route.id] || ''}
                                                        onChange={(event) => setDecisionNotes((prev) => ({ ...prev, [route.id]: event.target.value }))}
                                                        placeholder="Optional note for the route owner"
                                                        className="mt-3 w-full rounded-2xl border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                                    />
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRouteDecision(route.id, 'join')}
                                                            disabled={actionKey === `route-${route.id}-join`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                                                        >
                                                            {actionKey === `route-${route.id}-join` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandHeart className="h-3.5 w-3.5" />}
                                                            I Can Join
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRouteDecision(route.id, 'pass')}
                                                            disabled={actionKey === `route-${route.id}-pass`}
                                                            className="flex items-center justify-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-60"
                                                        >
                                                            {actionKey === `route-${route.id}-pass` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                                            Not for Me
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {tab === 'chat' && (
                            <div className="mt-3 flex h-full flex-col">
                                <div className="mb-4 max-h-[55vh] flex-1 space-y-2 overflow-y-auto pr-1">
                                    {messages.map((message) => (
                                        <div key={message.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                                            <div className="mb-1 flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700">{message.farmers?.full_name || 'Member'}</span>
                                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${messageTypeStyle[message.message_type] || 'bg-slate-100 text-slate-600'}`}>
                                                    {messageTypeLabel[message.message_type] || message.message_type}
                                                </span>
                                                <span className="ml-auto text-[10px] text-slate-400">
                                                    {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700">{message.message}</p>
                                            {message.message_type === 'alert' && parseCommunityEvent(message.message) && (
                                                <div className="mt-3">
                                                    {(() => {
                                                        const event = parseCommunityEvent(message.message);
                                                        const eventStyle = {
                                                            orange: 'bg-orange-50 text-orange-700 border-orange-100',
                                                            blue: 'bg-blue-50 text-blue-700 border-blue-100',
                                                            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                                        };
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => setTab(event.tab)}
                                                                className={`rounded-xl border px-3 py-2 text-xs font-bold ${eventStyle[event.accent] || 'bg-slate-50 text-slate-700 border-slate-100'}`}
                                                            >
                                                                {event.ctaLabel}
                                                            </button>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {messages.length === 0 && (
                                        <div className="py-8 text-center text-sm text-slate-400">No messages yet — say hello!</div>
                                    )}
                                </div>
                                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                                    {[
                                        'Can two people help with loading tomorrow morning?',
                                        'I can lend my sprayer tomorrow afternoon.',
                                        'Anyone joining the mandi route on Friday?',
                                    ].map((prompt) => (
                                        <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => setChatMsg(prompt)}
                                            className="whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={chatMsg}
                                        onChange={(event) => setChatMsg(event.target.value)}
                                        onKeyDown={(event) => event.key === 'Enter' && sendChat()}
                                        placeholder="Type a message…"
                                        className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                                    />
                                    <button
                                        onClick={() => sendChat()}
                                        disabled={sending || !chatMsg.trim()}
                                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600 text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                                    >
                                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
