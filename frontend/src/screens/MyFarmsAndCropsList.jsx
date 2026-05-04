/**
 * MyFarmsAndCropsList — Farms & Crop Records
 * ────────────────────────────────────────────
 * Displays farms with active crop records, live district weather,
 * and phone-first shortcuts for crop and field management.
 */
import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Sprout, CloudRain, Trash2, Loader2, Droplets, Leaf, ChevronDown, ChevronUp, MessageSquare, CalendarDays, CloudSun, Wallet, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import AddCropModal from '../components/AddCropModal';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';
import { getWeather } from '../lib/backendClient';

const STAGE_COLORS = {
    land_prep: 'bg-slate-100 text-slate-600',
    sowing: 'bg-amber-100 text-amber-700',
    germination: 'bg-lime-100 text-lime-700',
    vegetative: 'bg-green-100 text-green-700',
    flowering: 'bg-pink-100 text-pink-700',
    fruiting: 'bg-orange-100 text-orange-700',
    harvest: 'bg-yellow-100 text-yellow-700',
    post_harvest: 'bg-slate-100 text-slate-600',
};

const TIMELINE = ['land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest'];

const getCropProgress = (crop) => {
    const normalized = (crop?.growth_stage || 'vegetative').replace('-', '_');
    const index = Math.max(TIMELINE.indexOf(normalized), 0);
    const sowingDate = crop?.sowing_date ? new Date(crop.sowing_date) : null;
    const days = sowingDate ? Math.max(Math.floor((Date.now() - sowingDate.getTime()) / (1000 * 60 * 60 * 24)), 0) : null;
    return {
        percent: Math.round((index / (TIMELINE.length - 1)) * 100),
        days,
        nextStage: TIMELINE[Math.min(index + 1, TIMELINE.length - 1)],
    };
};

const formatStageLabel = (stage) => (stage || 'vegetative').replace(/_/g, ' ');
const SENSITIVE_STAGES = new Set(['flowering', 'fruiting', 'maturity']);

