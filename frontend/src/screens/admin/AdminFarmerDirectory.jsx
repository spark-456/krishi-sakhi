import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Search, ChevronRight, Loader2, MapPin, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const AdminFarmerDirectory = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const [farmers, setFarmers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!session?.access_token) return;
        fetchData();
    }, [session]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/v1/admin/farmers?limit=100`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (r.ok) {
                const data = await r.json();
                setFarmers(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filteredFarmers = farmers.filter(f => 
        f.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        f.phone_number?.includes(searchQuery) ||
        f.district?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-6">
            <header className="bg-primary px-5 pt-10 pb-5 text-white rounded-b-3xl shadow-md">
                <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-white/80 hover:text-white mb-3 text-sm">
                    <ArrowLeft className="w-4 h-4" /> Admin
                </button>
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-white/80" />
                    <div>
                        <h1 className="text-xl font-bold">Farmer Directory</h1>
                        <p className="text-xs text-green-200">{farmers.length} registered</p>
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="mt-4 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                    <input 
                        type="text"
                        placeholder="Search by name, phone, or district..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-white/50 focus:outline-none focus:bg-white/20 transition-colors"
                    />
                </div>
            </header>

            <main className="p-4 space-y-2">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-green-600" /></div>
                ) : filteredFarmers.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-semibold">No farmers found</p>
                    </div>
                ) : (
                    filteredFarmers.map(f => (
                        <Link key={f.id} to={`/admin/farmers/${f.id}`}
                            className="block bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all p-4 flex items-center justify-between">
                            <div>
                                <p className="font-bold text-sm text-slate-800">{f.full_name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{f.phone_number}</p>
                                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                                    <MapPin className="w-3 h-3" /> {f.district}, {f.state}
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300" />
                        </Link>
                    ))
                )}
            </main>
        </div>
    );
};

export default AdminFarmerDirectory;
