/**
 * AdminBlogEditor — Create / Edit blog posts
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, Send, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../lib/apiBase';

const API = API_BASE;

const CATEGORIES = ['government_scheme','market_update','weather_advisory','pest_alert','best_practice','training','announcement','other'];

const AdminBlogEditor = () => {
    const { postId } = useParams(); // if editing existing
    const { session } = useAuth();
    const navigate = useNavigate();
    const isEdit = Boolean(postId);

    const [form, setForm] = useState({
        title: '', summary: '', content: '',
        category: 'government_scheme', tags: '',
        target_district: '', target_state: '', cover_image_url: '',
    });
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const headers = { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        if (isEdit && session?.access_token) {
            fetch(`${API}/api/v1/admin/blog/${postId}`, { headers })
                .then(r => r.json())
                .then(d => {
                    setForm({
                        title: d.title || '', summary: d.summary || '', content: d.content || '',
                        category: d.category || 'other', tags: (d.tags || []).join(', '),
                        target_district: d.target_district || '', target_state: d.target_state || '',
                        cover_image_url: d.cover_image_url || '',
                    });
                })
                .finally(() => setLoading(false));
        }
    }, [postId, session]);

    const save = async (publish = false) => {
        if (!form.title || !form.content) { setError('Title and content are required.'); return; }
        publish ? setPublishing(true) : setSaving(true);
        setError('');
        try {
            const payload = {
                ...form,
                tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
                target_district: form.target_district || null,
                target_state: form.target_state || null,
                cover_image_url: form.cover_image_url || null,
            };
            let res, data;
            if (isEdit) {
                res = await fetch(`${API}/api/v1/admin/blog/${postId}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
            } else {
                res = await fetch(`${API}/api/v1/admin/blog`, { method: 'POST', headers, body: JSON.stringify(payload) });
            }
            data = await res.json();
            if (publish) {
                await fetch(`${API}/api/v1/admin/blog/${data.id}/publish`, { method: 'POST', headers });
            }
            navigate('/admin/blog');
        } catch { setError('Failed to save. Try again.'); } finally { setSaving(false); setPublishing(false); }
    };

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-10">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/admin/blog')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Blog
                </button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-white/80" />
                        <h1 className="text-xl font-bold">{isEdit ? 'Edit Post' : 'New Post'}</h1>
                    </div>
                    <button onClick={() => setPreview(p => !p)} className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-xl transition-colors">
                        {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {preview ? 'Edit' : 'Preview'}
                    </button>
                </div>
            </header>

            {preview ? (
                <main className="p-5">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                        <h1 className="text-xl font-extrabold text-slate-900">{form.title || 'Untitled'}</h1>
                        {form.summary && <p className="text-slate-500 mt-2 text-sm">{form.summary}</p>}
                        <p className="text-xs text-slate-400 mt-2 capitalize">{form.category?.replace(/_/g,' ')}</p>
                        <div className="mt-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{form.content}</div>
                    </div>
                </main>
            ) : (
                <main className="p-5 space-y-3">
                    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Title *</label>
                            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Post title"
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Summary</label>
                            <input value={form.summary} onChange={e => set('summary', e.target.value)} placeholder="Short teaser shown in feed"
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Category</label>
                            <select value={form.category} onChange={e => set('category', e.target.value)}
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white capitalize">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Content *</label>
                            <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={10}
                                placeholder="Full post content (markdown supported in future)"
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Tags (comma-separated)</label>
                            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="paddy, kharif, tamil_nadu"
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Target District</label>
                                <input value={form.target_district} onChange={e => set('target_district', e.target.value)} placeholder="All districts"
                                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Target State</label>
                                <input value={form.target_state} onChange={e => set('target_state', e.target.value)} placeholder="All states"
                                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-2xl p-3">{error}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => save(false)} disabled={saving || publishing}
                            className="bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Save Draft
                        </button>
                        <button onClick={() => save(true)} disabled={saving || publishing}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-all">
                            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Publish
                        </button>
                    </div>
                </main>
            )}
        </div>
    );
};

export default AdminBlogEditor;
