import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Sprout, Leaf, MessageSquare, Ticket, Loader2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { API_BASE } from '../../lib/apiBase';

const API = API_BASE;

const AdminFarmerDetail = () => {
    const { farmerId } = useParams();
    const { session } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.access_token || !farmerId) return;
        fetchData();
    }, [session, farmerId]);

    const fetchData = async () => {
        try {
            const r = await fetch(`${API}/api/v1/admin/farmers/${farmerId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (r.ok) {
                setData(await r.json());
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>;
    }

    if (!data || !data.farmer) {
        return <div className="p-5 text-center mt-20">Farmer not found.</div>;
    }

    const { farmer, farms, crop_records, soil_scans, pest_scans, advisory_sessions, tickets } = data;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-5 py-4 text-white shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <button onClick={() => navigate('/admin/farmers')} className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h1 className="text-lg font-bold">Farmer Profile</h1>
            </header>

            <main className="p-4 space-y-4">
                {/* Profile Header */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{farmer.full_name}</h2>
                        <p className="text-sm text-slate-500 mt-1">{farmer.phone_number}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                            <MapPin className="w-3 h-3" /> {farmer.district}, {farmer.state}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                            <Sprout className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold uppercase">Farms</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{farms?.length || 0}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                            <Leaf className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold uppercase">Crops</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{crop_records?.length || 0}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                            <MessageSquare className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold uppercase">Advisory</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{advisory_sessions?.length || 0}</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-2 text-slate-500">
                            <Ticket className="w-4 h-4 text-purple-500" />
                            <span className="text-xs font-bold uppercase">Tickets</span>
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{tickets?.length || 0}</p>
                    </div>
                </div>

                {/* Scans Activity */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase">Recent Scans</h3>
                    <div className="space-y-2">
                        {soil_scans?.map(s => (
                            <div key={s.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">Soil</span>
                                <span className="text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                        {pest_scans?.map(s => (
                            <div key={s.id} className="flex justify-between items-center text-sm border-b border-slate-50 pb-2">
                                <span className="text-red-700 font-medium bg-red-50 px-2 py-0.5 rounded">Disease</span>
                                <span className="text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                        ))}
                        {(!soil_scans?.length && !pest_scans?.length) && (
                            <p className="text-xs text-slate-400">No recent scans.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminFarmerDetail;
