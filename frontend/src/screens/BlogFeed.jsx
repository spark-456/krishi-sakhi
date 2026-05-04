/**
 * BlogFeed — Farmer-side KVK updates feed
 * Filterable by category, taps to full reader
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Loader2, Newspaper, TrendingUp, CloudLightning, Bug, Award, GraduationCap, Megaphone, MessageSquarePlus, Wrench } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';

const API = API_BASE;

const CATEGORIES = [
    { id: null,                label: 'All',          icon: BookOpen },
    { id: 'government_scheme', label: 'Schemes',      icon: Award },
    { id: 'market_update',     label: 'Market',       icon: TrendingUp },
    { id: 'pest_alert',        label: 'Pest Alerts',  icon: Bug },
    { id: 'weather_advisory',  label: 'Weather',      icon: CloudLightning },
    { id: 'best_practice',     label: 'Practices',    icon: GraduationCap },
    { id: 'announcement',      label: 'Announcements',icon: Megaphone },
];

const categoryStyle = {
    government_scheme: 'bg-blue-50 text-blue-700',
    market_update:     'bg-green-50 text-green-700',
    pest_alert:        'bg-orange-50 text-orange-700',
    weather_advisory:  'bg-sky-50 text-sky-700',
    best_practice:     'bg-emerald-50 text-emerald-700',
    announcement:      'bg-purple-50 text-purple-700',
    training:          'bg-indigo-50 text-indigo-700',
    other:             'bg-slate-50 text-slate-600',
};

const actionConfigForPost = (post) => {
    if (post.category === 'weather_advisory') {
        return {
            helper: 'Use today',
            route: '/assistant',
            state: {
                prefillMessage: `I read the weather update "${post.title}". What should I do on my farms today because of this?`,
            },
            icon: CloudLightning,
        };
    }
    if (post.category === 'pest_alert') {
        return {
            helper: 'Scan crop',
            route: '/camera',
            state: null,
            icon: Bug,
        };
    }
    if (post.category === 'market_update') {
        return {
            helper: 'Check profit',
            route: '/finance',
            state: null,
            icon: TrendingUp,
        };
    }
    if (post.category === 'government_scheme') {
        return {
            helper: 'Ask Sakhi',
            route: '/assistant',
            state: {
                prefillMessage: `Explain this scheme update to me in simple terms and tell me what I should prepare: "${post.title}"`,
            },
            icon: Award,
        };
    }
    return {
        helper: 'Use this',
        route: '/assistant',
        state: {
            prefillMessage: `I read this update: "${post.title}". Turn it into practical steps for my farm.`,
        },
        icon: Wrench,
    };
};

const BlogFeed = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);

    useEffect(() => { if (session?.access_token) fetchPosts(); }, [session, activeCategory]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const params = activeCategory ? `?category=${activeCategory}` : '';
            const res = await fetch(`${API}/api/v1/blog${params}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            setPosts(res.ok ? await res.json() : []);
        } finally { setLoading(false); }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            <header className="bg-primary px-6 pt-10 pb-8 text-white rounded-b-[2.5rem] shadow-lg">
                <div className="flex items-center gap-3 mb-1">
                    <Newspaper className="w-6 h-6 text-white/80" />
                    <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">KVK Updates</p>
                </div>
                <h1 className="text-2xl font-bold">Government & Field Updates</h1>
                <p className="text-sm text-white/70 mt-1">Latest schemes, alerts & best practices</p>
            </header>

            {/* Category Filter */}
            <div className="flex gap-2 px-4 pt-4 pb-2 overflow-x-auto no-scrollbar">
                {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    return (
                        <button
                            key={c.id ?? 'all'}
                            onClick={() => setActiveCategory(c.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 border ${
                                activeCategory === c.id
                                    ? 'bg-green-600 text-white border-green-700 shadow-sm'
                                    : 'bg-white text-slate-500 border-slate-100'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {c.label}
                        </button>
                    );
                })}
            </div>

            <main className="p-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                        <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-600 font-semibold">No updates yet</p>
                        <p className="text-slate-400 text-sm mt-1">Check back soon</p>
                    </div>
                ) : (
                    posts.map(post => (
                        <div
                            key={post.id}
                            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
                        >
                            {post.cover_image_url && (
                                <img src={post.cover_image_url} alt={post.title} className="w-full h-36 object-cover" />
                            )}
                            <div className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryStyle[post.category] || 'bg-slate-50 text-slate-600'}`}>
                                        {post.category?.replace(/_/g, ' ')}
                                    </span>
                                    {post.target_district && (
                                        <span className="text-[10px] text-slate-400 font-medium">{post.target_district}</span>
                                    )}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                        Actionable
                                    </span>
                                </div>
                                <Link to={`/blog/${post.id}`} className="block">
                                    <h2 className="font-bold text-slate-800 text-base leading-snug">{post.title}</h2>
                                </Link>
                                {post.summary && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{post.summary}</p>}
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[11px] text-slate-400">
                                        {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                        {post.view_count > 0 && <span className="ml-2">· {post.view_count} views</span>}
                                    </p>
                                    <Link to={`/blog/${post.id}`} className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1">
                                        Read <ChevronRight className="w-4 h-4 text-slate-300" />
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button
                                        onClick={() => navigate('/assistant', {
                                            state: {
                                                prefillMessage: `I just read this update: "${post.title}". Tell me what it means for my farm and what action I should take next.`,
                                            }
                                        })}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700"
                                    >
                                        <MessageSquarePlus className="w-3.5 h-3.5" />
                                        Ask Sakhi
                                    </button>
                                    <button
                                        onClick={() => {
                                            const action = actionConfigForPost(post);
                                            navigate(action.route, action.state ? { state: action.state } : undefined);
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2.5 text-xs font-bold text-slate-700"
                                    >
                                        {React.createElement(actionConfigForPost(post).icon, { className: 'w-3.5 h-3.5' })}
                                        {actionConfigForPost(post).helper}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};

export default BlogFeed;
