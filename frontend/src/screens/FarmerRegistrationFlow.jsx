/**
 * FarmerRegistrationFlow — Onboarding Screen
 * ───────────────────────────────────────────
 * 3-step mock onboarding that updates the demo user's farmer profile.
 * Requests geolocation permission in Step 1.
 *
 * Step 1: Personal Details + Location Permission
 * Step 2: Location Details (from ref_locations table)
 * Step 3: Farm Details → writes to farmers + farms tables
 *
 * @see frontend-engineer.md §9 — Route: /register, Auth: Yes
 */
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Leaf, Shield, CheckCircle2, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const FarmerRegistrationFlow = () => {
    const navigate = useNavigate();
    const { user, isLoading: authLoading } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        state: '',
        district: '',
        village: '',
        farmName: '',
        farmSize: '',
        irrigationType: '',
    });

    // Location permission state
    const [locationStatus, setLocationStatus] = useState('pending'); // pending | requesting | granted | denied
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });

    // ref_locations data
    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Fetch ref_locations on mount
    useEffect(() => {
        fetchStates();
    }, []);

    // Fetch districts when state changes
    useEffect(() => {
        if (formData.state) {
            fetchDistricts(formData.state);
        } else {
            setDistricts([]);
        }
    }, [formData.state]);

    const fetchStates = async () => {
        try {
            const { data, error } = await supabase
                .from('ref_locations')
                .select('state')
                .order('state');

            if (error) {
                console.error('[Registration] Failed to fetch states:', error.message);
                // Fallback: provide common states
                setStates(['Telangana', 'Tamil Nadu', 'Andhra Pradesh']);
                return;
            }

            const uniqueStates = [...new Set(data.map(r => r.state))];
            setStates(uniqueStates);
        } catch (err) {
            console.error('[Registration] Unexpected error fetching states:', err);
            setStates(['Telangana', 'Tamil Nadu', 'Andhra Pradesh']);
        }
    };

    const fetchDistricts = async (state) => {
        setLoadingLocations(true);
        try {
            const { data, error } = await supabase
                .from('ref_locations')
                .select('district')
                .eq('state', state)
                .order('district');

            if (error) {
                console.error('[Registration] Failed to fetch districts:', error.message);
                setDistricts([]);
                return;
            }

            const uniqueDistricts = [...new Set(data.map(r => r.district))];
            setDistricts(uniqueDistricts);
        } catch (err) {
            console.error('[Registration] Unexpected error fetching districts:', err);
            setDistricts([]);
        } finally {
            setLoadingLocations(false);
        }
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            return;
        }

        setLocationStatus('requesting');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoordinates({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setLocationStatus('granted');
            },
            (error) => {
                console.warn('[Registration] Geolocation denied:', error.message);
                setLocationStatus('denied');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const handleNext = () => {
        if (step < 3) {
            setStep(step + 1);
            setSubmitError('');
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleComplete = async () => {
        if (!user) {
            setSubmitError('Session expired. Please log in again.');
            return;
        }

        setIsSubmitting(true);
        setSubmitError('');

        try {
            // 1. Update farmer profile
            const { error: updateError } = await supabase
                .from('farmers')
                .update({
                    full_name: formData.name || 'Ramesh Kumar',
                    state: formData.state,
                    district: formData.district,
                    village: formData.village || null,
                    onboarding_complete: true,
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('[Registration] Farmer update error:', updateError.message);
                setSubmitError('Failed to save your profile. Please try again.');
                setIsSubmitting(false);
                return;
            }

            // 2. Insert farm
            const { error: farmError } = await supabase
                .from('farms')
                .insert({
                    farmer_id: user.id,
                    farm_name: formData.farmName || 'My Farm',
                    area_acres: formData.farmSize ? parseFloat(formData.farmSize) : null,
                    irrigation_type: formData.irrigationType || null,
                    latitude: coordinates.lat,
                    longitude: coordinates.lng,
                });

            if (farmError) {
                console.error('[Registration] Farm insert error:', farmError.message);
                // Farm insert failed but farmer was updated — still navigate
                // The user can add a farm later
            }

            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('[Registration] Unexpected error:', err);
            setSubmitError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1: return formData.name.trim().length > 0;
            case 2: return formData.state && formData.district;
            case 3: return true; // Farm details are optional
            default: return false;
        }
    };

    // Show loading while auth state is being determined
    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-primary text-primary-foreground p-6 rounded-b-3xl shadow-md">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <Leaf className="w-6 h-6" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">Krishi Sakhi</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                        <div className={`h-full bg-white rounded-full transition-all duration-500`} style={{ width: `${(step / 3) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium">{step}/3</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 z-10 -mt-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">

                    {/* ─── Step 1: Personal Details + Location Permission ─── */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Personal Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Tell us a bit about yourself</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="Enter your full name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            {/* Location Permission Card */}
                            <div className="mt-4">
                                {locationStatus === 'pending' && (
                                    <button
                                        onClick={requestLocation}
                                        className="w-full flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-left hover:bg-blue-100 transition-colors group"
                                    >
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <MapPin className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">Enable Location</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Allow GPS to auto-fill your region and get local weather data</p>
                                        </div>
                                    </button>
                                )}

                                {locationStatus === 'requesting' && (
                                    <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">Requesting Location...</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Please allow location access in your browser</p>
                                        </div>
                                    </div>
                                )}

                                {locationStatus === 'granted' && (
                                    <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <CheckCircle2 className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-green-800 text-sm">📍 Location Captured</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                GPS: {coordinates.lat?.toFixed(4)}, {coordinates.lng?.toFixed(4)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {locationStatus === 'denied' && (
                                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <AlertCircle className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-700 text-sm">Location Not Available</p>
                                            <p className="text-xs text-slate-500 mt-0.5">You can enter your location manually in the next step</p>
                                        </div>
                                        <button
                                            onClick={requestLocation}
                                            className="text-primary text-xs font-semibold underline flex-shrink-0"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── Step 2: Location Details ─── */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Location Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Where is your farm located?</p>
                            </div>

                            {/* GPS Badge */}
                            {coordinates.lat && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100 mb-2">
                                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-xs font-medium text-green-700">
                                        📍 GPS captured — {coordinates.lat?.toFixed(4)}, {coordinates.lng?.toFixed(4)}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">State</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white outline-none"
                                    value={formData.state}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value, district: '' })}
                                >
                                    <option value="">Select State</option>
                                    {states.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">District</label>
                                    {loadingLocations ? (
                                        <div className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                            <span className="text-sm text-slate-400">Loading...</span>
                                        </div>
                                    ) : (
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white outline-none"
                                            value={formData.district}
                                            onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                            disabled={!formData.state}
                                        >
                                            <option value="">Select District</option>
                                            {districts.map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Village/Town</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                        placeholder="Village"
                                        value={formData.village}
                                        onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Step 3: Farm Details ─── */}
                    {step === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Farm Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Help us personalize your experience</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Farm Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder='e.g. "North Plot" or "River Field"'
                                    value={formData.farmName}
                                    onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Total Farm Size (in Acres)</label>
                                <input
                                    type="number"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="e.g. 5"
                                    value={formData.farmSize}
                                    onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Irrigation Type</label>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    {[
                                        { value: 'rainfed', label: '🌧️ Rainfed' },
                                        { value: 'canal', label: '🏞️ Canal' },
                                        { value: 'borewell', label: '💧 Borewell' },
                                        { value: 'drip', label: '💦 Drip' },
                                        { value: 'other', label: '🔧 Other' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, irrigationType: option.value })}
                                            className={`flex items-center p-3 border rounded-xl transition-all text-sm font-medium ${formData.irrigationType === option.value
                                                    ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Banner */}
                {submitError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium animate-in fade-in duration-300">
                        {submitError}
                    </div>
                )}

                {/* Feature Highlights */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                        <p className="text-sm text-slate-600 font-medium">Your data is secure and encrypted</p>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <p className="text-sm text-slate-600 font-medium">Join 100,000+ happy farmers</p>
                    </div>
                </div>

            </main>

            {/* Footer Navigation */}
            <footer className="p-6 bg-white border-t border-slate-100 mt-auto pb-8">
                <div className="flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={handleBack}
                            className="px-6 py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={!isStepValid() || isSubmitting}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : step === 3 ? (
                            <>
                                Complete Registration
                                <ChevronRight className="w-5 h-5" />
                            </>
                        ) : (
                            <>
                                Continue
                                <ChevronRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default FarmerRegistrationFlow;
