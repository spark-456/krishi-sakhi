/**
 * ProfileScreen — Enhanced User Profile
 * ──────────────────────────────────────
 * Shows farmer info, farm/crop stats, recent activity,
 * inline edit for name, and logout.
 */
import React, { useState, useEffect } from 'react';
import {
    User, MapPin, Phone, Leaf, LogOut, ChevronRight,
    Tractor, Globe, Loader2, Edit3, Check, X, Sprout,
    ClipboardList, Trash2, Calendar, BarChart3
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { getCropRecommendation, getPriceForecast } from '../lib/backendClient';

const ProfileScreen = () => {
    const navigate = useNavigate();
    const { user, session, signOut } = useAuth();
    const [farmer, setFarmer] = useState(null);
    const [farms, setFarms] = useState([]);
    const [cropCount, setCropCount] = useState(0);
    const [activityCount, setActivityCount] = useState(0);
    const [recentLogs, setRecentLogs] = useState([]);
    const [mlSystemRaw, setMlSystemRaw] = useState(null);
    const [isMlLoading, setIsMlLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Edit mode
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user?.id) fetchProfile();
    }, [user?.id, session?.access_token]);

    const fetchProfile = async () => {
        setIsLoading(true);
        try {
            const { data: farmerData } = await supabase
                .from('farmers').select('*').eq('id', user.id).single();
            if (farmerData) { setFarmer(farmerData); setEditName(farmerData.full_name); }

            const { data: farmData } = await supabase
                .from('farms').select('*').eq('farmer_id', user.id);
            if (farmData) setFarms(farmData);
            if (session?.access_token) fetchMlSystemOutputs(farmData || []);

            // Count active crops across all farms
            const { data: farmerCrops } = await supabase
                .from('crop_records').select('id')
                .eq('farmer_id', user.id).eq('status', 'active');
            setCropCount((farmerCrops || []).length);

            // Activity logs
            const { data: logData } = await supabase
                .from('activity_logs').select('*').eq('farmer_id', user.id)
                .order('date', { ascending: false });
            setActivityCount((logData || []).length);
            setRecentLogs((logData || []).slice(0, 3));
        } catch (err) {
            console.error('[Profile] Error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMlSystemOutputs = async (farmData = farms) => {
        if (!user?.id || !session?.access_token) return;
        setIsMlLoading(true);

        const primaryFarmId = farmData?.[0]?.id || null;
        const nextRaw = {
            fetched_at: new Date().toISOString(),
            primary_farm_id: primaryFarmId,
            live_crop_recommendation: null,
            live_price_forecast: null,
            live_price_forecasts: [],
            stored_latest_crop_recommendation: null,
            stored_recent_price_forecasts: [],
            recent_soil_scans: [],
            recent_pest_scans: [],
            error: null,
        };

        try {
            const [soilRes, pestRes, storedCropRes, storedPriceRes] = await Promise.all([
                supabase.from('soil_scans').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false }).limit(3),
                supabase.from('pest_scans').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false }).limit(3),
                supabase.from('crop_recommendation_requests').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false }).limit(1),
                supabase.from('price_forecast_requests').select('*').eq('farmer_id', user.id).order('generated_at', { ascending: false }).limit(3),
            ]);

            nextRaw.recent_soil_scans = soilRes.data || [];
            nextRaw.recent_pest_scans = pestRes.data || [];
            nextRaw.stored_latest_crop_recommendation = storedCropRes.data?.[0] || null;
            nextRaw.stored_recent_price_forecasts = storedPriceRes.data || [];

            if (primaryFarmId) {
                const cropRec = await getCropRecommendation({ farmId: primaryFarmId, token: session.access_token });
                nextRaw.live_crop_recommendation = cropRec;

                const forecastCrops = getRecommendedCropNames(cropRec);
                if (forecastCrops.length > 0) {
                    const forecasts = await Promise.all(forecastCrops.map(async (cropName) => {
                        const forecast = await getPriceForecast({
                            crop: cropName,
                            horizon: 7,
                            token: session.access_token,
                        });
                        return { crop: cropName, ...forecast };
                    }));
                    nextRaw.live_price_forecasts = forecasts;
                    nextRaw.live_price_forecast = forecasts[0] || null;
                }
            }
        } catch (err) {
            console.error('[Profile] ML system output error:', err);
            nextRaw.error = err.message || String(err);
        } finally {
            setMlSystemRaw(nextRaw);
            setIsMlLoading(false);
        }
    };

    const getRecommendedCropNames = (cropRec) => {
        if (!cropRec) return [];
        const names = [];
        if (cropRec.top_recommendation) names.push(cropRec.top_recommendation);
        (cropRec.alternatives || []).forEach(item => {
            const cropName = item.crop || item.crop_name || item.top_recommendation;
            if (cropName) names.push(cropName);
        });
        const seen = new Set();
        return names.filter(name => {
            const key = String(name).trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, 4);
    };

    const handleSaveName = async () => {
        if (!editName.trim() || editName === farmer?.full_name) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            await supabase.from('farmers').update({ full_name: editName.trim() }).eq('id', user.id);
            setFarmer(prev => ({ ...prev, full_name: editName.trim() }));
            setIsEditing(false);
        } catch (err) {
            console.error('[Profile] Save error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearData = () => {
        if (window.confirm('This will clear ALL local data (farms, crops, activities, chat). Are you sure?')) {
            localStorage.clear();
            navigate('/', { replace: true });
            window.location.reload();
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await signOut();
        navigate('/', { replace: true });
    };

    const totalAcres = farms.reduce((sum, f) => sum + (parseFloat(f.area_acres) || 0), 0);

    const memberSince = farmer?.created_at
        ? new Date(farmer.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
        : 'Recently';

    const ACTIVITY_EMOJI = {
        planting: '🌱', irrigation: '💧', fertilizer: '🧪', pesticide: '🛡️',
        weeding: '🌿', pruning: '✂️', harvest: '🌾', soil_test: '🔬',
        disease_alert: '🚨', growth_update: '📏', other: '📝',
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />

                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30">
                        <span className="text-3xl">👨🏽‍🌾</span>
                    </div>
                    <div className="flex-1">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input type="text" className="bg-white/20 rounded-lg px-3 py-1.5 text-white text-lg font-bold outline-none placeholder-white/40 flex-1"
                                    value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                                <button onClick={handleSaveName} disabled={isSaving}
                                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button onClick={() => { setIsEditing(false); setEditName(farmer?.full_name); }}
                                    className="p-1.5 bg-white/20 rounded-full hover:bg-white/30">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight">{farmer?.full_name || 'Farmer'}</h1>
                                <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-white/10 rounded-full">
                                    <Edit3 className="w-3.5 h-3.5 text-white/60" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                            <Phone className="w-3.5 h-3.5" />
                            <span>+91 {farmer?.phone_number || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-5 space-y-5">

                {/* Stats Bar */}
                <div className="grid grid-cols-4 gap-2 -mt-6 relative z-20">
                    {[
                        { label: 'Farms', value: farms.length, icon: '🏡', color: 'bg-green-50' },
                        { label: 'Acres', value: totalAcres, icon: '📐', color: 'bg-blue-50' },
                        { label: 'Crops', value: cropCount, icon: '🌱', color: 'bg-amber-50' },
                        { label: 'Logs', value: activityCount, icon: '📋', color: 'bg-purple-50' },
                    ].map((stat) => (
                        <div key={stat.label} className={`${stat.color} rounded-2xl p-3 text-center shadow-sm border border-white`}>
                            <p className="text-lg">{stat.icon}</p>
                            <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Profile Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Profile Details</h3>
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">Location</p>
                                <p className="text-sm font-semibold text-slate-800">
                                    {[farmer?.village, farmer?.district, farmer?.state].filter(Boolean).join(', ') || 'Not set'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">Language</p>
                                <p className="text-sm font-semibold text-slate-800 capitalize">{farmer?.preferred_language || 'English'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                            <div>
                                <p className="text-xs text-slate-500">Member Since</p>
                                <p className="text-sm font-semibold text-slate-800">{memberSince}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Raw ML Outputs */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Raw ML Outputs</h3>
                        </div>
                        <button
                            onClick={() => fetchMlSystemOutputs(farms)}
                            disabled={isMlLoading || !session?.access_token}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
                        >
                            {isMlLoading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                    <div className="rounded-xl bg-slate-950 text-slate-100 p-3 max-h-96 overflow-auto">
                        <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">
                            {isMlLoading && !mlSystemRaw
                                ? 'Fetching ML outputs...'
                                : JSON.stringify(mlSystemRaw || { status: 'No ML output loaded yet' }, null, 2)}
                        </pre>
                    </div>
                </div>

                {/* Farms Quick List */}
                {farms.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">My Farms</h3>
                            <Link to="/farms" className="text-primary text-xs font-semibold flex items-center gap-1">
                                View All <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        {farms.map((farm) => (
                            <div key={farm.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                        <Leaf className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{farm.farm_name || 'Unnamed Farm'}</p>
                                        <p className="text-xs text-slate-500">
                                            {farm.area_acres ? `${farm.area_acres} acres` : 'Size not set'}
                                            {farm.irrigation_type ? ` • ${farm.irrigation_type}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Recent Activity */}
                {recentLogs.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Recent Activity</h3>
                            <Link to="/activity" className="text-primary text-xs font-semibold flex items-center gap-1">
                                View All <ChevronRight className="w-3 h-3" />
                            </Link>
                        </div>
                        {recentLogs.map((log) => (
                            <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                <span className="text-xl">{ACTIVITY_EMOJI[log.activity_type] || '📝'}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 truncate">{log.title}</p>
                                    <p className="text-xs text-slate-500">
                                        {log.crop_name || 'General'} • {log.date ? new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* App Info */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">App</h3>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                                <Leaf className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Krishi Sakhi</p>
                                <p className="text-xs text-slate-500">Version 1.1</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button onClick={handleClearData}
                        className="w-full flex items-center justify-center gap-2 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 font-semibold hover:bg-amber-100 transition-colors text-sm">
                        <Trash2 className="w-4 h-4" /> Clear All Local Data
                    </button>
                    <button onClick={handleLogout} disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold hover:bg-red-100 transition-colors disabled:opacity-50">
                        {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                </div>
            </main>
        </div>
    );
};

export default ProfileScreen;
