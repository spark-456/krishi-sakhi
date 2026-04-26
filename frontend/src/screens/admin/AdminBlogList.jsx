import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Plus, Loader2, Eye, EyeOff, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const categoryStyle = {
    government_scheme: 'bg-blue-50 text-blue-700', market_update: 'bg-green-50 text-green-700',
    pest_alert: 'bg-orange-50 text-orange-700', weather_advisory: 'bg-sky-50 text-sky-700',
    best_practice: 'bg-emerald-50 text-emerald-700', announcement: 'bg-purple-50 text-purple-700',
};

const AdminBlogList = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

    const fetchPosts = () => {
        setLoading(true);
        fetch(`${API}/api/v1/admin/blog`, { headers })
            .then(r => r.json()).then(setPosts).finally(() => setLoading(false));
    };

    useEffect(() => { if (session?.access_token) fetchPosts(); }, [session]);

    const togglePublish = async (post) => {
        if (!post.is_published) {
            await fetch(`${API}/api/v1/admin/blog/${post.id}/publish`, { method: 'POST', headers });
        } else {
            await fetch(`${API}/api/v1/admin/blog/${post.id}`, { method: 'PATCH', headers, body: JSON.stringify({ is_published: false }) });
        }
        fetchPosts();
    };

    const deletePost = async (id) => {
        if (!window.confirm('Delete this post?')) return;
        await fetch(`${API}/api/v1/admin/blog/${id}`, { method: 'DELETE', headers });
        fetchPosts();
    };

    const seedDemoPosts = async () => {
        setSeeding(true);
        try {
            await fetch(`${API}/api/v1/admin/blog/seed-demo`, { method: 'POST', headers });
            fetchPosts();
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Admin
                </button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-white/80" />
                        <h1 className="text-xl font-bold">Blog Posts</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={seedDemoPosts} disabled={seeding} className="bg-white/15 text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-white/20 disabled:opacity-60 transition-colors flex items-center gap-1.5">
                            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Seed Demo
                        </button>
                        <Link to="/admin/blog/new" className="bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-green-50 transition-colors flex items-center gap-1.5">
                            <Plus className="w-4 h-4" /> New
                        </Link>
                    </div>
                </div>
            </header>

            <main className="p-4 space-y-3">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-semibold">No posts yet</p>
                        <Link to="/admin/blog/new" className="mt-3 inline-block text-sm text-green-700 font-semibold">Write one →</Link>
                    </div>
                ) : (
                    posts.map(p => (
                        <div key={p.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${categoryStyle[p.category] || 'bg-slate-50 text-slate-600'}`}>
                                        {p.category?.replace(/_/g,' ')}
                                    </span>
                                    <p className="font-semibold text-sm text-slate-800 mt-1.5 truncate">{p.title}</p>
                                    {p.target_district && <p className="text-xs text-slate-400 mt-0.5">{p.target_district}</p>}
                                    <p className="text-[11px] text-slate-400 mt-1">{new Date(p.created_at).toLocaleDateString('en-IN')} • {p.view_count || 0} views</p>
                                </div>
                                <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {p.is_published ? 'Published' : 'Draft'}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-3">
                                <Link to={`/admin/blog/${p.id}/edit`} className="flex-1 text-center py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
                                    Edit
                                </Link>
                                <button onClick={() => togglePublish(p)} className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1 ${p.is_published ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                                    {p.is_published ? <><EyeOff className="w-3 h-3" /> Unpublish</> : <><Eye className="w-3 h-3" /> Publish</>}
                                </button>
                                <button onClick={() => deletePost(p.id)} className="w-10 flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </main>
        </div>
    );
};

export default AdminBlogList;
