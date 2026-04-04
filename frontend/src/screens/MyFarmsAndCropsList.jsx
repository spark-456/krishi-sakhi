/**
 * MyFarmsAndCropsList — Farms + Crops from LocalDB
 * ─────────────────────────────────────────────────
 * MIMIC_DEV: Shows farms with planted crops, add crop modal,
 * crop growth stage badges, and farm weather placeholder.
 */
import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Sprout, CloudRain, Trash2, Loader2, Droplets, Leaf, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import AddCropModal from '../components/AddCropModal';

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

const MyFarmsAndCropsList = () => {
    const { user } = useAuth();
    const [farms, setFarms] = useState([]);
    const [farmCrops, setFarmCrops] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast] = useState(null);
    const [expandedFarm, setExpandedFarm] = useState(null);

    // Add Crop Modal
    const [cropModal, setCropModal] = useState({ open: false, farmId: null, farmName: '' });

    useEffect(() => {
        if (user?.id) fetchAll();
    }, [user?.id]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const { data: farmData } = await supabase
                .from('farms').select('*').eq('farmer_id', user.id)
                .order('created_at', { ascending: false });

            if (farmData) {
                setFarms(farmData);
                // Fetch crops per farm
                const cropsMap = {};
                for (const farm of farmData) {
                    const { data: crops } = await supabase
                        .from('farm_crops').select('*').eq('farm_id', farm.id)
                        .order('created_at', { ascending: false });
                    cropsMap[farm.id] = crops || [];
                }
                setFarmCrops(cropsMap);
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
            await supabase.from('farm_crops').delete().eq('farm_id', farmId);
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
            await supabase.from('farm_crops').delete().eq('id', cropId);
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
                                            </p>
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
                                                        <div key={crop.id} className="group relative flex items-center gap-1.5">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${STAGE_COLORS[crop.growth_stage] || 'bg-slate-100 text-slate-600'}`}>
                                                                🌱 {crop.crop_name}
                                                                <span className="text-[9px] opacity-70 capitalize">({crop.growth_stage?.replace('_', ' ')})</span>
                                                            </span>
                                                            <button onClick={() => handleDeleteCrop(crop.id, farm.id)}
                                                                className="opacity-0 group-hover:opacity-100 w-4 h-4 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-[10px] transition-opacity hover:bg-red-200">
                                                                ×
                                                            </button>
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
                                                {farm.latitude && (
                                                    <div className="bg-green-50 rounded-xl p-3">
                                                        <p className="text-[11px] text-green-600 font-medium">📍 GPS</p>
                                                        <p className="text-sm font-semibold text-slate-700 mt-0.5">{parseFloat(farm.latitude).toFixed(3)}, {parseFloat(farm.longitude).toFixed(3)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Farm Actions */}
                                    <div className="bg-slate-50 p-3 flex border-t border-slate-100">
                                        <button onClick={() => showToast('🌦️ Weather integration coming in production!')}
                                            className="w-1/2 flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary text-sm font-semibold py-2 transition-colors border-r border-slate-200">
                                            <CloudRain className="w-4 h-4" /> Weather
                                        </button>
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
