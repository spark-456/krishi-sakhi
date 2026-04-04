/**
 * HomeDashboard — Main Dashboard
 * ──────────────────────────────
 * MIMIC_DEV: Fetches farmer data from localDB.
 * Shows greeting, weather placeholder, farm overview.
 *
 * @see localDB.js — farmers, farms tables
 */
import React, { useState, useEffect } from 'react';
import { CloudSun, TrendingUp, Droplets, Leaf, ChevronRight, Loader2, Sprout, MessageSquare, Camera, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const HomeDashboard = () => {
    const { user } = useAuth();
    const [farmer, setFarmer] = useState(null);
    const [farms, setFarms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user?.id) fetchData();
    }, [user?.id]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: farmerData } = await supabase
                .from('farmers')
                .select('*')
                .eq('id', user.id)
                .single();
            if (farmerData) setFarmer(farmerData);

            const { data: farmData } = await supabase
                .from('farms')
                .select('*')
                .eq('farmer_id', user.id);
            if (farmData) setFarms(farmData);
        } catch (err) {
            console.error('[Dashboard] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const totalAcres = farms.reduce((sum, f) => sum + (parseFloat(f.area_acres) || 0), 0);

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
                <header className="bg-primary px-6 py-6 text-primary-foreground shadow-md rounded-b-3xl">
                    <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-white/20 rounded w-1/3" />
                        <div className="h-6 bg-white/20 rounded w-2/3" />
                    </div>
                </header>
                <main className="flex-1 p-5 space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
                    ))}
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-primary px-6 py-6 text-primary-foreground shadow-md rounded-b-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />
                <p className="text-sm text-white/80 font-medium">{getGreeting()} 👋</p>
                <h1 className="text-2xl font-bold tracking-tight mt-1">{farmer?.full_name || 'Farmer'}</h1>
                <p className="text-xs text-white/60 mt-1">
                    {[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Location not set'}
                </p>
            </header>

            {/* Content */}
            <main className="flex-1 p-5 space-y-5 -mt-2">
                {/* Weather Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Today's Weather</h3>
                        <CloudSun className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-800">32°</p>
                            <p className="text-xs text-slate-500">Temperature</p>
                        </div>
                        <div className="text-center border-x border-slate-100">
                            <p className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1"><Droplets className="w-4 h-4" />75%</p>
                            <p className="text-xs text-slate-500">Humidity</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-emerald-600">2mm</p>
                            <p className="text-xs text-slate-500">Rainfall</p>
                        </div>
                    </div>
                </div>

                {/* Farm Overview */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Farm Overview</h3>
                        <Link to="/farms" className="text-primary text-xs font-semibold flex items-center gap-1">
                            View All <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {farms.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-50 rounded-xl p-3">
                                <Sprout className="w-5 h-5 text-green-600 mb-1" />
                                <p className="text-xl font-bold text-slate-800">{farms.length}</p>
                                <p className="text-xs text-slate-500">Farms</p>
                            </div>
                            <div className="bg-blue-50 rounded-xl p-3">
                                <TrendingUp className="w-5 h-5 text-blue-600 mb-1" />
                                <p className="text-xl font-bold text-slate-800">{totalAcres}</p>
                                <p className="text-xs text-slate-500">Total Acres</p>
                            </div>
                        </div>
                    ) : (
                        <Link to="/add-farm" className="block p-4 bg-slate-50 rounded-xl text-center border border-dashed border-slate-200 hover:bg-slate-100 transition-colors">
                            <Sprout className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-600">Add Your First Farm</p>
                        </Link>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Link to="/assistant" className="flex items-center gap-3 p-3 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Ask Sakhi</p>
                                <p className="text-[10px] text-slate-500">Get advice</p>
                            </div>
                        </Link>
                        <Link to="/camera" className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Camera className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Scan Crop</p>
                                <p className="text-[10px] text-slate-500">Disease check</p>
                            </div>
                        </Link>
                        <Link to="/farms" className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Leaf className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">My Farms</p>
                                <p className="text-[10px] text-slate-500">Manage crops</p>
                            </div>
                        </Link>
                        <Link to="/activity" className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Activity</p>
                                <p className="text-[10px] text-slate-500">Farm logs</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HomeDashboard;