const MyFarmsAndCropsList = () => {
    const { user, session } = useAuth();
    const [farms, setFarms] = useState([]);
    const [farmCrops, setFarmCrops] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [expandedFarm, setExpandedFarm] = useState(null);
    const [weather, setWeather] = useState(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

    // Add Crop Modal
    const [cropModal, setCropModal] = useState({ open: false, farmId: null, farmName: '' });

    useEffect(() => {
        if (user?.id) fetchAll();
    }, [user?.id, session?.access_token]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['farms', 'dashboard', 'activity']) && user?.id) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [user?.id, session?.access_token]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const { data: farmData } = await supabase
                .from('farms').select('*').eq('farmer_id', user.id)
                .order('created_at', { ascending: false });

            const safeFarms = farmData || [];
            setFarms(safeFarms);

            const cropEntries = await Promise.all(
                safeFarms.map(async (farm) => {
                    const { data: crops } = await supabase
                        .from('crop_records').select('*').eq('farm_id', farm.id)
                        .eq('farmer_id', user.id).eq('status', 'active')
                        .order('created_at', { ascending: false });
                    return [farm.id, crops || []];
                })
            );
            setFarmCrops(Object.fromEntries(cropEntries));

            if (session?.access_token) {
                setWeatherLoading(true);
                try {
                    const weatherData = await getWeather({ token: session.access_token });
                    setWeather(weatherData);
                } catch (weatherErr) {
                    console.error('[Farms] Weather fetch error:', weatherErr);
                    setWeather({
                        forecast: 'Live weather unavailable right now',
                        condition: 'Unavailable',
                        source: 'fallback',
                    });
                } finally {
                    setWeatherLoading(false);
                }
            }
        } catch (err) {
            console.error('[Farms] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteFarm = async (farmId) => {
        if (!window.confirm('This will also remove all crops on this farm. Continue?')) return;
        setDeletingId(farmId);
        try {
            await supabase.from('crop_records').update({ status: 'abandoned' }).eq('farm_id', farmId).eq('farmer_id', user.id);
            await supabase.from('farms').delete().eq('id', farmId);
            setFarms(prev => prev.filter(f => f.id !== farmId));
            const newCrops = { ...farmCrops };
            delete newCrops[farmId];
            setFarmCrops(newCrops);
            showToast('Farm removed');
        } catch (err) {
            console.error('[Farms] Delete error:', err);
            showToast('Failed to remove farm');
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeleteCrop = async (cropId, farmId) => {
        if (!window.confirm('Remove this crop?')) return;
        try {
            await supabase.from('crop_records').update({ status: 'abandoned' }).eq('id', cropId);
            setFarmCrops(prev => ({
                ...prev,
                [farmId]: (prev[farmId] || []).filter(c => c.id !== cropId),
            }));
            showToast('Crop removed');
        } catch (err) {
            console.error('[Farms] Crop delete error:', err);
        }
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    const getIrrigationEmoji = (type) => {
        const map = { rainfed: '🌧️', canal: '🏞️', borewell: '💧', drip: '💦', other: '🔧' };
        return map[type] || '💧';
    };

    const totalAcres = farms.reduce((sum, farm) => sum + (parseFloat(farm.area_acres) || 0), 0);
    const totalActiveCrops = Object.values(farmCrops).reduce((sum, crops) => sum + crops.length, 0);
    const allCrops = Object.values(farmCrops).flat();
    const farmsWithoutCrops = farms.filter((farm) => (farmCrops[farm.id] || []).length === 0).length;
    const sensitiveCropCount = allCrops.filter((crop) => SENSITIVE_STAGES.has((crop.growth_stage || '').replace('-', '_'))).length;
    const attentionCount = sensitiveCropCount + farmsWithoutCrops;
    const weatherHeadline = weatherLoading
        ? 'Loading live weather...'
        : weather?.temp != null
            ? `${weather.temp}° • ${weather.condition || 'Current conditions'}`
            : weather?.forecast || 'Weather unavailable';

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
                <header className="bg-primary px-6 py-5 text-primary-foreground shadow-md rounded-b-3xl">
                    <h1 className="text-2xl font-bold tracking-tight mb-1">My Farms & Crops</h1>
                    <p className="text-white/80 text-sm font-medium">Loading...</p>
                </header>
                <main className="flex-1 p-5 space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-pulse">
                            <div className="h-5 bg-slate-200 rounded w-2/3 mb-3" />
                            <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
                            <div className="h-16 bg-slate-100 rounded-xl" />
                        </div>
                    ))}
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-primary px-6 py-5 text-primary-foreground shadow-md rounded-b-3xl relative z-10">
                <h1 className="text-2xl font-bold tracking-tight mb-1">My Farms & Crops</h1>
                <p className="text-white/80 text-sm font-medium">
                    {farms.length > 0 ? `${farms.length} farm${farms.length > 1 ? 's' : ''} registered` : 'Manage your agricultural portfolio'}
                </p>
            </header>

            {/* Toast */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg">
                    {toast}
                </div>
            )}

            {/* Content */}
            <main className="flex-1 p-5 space-y-5 -mt-2">
                {farms.length > 0 && (
                    <>
                        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Weather</p>
                                    <p className="text-lg font-extrabold text-slate-800 mt-2">{weatherHeadline}</p>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {weather?.location_label || 'Your farm area'}
                                        {weather?.source === 'open-meteo' ? ' • Open-Meteo live' : ' • Fallback summary'}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-blue-700 min-w-[104px]">
                                    <p className="text-[10px] font-bold uppercase tracking-wider">Rain</p>
                                    <p className="text-lg font-extrabold mt-1">{weather?.rainfall != null ? `${weather.rainfall} mm` : '--'}</p>
                                    <p className="text-[11px] mt-1 text-blue-600">{weather?.humidity != null ? `${weather.humidity}% humidity` : 'No humidity data'}</p>
                                </div>
                            </div>
                            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold text-slate-700">Forecast</p>
                                    <p className="text-xs text-slate-500 mt-1">{weather?.forecast || 'No district forecast available yet.'}</p>
                                </div>
                                <Link
                                    to="/assistant"
                                    state={{ prefillMessage: 'What should I do on my farms today based on the current weather?' }}
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 whitespace-nowrap"
                                >
                                    Ask Sakhi <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Farms</p>
                                <p className="text-2xl font-extrabold text-slate-800 mt-2">{farms.length}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Crops</p>
                                <p className="text-2xl font-extrabold text-slate-800 mt-2">{totalActiveCrops}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Acres</p>
                                <p className="text-2xl font-extrabold text-slate-800 mt-2">{totalAcres || 0}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Attention</p>
                                <p className="text-2xl font-extrabold text-slate-800 mt-2">{attentionCount}</p>
                            </div>
                        </section>

                        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
                            <div className="grid grid-cols-2 gap-3">
                                <Link
                                    to="/assistant"
                                    state={{ prefillMessage: 'Help me update my farms, crops, harvests, or expenses.' }}
                                    className="rounded-2xl bg-emerald-50 px-3 py-4 text-left"
                                >
                                    <MessageSquare className="w-5 h-5 text-emerald-600 mb-2" />
                                    <p className="text-xs font-bold text-slate-800">Ask Sakhi</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Update by voice or text</p>
                                </Link>
                                <Link to="/activity" className="rounded-2xl bg-amber-50 px-3 py-4 text-left">
                                    <CalendarDays className="w-5 h-5 text-amber-600 mb-2" />
                                    <p className="text-xs font-bold text-slate-800">Activity</p>
                                    <p className="text-[11px] text-slate-500 mt-1">View logs</p>
                                </Link>
                                <Link to="/finance" className="rounded-2xl bg-blue-50 px-3 py-4 text-left">
                                    <Wallet className="w-5 h-5 text-blue-600 mb-2" />
                                    <p className="text-xs font-bold text-slate-800">Finance</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Track costs and sales</p>
                                </Link>
                                <Link to="/add-farm" className="rounded-2xl bg-slate-100 px-3 py-4 text-left">
                                    <CloudSun className="w-5 h-5 text-slate-700 mb-2" />
                                    <p className="text-xs font-bold text-slate-800">Add Farm</p>
                                    <p className="text-[11px] text-slate-500 mt-1">Register new land</p>
                                </Link>
                            </div>
                        </section>

                        <section className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">What Needs Attention</p>
                            <div className="mt-3 space-y-2">
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                    <p className="text-sm font-bold text-slate-800">{sensitiveCropCount} crop{sensitiveCropCount === 1 ? '' : 's'} in sensitive stage</p>
                                    <p className="text-xs text-slate-500 mt-1">Flowering, fruiting, and maturity need closer scouting and timely updates.</p>
                                </div>
                                <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
                                    <p className="text-sm font-bold text-slate-800">{farmsWithoutCrops} farm{farmsWithoutCrops === 1 ? '' : 's'} without active crop</p>
                                    <p className="text-xs text-slate-500 mt-1">Use Ask Sakhi or Add Crop to keep the season record complete.</p>
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {farms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <Sprout className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 mb-2">No Farms Yet</h2>
                        <p className="text-sm text-slate-500 mb-6 max-w-xs">Add your first farm to start tracking crops and get personalized recommendations.</p>
                        <Link to="/add-farm" className="bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2">
                            <Plus className="w-5 h-5" /> Add Your First Farm
                        </Link>
                    </div>
                ) : (
                    <>
                        {farms.map((farm) => {
                            const crops = farmCrops[farm.id] || [];
                            const isExpanded = expandedFarm === farm.id;
                            const leadCrop = crops[0];
                            const leadProgress = leadCrop ? getCropProgress(leadCrop) : null;

                            return (
                                <div key={farm.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                    {/* Farm Header */}
                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                                        <div className="flex-1" onClick={() => setExpandedFarm(isExpanded ? null : farm.id)}>
                                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 cursor-pointer">
                                                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                                                {farm.farm_name || 'Unnamed Farm'}
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 ml-auto" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-auto" />}
                                            </h2>
                                            <p className="text-sm text-slate-500 ml-6 mt-0.5">
                                                {farm.area_acres ? `${farm.area_acres} Acres` : 'Size not set'}
                                                {farm.soil_type ? ` • ${farm.soil_type} soil` : ''}
                                                {crops.length ? ` • ${crops.length} crop${crops.length > 1 ? 's' : ''}` : ''}
                                            </p>
                                            <div className="ml-6 mt-3 flex flex-wrap gap-2">
                                                {farm.irrigation_type && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                                        <Droplets className="w-3 h-3" /> {farm.irrigation_type}
                                                    </span>
                                                )}
                                                {leadCrop && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                                        <Leaf className="w-3 h-3" /> Lead crop: {leadCrop.crop_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteFarm(farm.id)} disabled={deletingId === farm.id}
                                            className="text-slate-400 p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors flex-shrink-0">
                                            {deletingId === farm.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Crops Section */}
                                    <div className="p-4 space-y-3">
                                        {/* Crop chips */}
                                        {crops.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                    <Leaf className="w-3 h-3" /> Crops ({crops.length})
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {crops.map(crop => (
                                                        <div key={crop.id} className="group relative w-full rounded-2xl border border-slate-100 bg-slate-50 p-3">
                                                            <div className="flex items-start gap-2">
                                                                <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${STAGE_COLORS[crop.growth_stage] || 'bg-slate-100 text-slate-600'}`}>
                                                                    🌱 {crop.crop_name}
                                                                    <span className="text-[9px] opacity-70 capitalize">({crop.growth_stage?.replace('_', ' ')})</span>
                                                                </div>
                                                                <button onClick={() => handleDeleteCrop(crop.id, farm.id)}
                                                                    className="ml-auto w-6 h-6 bg-white text-slate-400 rounded-full flex items-center justify-center text-[10px] border border-slate-200 transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-100">
                                                                    ×
                                                                </button>
                                                            </div>
                                                            <div className="mt-3">
                                                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                                                        style={{ width: `${Math.max(getCropProgress(crop).percent, 8)}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                                                                    <span>{getCropProgress(crop).days != null ? `Day ${getCropProgress(crop).days}` : 'Date not set'}</span>
                                                                    <span>Next: {formatStageLabel(getCropProgress(crop).nextStage)}</span>
                                                                </div>
                                                                <p className="mt-2 text-[11px] text-slate-500">
                                                                    {SENSITIVE_STAGES.has((crop.growth_stage || '').replace('-', '_'))
                                                                        ? 'Sensitive stage: keep scouting and irrigation timing tight.'
                                                                        : `Current stage: ${formatStageLabel(crop.growth_stage)}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No crops planted yet</p>
                                        )}

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                                                {farm.irrigation_type && (
                                                    <div className="bg-blue-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1"><Droplets className="w-3 h-3" /> Irrigation</p>
                                                        <p className="text-sm font-semibold text-slate-700 capitalize mt-0.5">{getIrrigationEmoji(farm.irrigation_type)} {farm.irrigation_type}</p>
                                                    </div>
                                                )}
                                                {leadProgress && (
                                                    <div className="bg-emerald-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-emerald-600 font-medium">🌿 Lead crop progress</p>
                                                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{leadCrop.crop_name} • {leadProgress.percent}%</p>
                                                        <p className="text-[11px] text-slate-500 mt-1">Next stage: {formatStageLabel(leadProgress.nextStage)}</p>
                                                    </div>
                                                )}
                                                {farm.latitude && (
                                                    <div className="bg-green-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-green-600 font-medium">📍 GPS</p>
                                                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{parseFloat(farm.latitude).toFixed(3)}, {parseFloat(farm.longitude).toFixed(3)}</p>
                                                    </div>
                                                )}
                                                {!farm.latitude && weather?.forecast && (
                                                    <div className="bg-amber-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1"><CloudRain className="w-3 h-3" /> District Weather</p>
                                                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{weather.forecast}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Farm Actions */}
                                    <div className="bg-slate-50 p-3 flex border-t border-slate-100">
                                        <Link
                                            to="/assistant"
                                            state={{ prefillMessage: `Update my farm ${farm.farm_name || 'details'}, log any crop changes, and tell me what I should do next there.` }}
                                            className="w-1/2 flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary text-sm font-semibold py-2 transition-colors border-r border-slate-200">
                                            <MessageSquare className="w-4 h-4" /> Ask Sakhi
                                        </Link>
                                        <button onClick={() => setCropModal({ open: true, farmId: farm.id, farmName: farm.farm_name })}
                                            className="w-1/2 flex items-center justify-center gap-1.5 text-primary hover:text-primary/80 text-sm font-bold py-2 transition-colors">
                                            <Plus className="w-4 h-4" /> Add Crop
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add Farm Card */}
                        <Link to="/add-farm" className="block w-full border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-100 hover:border-primary/50 transition-all group">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-slate-400">
                                <Plus className="w-6 h-6" />
                            </div>
                            <h3 className="font-bold text-slate-700">Add New Farm</h3>
                            <p className="text-sm text-slate-500 mt-1">Register another piece of land</p>
                        </Link>
                    </>
                )}
            </main>

            {/* Add Crop Modal */}
            <AddCropModal
                isOpen={cropModal.open}
                onClose={() => setCropModal({ open: false, farmId: null, farmName: '' })}
                farmId={cropModal.farmId}
                farmName={cropModal.farmName}
                farmerId={user?.id}
                onCropAdded={fetchAll}
            />
        </div>
    );
};

export default MyFarmsAndCropsList;
