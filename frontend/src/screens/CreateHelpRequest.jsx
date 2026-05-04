import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, HeartHandshake, Loader2 } from 'lucide-react';

import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';
import { dispatchDataRefresh } from '../lib/appEvents';

const API = API_BASE;

const CATEGORY_OPTIONS = [
    { value: 'labour_needed', label: 'Labour', presets: ['Harvest help', 'Weeding help', 'Spraying help', 'Loading help'] },
    { value: 'equipment_needed', label: 'Equipment', presets: ['Tractor', 'Sprayer', 'Rotavator', 'Water pump'] },
    { value: 'transport_share', label: 'Transport', presets: ['Mandi trip', 'Pickup transport', 'Tempo sharing', 'Input transport'] },
    { value: 'advice_needed', label: 'Advice', presets: ['Pest advice', 'Fertilizer advice', 'Selling advice', 'Weather guidance'] },
    { value: 'seeds_needed', label: 'Seeds', presets: ['Cotton seed', 'Paddy seed', 'Maize seed', 'Nursery support'] },
];

const URGENCY_LEVELS = [
    { value: 'normal', label: 'Flexible' },
    { value: 'urgent', label: 'Urgent' },
];

const CreateHelpRequest = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const groupId = new URLSearchParams(location.search).get('groupId');

    const [category, setCategory] = useState(CATEGORY_OPTIONS[0].value);
    const [preset, setPreset] = useState(CATEGORY_OPTIONS[0].presets[0]);
    const [urgency, setUrgency] = useState('normal');
    const [peopleNeeded, setPeopleNeeded] = useState(2);
    const [daysVisible, setDaysVisible] = useState(7);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const selectedCategory = useMemo(
        () => CATEGORY_OPTIONS.find((item) => item.value === category) || CATEGORY_OPTIONS[0],
        [category]
    );

    const generatedTitle = useMemo(() => {
        if (category === 'labour_needed') return `${preset} needed for ${peopleNeeded} ${peopleNeeded === 1 ? 'person' : 'people'}`;
        if (category === 'equipment_needed') return `Need ${preset.toLowerCase()} for farm work`;
        if (category === 'transport_share') return `Need ${preset.toLowerCase()} with group support`;
        if (category === 'seeds_needed') return `Need help arranging ${preset.toLowerCase()}`;
        return `Need ${preset.toLowerCase()} from the group`;
    }, [category, preset, peopleNeeded]);

    const generatedDescription = useMemo(() => {
        const noteText = note.trim() ? ` ${note.trim()}` : '';
        if (category === 'labour_needed') {
            return `Need ${peopleNeeded} ${peopleNeeded === 1 ? 'person' : 'people'} for ${preset.toLowerCase()}.${noteText}`.trim();
        }
        return `${preset} support requested from the group.${noteText}`.trim();
    }, [category, preset, peopleNeeded, note]);

    const handleCategoryChange = (nextCategory) => {
        const next = CATEGORY_OPTIONS.find((item) => item.value === nextCategory) || CATEGORY_OPTIONS[0];
        setCategory(nextCategory);
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
            const body = {
                title: generatedTitle,
                category,
                urgency,
                description: generatedDescription,
                expires_in_days: daysVisible,
            };

            const response = await fetch(`${API}/api/v1/cooperative/groups/${groupId}/help-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });
            if (!response.ok) throw new Error('Failed to submit request');
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
                <h1 className="text-lg font-bold">Ask for Help</h1>
            </header>

            <main className="flex-1 p-5">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                            <HeartHandshake className="w-8 h-8 text-blue-500" />
                        </div>
                    </div>
                    <p className="text-center text-sm text-slate-500 mb-6">
                        Use quick selections to post a clear help request without typing a full message. The request will appear on the help board and in the group chat.
                    </p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl flex items-start gap-2 text-sm mb-4">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Need Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORY_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => handleCategoryChange(option.value)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            category === option.value
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
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">What Exactly</label>
                            <div className="flex flex-wrap gap-2">
                                {selectedCategory.presets.map((item) => (
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

                        {category === 'labour_needed' && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">People Needed</label>
                                    <span className="text-sm font-bold text-slate-700">{peopleNeeded}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={peopleNeeded}
                                    onChange={(e) => setPeopleNeeded(Number(e.target.value))}
                                    className="w-full accent-green-600"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Urgency</label>
                            <div className="grid grid-cols-2 gap-2">
                                {URGENCY_LEVELS.map((level) => (
                                    <button
                                        key={level.value}
                                        type="button"
                                        onClick={() => setUrgency(level.value)}
                                        className={`rounded-2xl px-3 py-3 text-sm font-semibold border transition-colors ${
                                            urgency === level.value
                                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}
                                    >
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Keep Visible For</label>
                                <span className="text-sm font-bold text-slate-700">{daysVisible} day{daysVisible === 1 ? '' : 's'}</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="14"
                                value={daysVisible}
                                onChange={(e) => setDaysVisible(Number(e.target.value))}
                                className="w-full accent-blue-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Optional Note</label>
                            <textarea
                                placeholder="Add one short detail if needed"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 min-h-[88px]"
                            />
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
                            <p className="text-sm font-bold text-slate-800 mt-2">{generatedTitle}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{generatedDescription}</p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all flex justify-center items-center gap-2 mt-2"
                        >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Request'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default CreateHelpRequest;
