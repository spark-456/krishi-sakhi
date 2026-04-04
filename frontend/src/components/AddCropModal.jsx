/**
 * AddCropModal — Add Crop to a Farm
 * ──────────────────────────────────
 * MIMIC_DEV: Bottom slide-up modal. Selects from ref_crops.
 * Auto-logs a 'planting' activity to activity_logs.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} farmId
 * @param {string} farmName
 * @param {string} farmerId
 * @param {function} onCropAdded - callback after successful add
 */
import React, { useState, useEffect } from 'react';
import { X, Sprout, Loader2, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const GROWTH_STAGES = [
    { value: 'land_prep', label: '🏗️ Land Preparation' },
    { value: 'sowing', label: '🌱 Sowing' },
    { value: 'germination', label: '🌿 Germination' },
    { value: 'vegetative', label: '🍃 Vegetative' },
    { value: 'flowering', label: '🌸 Flowering' },
    { value: 'fruiting', label: '🍅 Fruiting' },
    { value: 'harvest', label: '🌾 Harvest Ready' },
    { value: 'post_harvest', label: '📦 Post Harvest' },
];

const SEASONS = ['kharif', 'rabi', 'zaid'];

const AddCropModal = ({ isOpen, onClose, farmId, farmName, farmerId, onCropAdded }) => {
    const [crops, setCrops] = useState([]);
    const [formData, setFormData] = useState({
        cropName: '',
        season: 'kharif',
        growthStage: 'sowing',
        plantedDate: new Date().toISOString().split('T')[0],
        notes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchCrops();
            setFormData({
                cropName: '',
                season: 'kharif',
                growthStage: 'sowing',
                plantedDate: new Date().toISOString().split('T')[0],
                notes: '',
            });
            setSearchQuery('');
        }
    }, [isOpen]);

    const fetchCrops = async () => {
        const { data } = await supabase.from('ref_crops').select('*').order('crop_name_en');
        if (data) setCrops(data);
    };

    const filteredCrops = crops.filter(c =>
        c.crop_name_en.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = async () => {
        if (!formData.cropName) return;
        setIsSubmitting(true);

        try {
            // Insert farm_crops
            await supabase.from('farm_crops').insert({
                farm_id: farmId,
                crop_name: formData.cropName,
                season: formData.season,
                growth_stage: formData.growthStage,
                planted_date: formData.plantedDate,
                notes: formData.notes || null,
            });

            // Auto-log planting activity
            await supabase.from('activity_logs').insert({
                farmer_id: farmerId,
                farm_id: farmId,
                crop_name: formData.cropName,
                activity_type: 'planting',
                title: `${formData.cropName} Planted`,
                description: `Planted ${formData.cropName} (${formData.season} season) on ${farmName}. Stage: ${formData.growthStage}.`,
                date: formData.plantedDate,
            });

            onCropAdded?.();
            onClose();
        } catch (err) {
            console.error('[AddCrop] Error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                {/* Handle */}
                <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10 rounded-t-3xl">
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Sprout className="w-5 h-5 text-green-600" /> Add Crop
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">to {farmName}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Crop Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Select Crop *</label>
                        <input
                            type="text"
                            placeholder="Search crops..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                            {filteredCrops.map(crop => (
                                <button
                                    key={crop.id}
                                    onClick={() => { setFormData({ ...formData, cropName: crop.crop_name_en }); setSearchQuery(''); }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${formData.cropName === crop.crop_name_en
                                        ? 'bg-primary text-white border-primary'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-primary hover:text-primary'}`}
                                >
                                    {crop.crop_name_en}
                                </button>
                            ))}
                            {filteredCrops.length === 0 && searchQuery && (
                                <button
                                    onClick={() => setFormData({ ...formData, cropName: searchQuery })}
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-primary text-primary">
                                    + Add "{searchQuery}"
                                </button>
                            )}
                        </div>
                        {formData.cropName && (
                            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                <Check className="w-3 h-3" /> Selected: {formData.cropName}
                            </p>
                        )}
                    </div>

                    {/* Season */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Season</label>
                        <div className="flex gap-2">
                            {SEASONS.map(s => (
                                <button key={s} onClick={() => setFormData({ ...formData, season: s })}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize border transition-all ${formData.season === s
                                        ? 'bg-primary/10 text-primary border-primary'
                                        : 'bg-white border-slate-200 text-slate-600'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Growth Stage */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Current Growth Stage</label>
                        <div className="grid grid-cols-2 gap-2">
                            {GROWTH_STAGES.map(stage => (
                                <button key={stage.value} onClick={() => setFormData({ ...formData, growthStage: stage.value })}
                                    className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-all ${formData.growthStage === stage.value
                                        ? 'bg-primary/10 text-primary border-primary'
                                        : 'bg-white border-slate-200 text-slate-600'}`}>
                                    {stage.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Planted Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Planted Date</label>
                        <input type="date" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50"
                            value={formData.plantedDate}
                            onChange={(e) => setFormData({ ...formData, plantedDate: e.target.value })} />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Notes (optional)</label>
                        <textarea className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 resize-none" rows="2"
                            placeholder="e.g. Hybrid variety, intercropping with..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                    </div>

                    {/* Submit */}
                    <button onClick={handleSubmit} disabled={!formData.cropName || isSubmitting}
                        className="w-full bg-primary text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : <><Sprout className="w-5 h-5" /> Add Crop</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddCropModal;
