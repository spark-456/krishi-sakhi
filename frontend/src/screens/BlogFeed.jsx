/**
 * BlogFeed — Farmer-side KVK updates feed
 * Filterable by category, taps to full reader
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Tag, ChevronRight, Loader2, Newspaper, TrendingUp, CloudLightning, Bug, Award, GraduationCap, Megaphone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

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

const BlogFeed = () => {
    const { session } = useAuth();
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
                        <Link
                            key={post.id}
                            to={`/blog/${post.id}`}
                            className="block bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all overflow-hidden"
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
                                </div>
                                <h2 className="font-bold text-slate-800 text-base leading-snug">{post.title}</h2>
                                {post.summary && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{post.summary}</p>}
                                <div className="flex items-center justify-between mt-3">
                                    <p className="text-[11px] text-slate-400">
                                        {post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                        {post.view_count > 0 && <span className="ml-2">· {post.view_count} views</span>}
                                    </p>
                                    <ChevronRight className="w-4 h-4 text-slate-300" />
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </main>
        </div>
    );
};

export default BlogFeed;
