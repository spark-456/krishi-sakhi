import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Ticket, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';

const API = API_BASE;

const CATEGORIES = [
    'pest_emergency', 'soil_issue', 'irrigation_problem', 'market_dispute',
    'scheme_query', 'equipment_request', 'training_request', 'crop_advisory', 'general', 'other'
];

const CreateTicket = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ category: 'general', priority: 'medium', subject: '', description: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.subject || !form.description) { setError('Subject and description are required.'); return; }
        setSaving(true); setError('');
        try {
            const res = await fetch(`${API}/api/v1/tickets`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            navigate('/tickets');
        } catch { setError('Could not submit ticket. Try again.'); } finally { setSaving(false); }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-10">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/tickets')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> My Tickets
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">New Ticket</h1>
                        <p className="text-xs text-white/70">Get help from your extension worker</p>
                    </div>
                </div>
            </header>

            <main className="p-5 space-y-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Category</label>
                        <select value={form.category} onChange={e => set('category', e.target.value)}
                            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white capitalize">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Priority</label>
                        <div className="grid grid-cols-4 gap-2">
                            {['low', 'medium', 'high', 'critical'].map(p => (
                                <button key={p} onClick={() => set('priority', p)}
                                    className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${form.priority === p ? 'bg-green-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Subject *</label>
                        <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief title for your issue"
                            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Description *</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4}
                            placeholder="Describe your problem in detail..."
                            className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none" />
                    </div>
                </div>

                {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-2xl p-3">{error}</p>}

                <button onClick={handleSubmit} disabled={saving}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 transition-all">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Ticket className="w-5 h-5" />}
                    {saving ? 'Submitting…' : 'Submit Ticket'}
                </button>
            </main>
        </div>
    );
};

export default CreateTicket;
