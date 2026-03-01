/**
 * HomeDashboard — Main Dashboard Screen
 * ──────────────────────────────────────
 * Shows farmer greeting (from DB), weather summary, quick actions,
 * and farm overview. Loads farmer name dynamically from Supabase.
 *
 * @see frontend-engineer.md §2 — Route: /dashboard, Auth: Yes
 */
import React, { useState, useEffect } from 'react';
import { Bell, CloudSun, Droplet, Wind, MapPin, Search, PlusCircle, ArrowRight, Activity, ThermometerSun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const HomeDashboard = () => {
    const { user } = useAuth();
    const [farmerName, setFarmerName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [farmData, setFarmData] = useState(null);

    useEffect(() => {
        if (user?.id) {
            fetchFarmerData();
        }
    }, [user?.id]);

    const fetchFarmerData = async () => {
        setIsLoading(true);
        try {
            // Fetch farmer profile
            const { data: farmer, error: farmerError } = await supabase
                .from('farmers')
                .select('full_name, district, state')
                .eq('id', user.id)
                .single();

            if (!farmerError && farmer) {
                setFarmerName(farmer.full_name);
            }

            // Fetch latest farm
            const { data: farm, error: farmError } = await supabase
                .from('farms')
                .select('farm_name, area_acres, soil_type, irrigation_type')
                .eq('farmer_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!farmError && farm) {
                setFarmData(farm);
            }
        } catch (err) {
            console.error('[HomeDashboard] Error fetching farmer data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    // Get time-aware greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning,';
        if (hour < 17) return 'Good Afternoon,';
        return 'Good Evening,';
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* App Bar & Weather Header */}
            <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-md relative overflow-hidden">
                {/* Decorative background shapes */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl transform -translate-x-5 translate-y-5" />

                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div>
                        <p className="text-white/80 text-sm font-medium">{getGreeting()}</p>
                        {isLoading ? (
                            <div className="h-7 w-40 bg-white/20 rounded-lg animate-pulse mt-1" />
                        ) : (
                            <h1 className="text-2xl font-bold tracking-tight">{farmerName || 'Farmer'}</h1>
                        )}
                    </div>
                    <button className="relative p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
                        <Bell className="w-5 h-5 text-white" />
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-primary" />
                    </button>
                </div>

                {/* Selected Farm & Weather Card */}
                <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-4 relative z-10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-white/80" />
                            {isLoading ? (
                                <div className="h-4 w-28 bg-white/20 rounded animate-pulse" />
                            ) : (
                                <span className="font-semibold text-sm">
                                    {farmData?.farm_name || 'My Farm'}
                                </span>
                            )}
                        </div>
                        <Link to="/farms" className="text-xs font-medium bg-white/20 px-3 py-1 rounded-full hover:bg-white/30 transition-colors">
                            Change
                        </Link>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CloudSun className="w-12 h-12 text-yellow-300" />
                            <div>
                                <h2 className="text-3xl font-bold">28°C</h2>
                                <p className="text-sm text-white/90 font-medium">Partly Cloudy</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-right">
                            <div className="flex items-center justify-end gap-2 text-sm">
                                <span className="text-white/80 font-medium">Humidity</span>
                                <Droplet className="w-3.5 h-3.5 text-blue-200" />
                                <span className="font-bold">65%</span>
                            </div>
                            <div className="flex items-center justify-end gap-2 text-sm">
                                <span className="text-white/80 font-medium">Wind</span>
                                <Wind className="w-3.5 h-3.5 text-blue-200" />
                                <span className="font-bold">12km/h</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-5 space-y-6">

                {/* Global Search Bar */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Ask Sakhi, search crops, or find solutions..."
                        className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all"
                    />
                </div>

                {/* Quick Actions Grid */}
                <section>
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Add Farm', icon: PlusCircle, color: 'bg-emerald-100 text-emerald-600', link: '/add-farm' },
                            { label: 'Disease Scan', icon: Activity, color: 'bg-rose-100 text-rose-600', link: '/camera' },
                            { label: 'Weather', icon: ThermometerSun, color: 'bg-amber-100 text-amber-600', link: '#' },
                            { label: 'Ask Sakhi', icon: Search, color: 'bg-indigo-100 text-indigo-600', link: '/assistant' },
                        ].map((action, idx) => (
                            <Link key={idx} to={action.link} className="flex flex-col items-center gap-2 group">
                                <div className={`p-4 rounded-2xl ${action.color} group-hover:scale-105 transition-transform shadow-sm`}>
                                    <action.icon className="w-6 h-6" />
                                </div>
                                <span className="text-[11px] font-semibold text-slate-700 text-center leading-tight">
                                    {action.label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* AI Assistant Banner */}
                <section>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100 shadow-sm relative overflow-hidden flex items-center justify-between">
                        <div className="relative z-10 w-2/3">
                            <h3 className="text-green-800 font-bold mb-1 tracking-tight">Need expert advice?</h3>
                            <p className="text-green-600/80 text-xs font-medium mb-3">Ask Sakhi about fertilizers, crop diseases, and best practices.</p>
                            <Link to="/assistant" className="inline-flex items-center gap-1.5 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm shadow-green-600/20">
                                Chat Now <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                        {/* Mascot Placeholder */}
                        <div className="absolute right-0 bottom-0 w-32 h-32 bg-green-200 rounded-full blur-2xl opacity-50 block" />
                        <div className="relative z-10 flex-shrink-0 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                            <span className="text-3xl">👩🏽‍🌾</span>
                        </div>
                    </div>
                </section>

                {/* Farm Overview Dashboard Cards */}
                <section>
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-lg font-bold text-slate-800">Farm Overview</h3>
                        <Link to="/farms" className="text-primary text-sm font-semibold hover:underline">View All</Link>
                    </div>

                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        {isLoading ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="flex justify-between">
                                    <div className="space-y-2 w-1/2">
                                        <div className="h-3 w-24 bg-slate-200 rounded" />
                                        <div className="h-5 w-32 bg-slate-200 rounded" />
                                    </div>
                                    <div className="space-y-2 w-1/3 items-end flex flex-col">
                                        <div className="h-3 w-16 bg-slate-200 rounded" />
                                        <div className="h-5 w-20 bg-slate-200 rounded" />
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <div className="h-3 w-20 bg-slate-200 rounded" />
                                        <div className="h-4 w-28 bg-slate-200 rounded" />
                                    </div>
                                    <div className="space-y-2 pl-4 border-l border-slate-100">
                                        <div className="h-3 w-20 bg-slate-200 rounded" />
                                        <div className="h-4 w-16 bg-slate-200 rounded" />
                                    </div>
                                </div>
                            </div>
                        ) : farmData ? (
                            <>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">Your Farm</p>
                                        <h4 className="text-lg font-bold text-slate-800">{farmData.farm_name || 'My Farm'}</h4>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-medium text-slate-500">Area</p>
                                        <span className="inline-block bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-md mt-0.5">
                                            {farmData.area_acres ? `${farmData.area_acres} acres` : 'Not set'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 mb-1">Soil Type</p>
                                        <p className="text-sm font-semibold text-slate-700 capitalize">
                                            {farmData.soil_type || 'Not yet scanned'}
                                        </p>
                                    </div>
                                    <div className="border-l border-slate-100 pl-4">
                                        <p className="text-xs font-medium text-slate-500 mb-1">Irrigation</p>
                                        <p className="text-sm font-semibold text-slate-700 capitalize">
                                            {farmData.irrigation_type || 'Not set'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <span className="text-4xl">🌱</span>
                                <p className="font-semibold text-slate-700">No farms yet</p>
                                <p className="text-sm text-slate-500">Add your first farm to get started</p>
                                <Link to="/add-farm" className="text-primary text-sm font-semibold underline">Add Farm</Link>
                            </div>
                        )}
                    </div>
                </section>

            </main>
        </div>
    );
};

export default HomeDashboard;
