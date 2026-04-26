import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const categoryStyle = {
    government_scheme: 'bg-blue-50 text-blue-700',
    market_update:     'bg-green-50 text-green-700',
    pest_alert:        'bg-orange-50 text-orange-700',
    weather_advisory:  'bg-sky-50 text-sky-700',
    best_practice:     'bg-emerald-50 text-emerald-700',
    announcement:      'bg-purple-50 text-purple-700',
};

const BlogPostView = () => {
    const { postId } = useParams();
    const { session } = useAuth();
    const navigate = useNavigate();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (session?.access_token && postId) {
            fetch(`${API}/api/v1/blog/${postId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            })
                .then(r => r.json())
                .then(setPost)
                .finally(() => setLoading(false));
        }
    }, [postId, session]);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/blog')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Updates
                </button>
            </header>

            <main className="flex-1">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                    </div>
                ) : post ? (
                    <>
                        {post.cover_image_url && (
                            <img src={post.cover_image_url} alt={post.title} className="w-full h-52 object-cover" />
                        )}
                        <div className="p-5">
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${categoryStyle[post.category] || 'bg-slate-50 text-slate-600'}`}>
                                {post.category?.replace(/_/g, ' ')}
                            </span>
                            <h1 className="text-xl font-extrabold text-slate-900 mt-3 leading-tight">{post.title}</h1>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                                <span>{post.published_at ? new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</span>
                                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.view_count}</span>
                            </div>
                            <div className="mt-5 prose prose-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {post.content}
                            </div>
                            {post.tags?.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-6">
                                    {post.tags.map(t => (
                                        <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">#{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="text-center py-20 text-slate-400">Post not found.</p>
                )}
            </main>
        </div>
    );
};

export default BlogPostView;
