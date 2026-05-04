import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, PackagePlus } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';
import { dispatchDataRefresh } from '../lib/appEvents';

const API = API_BASE;

const RESOURCE_TYPES = [
    { value: 'equipment', label: 'Equipment', presets: ['Tractor', 'Sprayer', 'Rotavator', 'Water Pump'] },
    { value: 'seeds', label: 'Seeds / Inputs', presets: ['Cotton seed', 'Paddy seed', 'DAP bags', 'Drip parts'] },
    { value: 'vehicle', label: 'Vehicle', presets: ['Pickup', 'Tempo', 'Mini truck', 'Bike transport'] },
    { value: 'land', label: 'Storage / Space', presets: ['Storage room', 'Shade area', 'Drying floor', 'Cold room access'] },
    { value: 'other', label: 'Other', presets: ['Labour team', 'Phone contact', 'Water access', 'Local supplier lead'] },
];

const AVAILABILITY = [
    { value: 'available', label: 'Available now' },
    { value: 'in_use', label: 'Available later' },
];

const COST_MODES = [
    { value: 'Free', label: 'Free' },
    { value: 'Fuel only', label: 'Fuel only' },
    { value: 'Paid per use', label: 'Paid' },
];

const RESOURCE_TYPE_TO_DB = {
    equipment: 'equipment',
    seeds: 'seeds',
    vehicle: 'equipment',
    land: 'storage',
    other: 'equipment',
};

const AddSharedResource = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const groupId = new URLSearchParams(location.search).get('groupId');

    const [resourceType, setResourceType] = useState(RESOURCE_TYPES[0].value);
    const [preset, setPreset] = useState(RESOURCE_TYPES[0].presets[0]);
    const [availability, setAvailability] = useState('available');
    const [quantity, setQuantity] = useState(1);
    const [costMode, setCostMode] = useState('Free');
    const [customCost, setCustomCost] = useState('');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const selectedType = useMemo(
        () => RESOURCE_TYPES.find((item) => item.value === resourceType) || RESOURCE_TYPES[0],
        [resourceType]
    );

    const costPerUse = costMode === 'Paid per use' && customCost.trim()
        ? `₹${customCost.trim()} / use`
        : costMode;

    const title = useMemo(() => {
        if (quantity > 1) return `${preset} (${quantity} available)`;
        return preset;
    }, [preset, quantity]);

    const description = useMemo(() => {
        const noteText = note.trim() ? ` ${note.trim()}` : '';
        return `${preset} shared with group. ${availability === 'available' ? 'Ready to use.' : 'Currently busy but can be scheduled.'}${noteText}`.trim();
    }, [preset, availability, note]);

    const handleTypeChange = (nextType) => {
        const next = RESOURCE_TYPES.find((item) => item.value === nextType) || RESOURCE_TYPES[0];
        setResourceType(nextType);
        setPreset(next.presets[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupId) {
            setError('Group ID is missing.');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/resources`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    title,
                    resource_type: RESOURCE_TYPE_TO_DB[resourceType] || 'equipment',
                    description,
                    availability_status: availability,
                    quantity: String(quantity),
                    cost_per_use: costPerUse,
                }),
            });
            if (!response.ok) throw new Error('Failed to add resource');
            dispatchDataRefresh(['community', 'notifications']);
            navigate(`/community/groups/${groupId}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-8">
            <header className="bg-primary px-5 py-4 text-white shadow-sm flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-lg font-bold">Share Resource</h1>
            </header>

            <main className="flex-1 p-5">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center">
                            <PackagePlus className="w-8 h-8 text-amber-500" />
                        </div>
                    </div>
                    <p className="text-center text-sm text-slate-500 mb-6">
                        Share equipment, transport, or useful farm resources with only a few taps. The post will also be announced in group chat.
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 text-sm mb-4">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Resource Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {RESOURCE_TYPES.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleTypeChange(option.value)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            resourceType === option.value
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Select Resource</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedType.presets.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setPreset(item)}
                                        className={`rounded-full px-3 py-2 text-xs font-semibold border transition-colors ${
                                            preset === item
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Quantity</label>
                                <span className="text-sm font-bold text-slate-700">{quantity}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                className="w-full accent-amber-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Availability</label>
                            <div className="grid grid-cols-2 gap-2">
                                {AVAILABILITY.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setAvailability(option.value)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            availability === option.value
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cost</label>
                            <div className="grid grid-cols-3 gap-2">
                                {COST_MODES.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setCostMode(option.value)}
                                        className={`rounded-2xl px-3 py-3 text-xs font-semibold border transition-colors ${
                                            costMode === option.value
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                            {costMode === 'Paid per use' && (
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="Enter amount in rupees"
                                    value={customCost}
                                    onChange={(e) => setCustomCost(e.target.value)}
                                    className="w-full mt-3 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Optional Note</label>
                            <textarea
                                placeholder="Add one short condition if needed"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 min-h-[88px]"
                            />
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
                            <p className="text-sm font-bold text-slate-800 mt-2">{title}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
                            <p className="text-xs text-green-700 font-semibold mt-2">{costPerUse}</p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Share Resource'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AddSharedResource;
