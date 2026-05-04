import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, MapPin } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';
import { dispatchDataRefresh } from '../lib/appEvents';

const API = API_BASE;

const DESTINATION_TYPES = [
    { value: 'mandi', label: 'Market / Mandi', presets: ['APMC market', 'Village mandi', 'Wholesale yard', 'Collection point'] },
    { value: 'bank', label: 'Town / Service', presets: ['Bank branch', 'Government office', 'Hospital', 'Town center'] },
];

const FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Market day', 'On demand'];
const COST_OPTIONS = ['Fuel split', 'Free lift', 'Paid transport'];

const AddCommonRoute = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const groupId = new URLSearchParams(location.search).get('groupId');

    const [destinationType, setDestinationType] = useState(DESTINATION_TYPES[0].value);
    const [destinationName, setDestinationName] = useState(DESTINATION_TYPES[0].presets[0]);
    const [frequency, setFrequency] = useState('Weekly');
    const [seats, setSeats] = useState(3);
    const [costMode, setCostMode] = useState('Fuel split');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const selectedType = useMemo(
        () => DESTINATION_TYPES.find((item) => item.value === destinationType) || DESTINATION_TYPES[0],
        [destinationType]
    );

    const routeName = useMemo(() => `${frequency} trip to ${destinationName}`, [frequency, destinationName]);
    const notes = useMemo(() => {
        const base = `${seats} seat${seats === 1 ? '' : 's'} available • ${costMode}.`;
        return note.trim() ? `${base} ${note.trim()}` : base;
    }, [seats, costMode, note]);

    const handleTypeChange = (nextType) => {
        const next = DESTINATION_TYPES.find((item) => item.value === nextType) || DESTINATION_TYPES[0];
        setDestinationType(nextType);
        setDestinationName(next.presets[0]);
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
            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/routes`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    route_name: routeName,
                    destination_type: destinationType,
                    destination_name: destinationName,
                    frequency,
                    notes,
                }),
            });

            if (!response.ok) throw new Error('Failed to create route');
            dispatchDataRefresh(['community', 'notifications']);
            navigate(`/community/groups/${groupId}`);
        } catch (err) {
            console.error(err);
            setError('Failed to share route. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-8">
            <header className="bg-primary px-6 pt-8 pb-6 text-white rounded-b-[2rem] shadow-md relative z-10">
                <button onClick={() => navigate(-1)} className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors mb-4 backdrop-blur-sm">
                    <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                        <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Share Route</h1>
                        <p className="text-white/80 text-sm mt-0.5">Set up a reusable trip in a few taps</p>
                    </div>
                </div>
            </header>

            <main className="px-6 py-6 -mt-3 relative z-20">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-start gap-3 shadow-sm">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Destination Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {DESTINATION_TYPES.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleTypeChange(option.value)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            destinationType === option.value
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Destination</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedType.presets.map((item) => (
                                    <button
                                        key={item}
                                        type="button"
                                        onClick={() => setDestinationName(item)}
                                        className={`rounded-full px-3 py-2 text-xs font-semibold border transition-colors ${
                                            destinationName === item
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
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Frequency</label>
                            <div className="grid grid-cols-2 gap-2">
                                {FREQUENCY_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setFrequency(option)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            frequency === option
                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Seats / Shared Slots</label>
                                <span className="text-sm font-bold text-slate-700">{seats}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="10"
                                value={seats}
                                onChange={(e) => setSeats(Number(e.target.value))}
                                className="w-full accent-blue-600"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Cost Mode</label>
                            <div className="grid grid-cols-3 gap-2">
                                {COST_OPTIONS.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setCostMode(option)}
                                        className={`rounded-2xl px-3 py-3 text-xs font-semibold border transition-colors ${
                                            costMode === option
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Optional Note</label>
                            <textarea
                                rows="3"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-sm resize-none"
                                placeholder="Add a pickup time or short instruction"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
                        <p className="text-sm font-bold text-slate-800 mt-2">{routeName}</p>
                        <p className="text-xs text-slate-500 mt-1">{notes}</p>
                    </div>

                    <button type="submit" disabled={submitting}
                        className="w-full py-4 rounded-2xl font-bold flex flex-col items-center justify-center bg-primary hover:bg-primary/90 text-white shadow-lg disabled:opacity-70 disabled:scale-100 transition-all active:scale-[0.98]">
                        {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Share Route</span>}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default AddCommonRoute;
