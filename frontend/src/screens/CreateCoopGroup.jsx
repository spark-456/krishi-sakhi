import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const CreateCoopGroup = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', description: '', state: '', district: '', block: '', village: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name || !form.state || !form.district) {
            setError('Name, state, and district are required.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`${API}/api/v1/cooperative/groups`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error('Failed');
            const g = await res.json();
            navigate(`/community/groups/${g.id}`);
        } catch {
            setError('Could not create group. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const Field = ({ label, field, placeholder, multiline }) => (
        <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{label}</label>
            {multiline ? (
                <textarea
                    value={form[field]} onChange={e => set(field, e.target.value)} placeholder={placeholder}
                    rows={3} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />
            ) : (
                <input
                    value={form[field]} onChange={e => set(field, e.target.value)} placeholder={placeholder}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
            )}
        </div>
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-10">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/community')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Community
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Create Group</h1>
                        <p className="text-xs text-white/70">Start a cooperative in your area</p>
                    </div>
                </div>
            </header>

            <main className="p-5 space-y-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
                    <Field label="Group Name *" field="name" placeholder="e.g. Coimbatore Paddy Farmers" />
                    <Field label="Description" field="description" placeholder="What is this group about?" multiline />
                    <Field label="State *" field="state" placeholder="e.g. Tamil Nadu" />
                    <Field label="District *" field="district" placeholder="e.g. Coimbatore" />
                    <Field label="Block" field="block" placeholder="Optional" />
                    <Field label="Village" field="village" placeholder="Optional" />
                </div>

                {error && <p className="text-red-600 text-sm text-center bg-red-50 rounded-2xl p-3">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                    {saving ? 'Creating…' : 'Create Group'}
                </button>
            </main>
        </div>
    );
};

export default CreateCoopGroup;
