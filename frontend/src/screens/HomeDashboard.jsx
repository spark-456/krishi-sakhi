/**
 * HomeDashboard — Main Dashboard
 * ──────────────────────────────
 * Fetches farmer data from Supabase.
 * Shows greeting, weather placeholder, farm overview, and ML insights.
 *
 * @see supabaseClient.js — farmers, farms tables
 */
import React, { useState, useEffect } from 'react';
import { IndianRupee, CloudSun, TrendingUp, Droplets, Leaf, ChevronRight, Loader2, Sprout, MessageSquare, Camera, BookOpen, Bell, Sun, Calendar, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { getCropRecommendation, getPriceForecast, getWeather, getPublishedBlogs } from '../lib/backendClient';

const HomeDashboard = () => {
    const { user, session } = useAuth();
    const [farmer, setFarmer] = useState(null);
    const [farms, setFarms] = useState([]);
    const [activeCrop, setActiveCrop] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Additional Data States
    const [weather, setWeather] = useState(null);
    const [blogs, setBlogs] = useState([]);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);

    // ML States
    const [cropRec, setCropRec] = useState(null);
    const [isRecLoading, setIsRecLoading] = useState(false);

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
            
            const { data: cropData } = await supabase
                .from('crop_records')
                .select('*')
                .eq('farmer_id', user.id)
                .eq('status', 'active')
                .order('sowing_date', { ascending: false })
                .limit(1);
            if (cropData && cropData.length > 0) setActiveCrop(cropData[0]);
            
            // Fetch ML insights silently
            if (session?.access_token) {
                fetchMLInsights(session.access_token, farmData?.[0]?.id);
            }
        } catch (err) {
            console.error('[Dashboard] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // Market States
    const [priceForecast, setPriceForecast] = useState(null);
    const [isPriceLoading, setIsPriceLoading] = useState(false);

    const fetchMLInsights = async (token, primaryFarmId) => {
        setIsRecLoading(true);
        setIsPriceLoading(true);
        setIsWeatherLoading(true);
        try {
            // Fetch Weather and KVK Blogs in parallel
            Promise.allSettled([
                getWeather({ token }).then(setWeather),
                getPublishedBlogs({ token, limit: 2 }).then((data) => setBlogs(data?.posts || []))
            ]).finally(() => setIsWeatherLoading(false));
            const rec = await getCropRecommendation({ farmId: primaryFarmId, token });
            setCropRec(rec);
            
            if (rec && rec.top_recommendation) {
                const price = await getPriceForecast({ crop: rec.top_recommendation, horizon: 7, token });
                setPriceForecast(price);
            }
        } catch (err) {
            console.error('Failed to load ML insights:', err);
        } finally {
            setIsRecLoading(false);
            setIsPriceLoading(false);
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getGrowthProgress = (crop) => {
        if (!crop?.sowing_date) return 0;
        const start = new Date(crop.sowing_date);
        const now = new Date();
        const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        const estHarvestDays = 120; // fallback avg
        return {
            percent: Math.min(Math.max((days / estHarvestDays) * 100, 0), 100),
            days: days
        };
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
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-20">
            {/* Header */}
            <header className="bg-primary px-6 pt-8 pb-10 text-primary-foreground shadow-md rounded-b-[2.5rem] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />
                <p className="text-sm text-white/80 font-medium">{getGreeting()} 👋</p>
                <h1 className="text-2xl font-bold tracking-tight mt-1">{farmer?.full_name || 'Farmer'}</h1>
                <p className="text-xs text-white/60 mt-1">
                    {[farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Location not set'}
                </p>
            </header>

            {/* Content */}
            <main className="flex-1 p-5 space-y-5 -mt-6 relative z-10">
                {/* ML Recommendation Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 rounded-3xl shadow-lg border border-emerald-400/30 p-6 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Leaf className="w-24 h-24" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3 opacity-90">
                            <Sprout className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-wider">AI Crop Suggestion</h3>
                        </div>
                        {isRecLoading ? (
                            <div className="flex items-center gap-2 text-sm text-white/80">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyzing rich soil and weather data...
                            </div>
                        ) : cropRec ? (
                            <>
                                <p className="text-4xl font-extrabold mb-1 tracking-tight">{cropRec.top_recommendation}</p>
                                <p className="text-base text-emerald-100 font-medium mb-4">
                                    {(cropRec.confidence * 100).toFixed(0)}% Match • Ideal for your locale
                                </p>
                                {cropRec.alternatives?.length > 0 && (
                                    <div className="flex gap-2 text-xs text-emerald-50 items-center">
                                        <span className="opacity-70 bg-emerald-800/40 px-2 py-1 rounded-lg">Other options:</span>
                                        {cropRec.alternatives.map((a, i) => (
                                            <span key={i} className="font-bold border-b border-emerald-400/30 pb-0.5">
                                                {a.crop}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-emerald-100">Ensure your farm has a mapped location to see suggestions.</p>
                        )}
                    </div>
                </div>

                {/* Weather Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Today's Weather</h3>
                        {isWeatherLoading ? (
                            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
                        ) : (
                            <CloudSun className="w-5 h-5 text-amber-500" />
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-slate-800">{weather?.temperature ? `${Math.round(weather.temperature)}°` : '--'}</p>
                            <p className="text-xs text-slate-500">Temperature</p>
                        </div>
                        <div className="text-center border-x border-slate-100">
                            <p className="text-2xl font-bold text-blue-600 flex items-center justify-center gap-1"><Droplets className="w-4 h-4" />{weather?.humidity ? `${Math.round(weather.humidity)}%` : '--'}</p>
                            <p className="text-xs text-slate-500">Humidity</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-emerald-600">{weather?.rain !== undefined ? `${weather.rain}mm` : '--'}</p>
                            <p className="text-xs text-slate-500">Rainfall</p>
                        </div>
                    </div>
                </div>

                {/* Farm Overview */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Farm Overview</h3>
                        <Link to="/farms" className="text-primary text-xs font-semibold flex items-center gap-1">
                            View All <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    {farms.length > 0 ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-green-50/80 rounded-2xl p-4">
                                    <Sprout className="w-5 h-5 text-green-600 mb-2" />
                                    <p className="text-2xl font-bold text-slate-800">{farms.length}</p>
                                    <p className="text-xs text-slate-500 font-medium">Active Farms</p>
                                </div>
                                <div className="bg-blue-50/80 rounded-2xl p-4">
                                    <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                                    <p className="text-2xl font-bold text-slate-800">{totalAcres}</p>
                                    <p className="text-xs text-slate-500 font-medium">Total Acres</p>
                                </div>
                            </div>
                            
                            {/* Growth Stage Progress Bar */}
                            {activeCrop && (
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-sm font-bold text-slate-700">{activeCrop.crop_name}</p>
                                        <p className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Day {getGrowthProgress(activeCrop).days}</p>
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${getGrowthProgress(activeCrop).percent}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase">
                                        <span>Sown</span>
                                        <span>Vegetative</span>
                                        <span>Flowering</span>
                                        <span>Harvest</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link to="/add-farm" className="block p-5 bg-slate-50 rounded-2xl text-center border-2 border-dashed border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-colors">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                <Sprout className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Add Your First Farm</p>
                            <p className="text-xs text-slate-500 mt-1">Start tracking your agricultural journey</p>
                        </Link>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Link to="/assistant" className="group flex items-center gap-3 p-4 bg-green-50/50 rounded-2xl border border-transparent hover:bg-green-50 hover:border-green-100 transition-all">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <MessageSquare className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Ask Sakhi</p>
                                <p className="text-xs text-slate-500">Get advice</p>
                            </div>
                        </Link>
                        <Link to="/camera" className="group flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-transparent hover:bg-blue-50 hover:border-blue-100 transition-all">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <Camera className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Scan Crop</p>
                                <p className="text-xs text-slate-500">Disease check</p>
                            </div>
                        </Link>
                        <Link to="/finance" className="group flex items-center gap-3 p-4 bg-amber-50/50 rounded-2xl border border-transparent hover:bg-amber-50 hover:border-amber-100 transition-all">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <IndianRupee className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Finance</p>
                                <p className="text-xs text-slate-500">Track Money</p>
                            </div>
                        </Link>
                        <Link to="/activity" className="group flex items-center gap-3 p-4 bg-purple-50/50 rounded-2xl border border-transparent hover:bg-purple-50 hover:border-purple-100 transition-all">
                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                                <BookOpen className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Activity</p>
                                <p className="text-xs text-slate-500">Farm logs</p>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* KVK Updates Section */}
                {blogs.length > 0 && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl shadow-sm border border-indigo-100 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                                <Bell className="w-4 h-4 text-indigo-500" /> KVK Updates
                            </h3>
                            <Link to="/more" className="text-indigo-600 text-xs font-semibold flex items-center gap-1">
                                All <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        <div className="space-y-3">
                            {blogs.map(blog => (
                                <div key={blog.id} className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 border border-indigo-50 flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                        <Info className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{blog.title}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{blog.summary || blog.content?.substring(0, 50)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default HomeDashboard;
