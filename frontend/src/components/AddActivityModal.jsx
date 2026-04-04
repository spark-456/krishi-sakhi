/**
 * AddActivityModal — Log Farm Activity
 * ─────────────────────────────────────
 * MIMIC_DEV: Bottom slide-up modal for manual activity logging.
 * Only logs when user explicitly takes action.
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} farmerId
 * @param {function} onActivityAdded
 */
import React, { useState, useEffect } from 'react';
import { X, ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const ACTIVITY_TYPES = [
    { value: 'irrigation', label: '💧 Irrigation', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'fertilizer', label: '🧪 Fertilizer', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'pesticide', label: '🛡️ Pesticide', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'weeding', label: '🌿 Weeding', color: 'bg-lime-50 text-lime-700 border-lime-200' },
    { value: 'pruning', label: '✂️ Pruning', color: 'bg-orange-50 text-orange-700 border-orange-200' },
    { value: 'harvest', label: '🌾 Harvest', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { value: 'soil_test', label: '🔬 Soil Test', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { value: 'disease_alert', label: '🚨 Disease Alert', color: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'growth_update', label: '📏 Growth Update', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { value: 'other', label: '📝 Other', color: 'bg-slate-50 text-slate-700 border-slate-200' },
];

const AddActivityModal = ({ isOpen, onClose, farmerId, onActivityAdded }) => {
    const [farms, setFarms] = useState([]);
    const [crops, setCrops] = useState([]);
    const [formData, setFormData] = useState({
        farmId: '',
        cropName: '',
        activityType: '',
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && farmerId) {
            fetchFarms();
            setFormData({
                farmId: '',
                cropName: '',
                activityType: '',
                title: '',
                description: '',
                date: new Date().toISOString().split('T')[0],
            });
        }
    }, [isOpen, farmerId]);

    useEffect(() => {
        if (formData.farmId) fetchCropsForFarm(formData.farmId);
    }, [formData.farmId]);

    const fetchFarms = async () => {
        const { data } = await supabase.from('farms').select('*').eq('farmer_id', farmerId);
        if (data) setFarms(data);
    };

    const fetchCropsForFarm = async (farmId) => {
        const { data } = await supabase.from('farm_crops').select('*').eq('farm_id', farmId);
        if (data) setCrops(data);
    };

    // Auto-generate title from activity type
    const handleTypeSelect = (type) => {
        const typeLabel = ACTIVITY_TYPES.find(t => t.value === type)?.label?.replace(/^.{2}\s/, '') || type;
        setFormData({
            ...formData,
            activityType: type,
            title: formData.title || `${typeLabel}${formData.cropName ? ` — ${formData.cropName}` : ''}`,
        });
    };

    const handleSubmit = async () => {
        if (!formData.activityType || !formData.title) return;
        setIsSubmitting(true);

        try {
            await supabase.from('activity_logs').insert({
                farmer_id: farmerId,
                farm_id: formData.farmId || null,
                crop_name: formData.cropName || null,
                activity_type: formData.activityType,
                title: formData.title,
                description: formData.description || null,
                date: formData.date,
            });

            onActivityAdded?.();
            onClose();
        } catch (err) {
            console.error('[AddActivity] Error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto">
                <div className="sticky top-0 bg-white pt-3 pb-2 px-6 border-b border-slate-100 z-10 rounded-t-3xl">
                    <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-3" />
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-primary" /> Log Activity
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Activity Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Activity Type *</label>
                        <div className="grid grid-cols-2 gap-2">
                            {ACTIVITY_TYPES.map(type => (
                                <button key={type.value} onClick={() => handleTypeSelect(type.value)}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${formData.activityType === type.value
                                        ? 'ring-2 ring-primary/30 ' + type.color
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Farm + Crop */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">Farm</label>
                            <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 outline-none focus:border-primary"
                                value={formData.farmId}
                                onChange={(e) => setFormData({ ...formData, farmId: e.target.value, cropName: '' })}>
                                <option value="">Select farm</option>
                                {farms.map(f => <option key={f.id} value={f.id}>{f.farm_name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">Crop</label>
                            <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 outline-none focus:border-primary"
                                value={formData.cropName}
                                onChange={(e) => setFormData({ ...formData, cropName: e.target.value })}>
                                <option value="">Select crop</option>
                                {crops.map(c => <option key={c.id} value={c.crop_name}>{c.crop_name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">Title *</label>
                        <input type="text" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50"
                            placeholder="e.g. Applied 50kg Urea per acre"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">Details (optional)</label>
                        <textarea className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50 resize-none" rows="2"
                            placeholder="Additional notes about this activity..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                    </div>

                    {/* Date */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">Date</label>
                        <input type="date" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-slate-50"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                    </div>

                    <button onClick={handleSubmit} disabled={!formData.activityType || !formData.title || isSubmitting}
                        className="w-full bg-primary text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none transition-all">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Logging...</> : <><ClipboardList className="w-5 h-5" /> Log Activity</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddActivityModal;
