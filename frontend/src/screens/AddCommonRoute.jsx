import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const AddCommonRoute = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const groupId = new URLSearchParams(location.search).get('groupId');

    const [formData, setFormData] = useState({
        route_name: '',
        destination_type: 'market',
        destination_name: '',
        frequency: 'weekly',
        notes: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupId) {
            setError('Group ID is missing.');
            return;
        }
        if (!formData.route_name.trim() || !formData.destination_name.trim()) {
            setError('Please fill in all required fields.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const res = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/routes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Failed to create route');
            navigate(`/community/groups/${groupId}`);
        } catch (err) {
            console.error(err);
            setError('Failed to share route. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-6 pt-10 pb-6 text-white rounded-b-[2rem] shadow-md relative z-10">
                <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors mb-4 backdrop-blur-sm">
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                        <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Share Route</h1>
                        <p className="text-white/80 text-sm mt-0.5">Pool transport to save costs</p>
                    </div>
                </div>
            </header>

            <main className="px-6 py-6 -mt-3 relative z-20">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-start gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Route Name <span className="text-red-500">*</span></label>
                            <input type="text"
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                                placeholder="e.g., Weekly Mandi Trip"
                                value={formData.route_name} onChange={e => setFormData({ ...formData, route_name: e.target.value })}
                                required />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Destination Type</label>
                            <select className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 bg-white transition-all outline-none text-sm appearance-none"
                                value={formData.destination_type} onChange={e => setFormData({ ...formData, destination_type: e.target.value })}>
                                <option value="market">Market / Mandi</option>
                                <option value="storage">Storage / Cold Room</option>
                                <option value="supplier">Seed / Fertilizer Supplier</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Destination Name <span className="text-red-500">*</span></label>
                            <input type="text"
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                                placeholder="e.g., APMC Yard, City X"
                                value={formData.destination_name} onChange={e => setFormData({ ...formData, destination_name: e.target.value })}
                                required />
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Frequency</label>
                            <input type="text"
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm"
                                placeholder="e.g., Every Tuesday morning"
                                value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Additional Notes</label>
                            <textarea rows="3"
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm resize-none"
                                placeholder="e.g., I have an empty pickup truck, looking for 2 more people to share fuel costs."
                                value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                        </div>
                    </div>

                    <button type="submit" disabled={submitting}
                        className="w-full py-4 rounded-2xl font-bold flex flex-col items-center justify-center bg-primary hover:bg-primary/90 text-white shadow-lg disabled:opacity-70 disabled:scale-100 transition-all active:scale-[0.98]">
                        {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Share Route</span>}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default AddCommonRoute;