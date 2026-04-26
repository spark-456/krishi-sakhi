import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, PackagePlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const AddSharedResource = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const groupId = new URLSearchParams(location.search).get('groupId');

    const [formData, setFormData] = useState({
        title: '',
        resource_type: 'equipment',
        description: '',
        quantity: '1',
        cost_per_use: 'Free',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupId) {
            setError('Group ID is missing.');
            return;
        }
        if (!formData.title.trim()) {
            setError('Title is required.');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const r = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/resources`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}` 
                },
                body: JSON.stringify(formData)
            });
            if (!r.ok) throw new Error('Failed to add resource');
            navigate(`/community/groups/${groupId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-5 py-4 text-white shadow-sm flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold">Share Resource</h1>
            </header>

            <main className="flex-1 p-5">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                            <PackagePlus className="w-8 h-8 text-amber-500" />
                        </div>
                    </div>
                    <p className="text-center text-sm text-slate-500 mb-6">
                        Offer equipment, seeds, or facilities for others in your group to borrow or rent.
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 text-sm mb-4">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Resource Name <span className="text-red-500">*</span></label>
                            <input 
                                type="text"
                                placeholder="e.g., Water Pump (5HP)"
                                value={formData.title}
                                onChange={e => setFormData(p => ({...p, title: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type</label>
                                <select 
                                    value={formData.resource_type}
                                    onChange={e => setFormData(p => ({...p, resource_type: e.target.value}))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                >
                                    <option value="equipment">Equipment</option>
                                    <option value="seeds">Seeds / Supplies</option>
                                    <option value="vehicle">Vehicle / Transport</option>
                                    <option value="land">Land / Storage</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
                                <input 
                                    type="text"
                                    placeholder="e.g., 1"
                                    value={formData.quantity}
                                    onChange={e => setFormData(p => ({...p, quantity: e.target.value}))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cost / Conditions</label>
                            <input 
                                type="text"
                                placeholder="e.g., Free, ₹100/day, Fuel only"
                                value={formData.cost_per_use}
                                onChange={e => setFormData(p => ({...p, cost_per_use: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                            <textarea 
                                placeholder="Any specific instructions or details..."
                                value={formData.description}
                                onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 min-h-[100px]"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-4"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Share Resource'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AddSharedResource;
