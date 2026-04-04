/**
 * AddNewFarmScreen — Add Farm to Supabase
 * ────────────────────────────────────────
 * Writes farm data to Supabase farms table.
 * GPS capture button fills lat/lng.
 */
import React, { useState } from 'react';
import { ArrowLeft, LocateFixed, Save, Loader2, CheckCircle2, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const AddNewFarmScreen = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');
    const [gpsStatus, setGpsStatus] = useState('idle'); // idle | loading | done | failed

    const [formData, setFormData] = useState({
        name: '',
        size: '',
        soilType: '',
        irrigation: '',
        latitude: null,
        longitude: null,
    });

    const handleGPS = () => {
        if (!navigator.geolocation) {
            setGpsStatus('failed');
            return;
        }
        setGpsStatus('loading');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({
                    ...prev,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                }));
                setGpsStatus('done');
            },
            () => setGpsStatus('failed'),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Please enter a farm name');
            return;
        }
        if (!user?.id) {
            setError('Session expired. Please log in again.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const { error: insertError } = await supabase.from('farms').insert({
                farmer_id: user.id,
                farm_name: formData.name.trim(),
                area_acres: formData.size ? parseFloat(formData.size) : null,
                soil_type: formData.soilType || null,
                irrigation_type: formData.irrigation || null,
                latitude: formData.latitude,
                longitude: formData.longitude,
            });

            if (insertError) {
                console.error('[AddFarm] Insert error:', insertError.message);
                setError('Failed to save farm. Please try again.');
                setIsSubmitting(false);
                return;
            }

            setIsSuccess(true);
            setTimeout(() => navigate('/farms'), 1200);
        } catch (err) {
            console.error('[AddFarm] Unexpected error:', err);
            setError('Something went wrong. Please try again.');
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4 p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">Farm Added!</h2>
                <p className="text-sm text-slate-500">Redirecting to your farms...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-white font-sans">
            {/* Header */}
            <header className="bg-primary px-4 py-4 text-white flex items-center justify-between shadow-sm relative z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="font-bold text-lg">Add New Farm</h1>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24">
                {/* GPS Section */}
                <div className="p-6 bg-gradient-to-b from-primary/5 to-transparent border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-700 mb-1">📍 Farm Location</h3>
                            {gpsStatus === 'done' ? (
                                <p className="text-xs text-green-600 font-medium">
                                    GPS: {formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)}
                                </p>
                            ) : gpsStatus === 'failed' ? (
                                <p className="text-xs text-red-500 font-medium">GPS unavailable — location is optional</p>
                            ) : (
                                <p className="text-xs text-slate-500">Tap to capture GPS coordinates</p>
                            )}
                        </div>
                        <button
                            onClick={handleGPS}
                            disabled={gpsStatus === 'loading'}
                            className={`p-3 rounded-full shadow-sm transition-all ${gpsStatus === 'done' ? 'bg-green-100 text-green-600' : 'bg-white text-slate-700 hover:text-primary border border-slate-200'}`}
                        >
                            {gpsStatus === 'loading' ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : gpsStatus === 'done' ? (
                                <MapPin className="w-5 h-5" />
                            ) : (
                                <LocateFixed className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">Farm Name *</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-slate-800"
                            placeholder="e.g. North Field, River Side..."
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">Size (Acres)</label>
                            <input
                                type="number"
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-slate-800"
                                placeholder="0.0"
                                step="0.1"
                                value={formData.size}
                                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">Soil Type</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 appearance-none"
                                value={formData.soilType}
                                onChange={(e) => setFormData({ ...formData, soilType: e.target.value })}
                            >
                                <option value="">Select</option>
                                <option value="black">Black Soil</option>
                                <option value="red">Red Soil</option>
                                <option value="alluvial">Alluvial</option>
                                <option value="clay">Clay</option>
                                <option value="loam">Loam</option>
                                <option value="sandy">Sandy</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="text-sm font-bold text-slate-700">Primary Irrigation Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'rainfed', label: '🌧️ Rainfed' },
                                { value: 'drip', label: '💦 Drip' },
                                { value: 'canal', label: '🏞️ Canal' },
                                { value: 'borewell', label: '💧 Borewell' },
                                { value: 'other', label: '🔧 Other' },
                            ].map((method) => (
                                <div
                                    key={method.value}
                                    onClick={() => setFormData({ ...formData, irrigation: method.value })}
                                    className={`px-4 py-3 border rounded-xl text-center text-sm font-semibold cursor-pointer transition-colors ${formData.irrigation === method.value
                                        ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    {method.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>
            </main>

            {/* Save Button */}
            <div className="fixed max-w-md w-full bottom-0 bg-white border-t border-slate-100 p-4 pb-8 z-30">
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.name.trim()}
                    className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                >
                    {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                    ) : (
                        <><Save className="w-5 h-5" /> Save Farm Details</>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AddNewFarmScreen;
