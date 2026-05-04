/**
 * FarmerRegistrationFlow — Onboarding with GPS Autofill
 * ─────────────────────────────────────────────────────
 *
 * Step 1: Name + Location Permission → GPS autofills state/district/village
 * Step 2: Location Details (pre-filled if GPS worked, or manual)
 * Step 3: Farm Details → writes to farmers + farms
 *
 * @see reverseGeocode.js for GPS → address conversion
 */
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Leaf, Shield, CheckCircle2, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/apiBase';
import { reverseGeocode } from '../lib/reverseGeocode';

const FarmerRegistrationFlow = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoading: authLoading } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');

    const phoneFromState = location.state?.phone || '';
    const isSignup = location.state?.isSignup || false;

    const [formData, setFormData] = useState({
        name: '',
        role: 'farmer',
        state: '',
        district: '',
        village: '',
        farmName: '',
        farmSize: '',
        irrigationTypes: [],
    });

    const [locationStatus, setLocationStatus] = useState('pending');
    const [coordinates, setCoordinates] = useState({ lat: null, lng: null });
    const [gpsAutofilled, setGpsAutofilled] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);

    const [states, setStates] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [loadingLocations, setLoadingLocations] = useState(false);

    // Prefill name from existing farmer data
    useEffect(() => {
        if (user?.id) {
            prefillFromExisting();
        }
    }, [user?.id]);

    useEffect(() => { fetchStates(); }, []);

    useEffect(() => {
        if (formData.state) {
            fetchDistricts(formData.state);
        } else {
            setDistricts([]);
        }
    }, [formData.state]);

    const prefillFromExisting = async () => {
        const { data } = await supabase
            .from('farmers')
            .select('full_name, state, district, village')
            .eq('id', user.id)
            .single();
        if (data && data.full_name) {
            setFormData(prev => ({
                ...prev,
                name: data.full_name || '',
                state: data.state || '',
                district: data.district || '',
                village: data.village || '',
            }));
        }
    };

    const fetchStates = async () => {
        const { data, error } = await supabase
            .from('ref_locations')
            .select('state')
            .order('state');
        if (!error && data) {
            const unique = [...new Set(data.map(r => r.state))];
            setStates(unique);
        } else {
            setStates(['Telangana', 'Tamil Nadu', 'Andhra Pradesh']);
        }
    };

    const fetchDistricts = async (state) => {
        setLoadingLocations(true);
        const { data, error } = await supabase
            .from('ref_locations')
            .select('district')
            .eq('state', state)
            .order('district');
        if (!error && data) {
            setDistricts([...new Set(data.map(r => r.district))]);
        } else {
            setDistricts([]);
        }
        setLoadingLocations(false);
    };

    const requestLocation = async () => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            return;
        }
        setLocationStatus('requesting');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setCoordinates({ lat: latitude, lng: longitude });
                setLocationStatus('granted');

                // Attempt reverse geocoding for autofill
                setGpsLoading(true);
                try {
                    const geo = await reverseGeocode(latitude, longitude);
                    if (geo.state || geo.district) {
                        setFormData(prev => ({
                            ...prev,
                            state: geo.state || prev.state,
                            district: geo.district || prev.district,
                            village: geo.village || prev.village,
                        }));
                        setGpsAutofilled(true);
                    }
                } catch (err) {
                    console.warn('[Registration] Reverse geocode failed:', err);
                }
                setGpsLoading(false);
            },
            (error) => {
                console.warn('[Registration] Geolocation denied:', error.message);
                setLocationStatus('denied');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const handleNext = () => {
        if (step === 1) {
            setStep(2);
            setSubmitError('');
        } else if (step === 2) {
            if (formData.role === 'admin') {
                // Admins don't need a farm, skip step 3 entirely
                handleComplete();
            } else {
                setStep(3);
                setSubmitError('');
            }
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleComplete = async () => {
        setIsSubmitting(true);
        setSubmitError('');

        try {
            let activeUserId = user?.id;
            let activeEmail = user?.email;

            // If user isn't logged in, they are a new registration
            if (!activeUserId) {
                if (!phoneFromState) {
                    setSubmitError('Phone number missing. Please start from login.');
                    setIsSubmitting(false);
                    return;
                }

                // 1. Ask FastAPI backend to create the account via Service Role (bypassing limits)
                let backendHost = API_BASE;
                if (backendHost.endsWith('/')) backendHost = backendHost.slice(0, -1);
                
                const regRes = await fetch(`${backendHost}/api/v1/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: phoneFromState, password: 'password123456' })
                });

                if (!regRes.ok) {
                    const errObj = await regRes.json().catch(() => ({}));
                    throw new Error(errObj.detail || 'Failed to create user on backend');
                }

                // 2. Actually sign them in locally to obtain a JWT Session
                const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
                    email: `+91${phoneFromState}@ks.com`,
                    password: 'password123456'
                });

                if (signInErr || !authData?.user) {
                    throw new Error(`Auto-login failed: ${signInErr?.message}`);
                }

                activeUserId = authData.user.id;
                activeEmail = authData.user.email;
            }
            
            const phoneNumber = activeEmail ? activeEmail.split('@')[0] : phoneFromState;
            
            // Insert or update user profile
            const { error: updateError } = await supabase
                .from('farmers')
                .upsert({
                    id: activeUserId,
                    full_name: formData.name || (formData.role === 'admin' ? 'Admin' : 'Farmer'),
                    phone_number: phoneNumber,
                    state: formData.state,
                    district: formData.district,
                    village: formData.village || null,
                    role: formData.role,
                    onboarding_complete: true,
                });

            if (updateError) {
                console.error('[Registration] Farmer update error:', updateError.message);
                setSubmitError('Failed to save your profile. Please try again.');
                setIsSubmitting(false);
                return;
            }

            // Insert farm if farm details provided
            if (formData.farmName || formData.farmSize) {
                await supabase.from('farms').insert({
                    farmer_id: activeUserId,
                    farm_name: formData.farmName || 'My Farm',
                    area_acres: formData.farmSize ? parseFloat(formData.farmSize) : null,
                    irrigation_type: formData.irrigationTypes.length > 0 ? formData.irrigationTypes : null,
                    latitude: coordinates.lat,
                    longitude: coordinates.lng,
                });
            }

            if (formData.role === 'admin') {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('[Registration] Unexpected error:', err);
            setSubmitError(`Something went wrong: ${err.message || err}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isStepValid = () => {
        switch (step) {
            case 1: return formData.name.trim().length > 0;
            case 2: return formData.state && formData.district;
            case 3: return true;
            default: return false;
        }
    };

    if (authLoading && !isSignup) {
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
                    <div className="bg-white/20 p-2 rounded-xl"><Leaf className="w-6 h-6" /></div>
                    <h1 className="text-2xl font-bold tracking-tight">{formData.role === 'admin' ? 'KVK Registration' : 'Krishi Sakhi'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${(step / (formData.role === 'admin' ? 2 : 3)) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium">{step}/{formData.role === 'admin' ? 2 : 3}</span>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 p-6 z-10 -mt-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">

                    {/* Step 1: Name + Location */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Personal Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Tell us a bit about yourself</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Full Name</label>
                                <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="Enter your full name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>

                            <div className="space-y-1.5 mt-4">
                                <label className="text-sm font-medium text-slate-700">I am a:</label>
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, role: 'farmer'})}
                                        className={`p-3 border rounded-xl font-semibold text-sm transition-colors ${formData.role === 'farmer' ? 'bg-primary border-primary text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        👨🏽‍🌾 Farmer
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData({...formData, role: 'admin'})}
                                        className={`p-3 border rounded-xl font-semibold text-sm transition-colors ${formData.role === 'admin' ? 'bg-primary border-primary text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        🛠️ Extension Worker
                                    </button>
                                </div>
                            </div>

                            {/* Location Card */}
                            <div className="mt-4">
                                {locationStatus === 'pending' && (
                                    <button onClick={requestLocation} className="w-full flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl text-left hover:bg-blue-100 transition-colors group">
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <MapPin className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800 text-sm">Enable Location</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Auto-fill your region & get local weather</p>
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
                                            {gpsLoading ? <Loader2 className="w-6 h-6 text-green-600 animate-spin" /> : <CheckCircle2 className="w-6 h-6 text-green-600" />}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-green-800 text-sm">
                                                {gpsLoading ? '📍 Detecting your location...' : gpsAutofilled ? '📍 Location auto-filled!' : '📍 Location Captured'}
                                            </p>
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
                                            <p className="text-xs text-slate-500 mt-0.5">You can enter your location manually</p>
                                        </div>
                                        <button onClick={requestLocation} className="text-primary text-xs font-semibold underline flex-shrink-0">Retry</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Location */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Location Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Where is your farm located?</p>
                            </div>

                            {gpsAutofilled && (
                                <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-xl border border-green-100 mb-2">
                                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-xs font-medium text-green-700">📍 Auto-filled from GPS — you can edit below</span>
                                </div>
                            )}

                            {coordinates.lat && !gpsAutofilled && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100 mb-2">
                                    <MapPin className="w-3.5 h-3.5 text-green-600" />
                                    <span className="text-xs font-medium text-green-700">📍 GPS: {coordinates.lat?.toFixed(4)}, {coordinates.lng?.toFixed(4)}</span>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">State</label>
                                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white outline-none" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value, district: '' })}>
                                    <option value="">Select State</option>
                                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                                    {/* Allow typed GPS state even if not in ref_locations */}
                                    {formData.state && !states.includes(formData.state) && (
                                        <option value={formData.state}>{formData.state} (GPS)</option>
                                    )}
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
                                        <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white outline-none" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} disabled={!formData.state}>
                                            <option value="">Select District</option>
                                            {districts.map(d => <option key={d} value={d}>{d}</option>)}
                                            {formData.district && !districts.includes(formData.district) && (
                                                <option value={formData.district}>{formData.district} (GPS)</option>
                                            )}
                                        </select>
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Village/Town</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="Village" value={formData.village} onChange={(e) => setFormData({ ...formData, village: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Farm */}
                    {step === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Farm Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Help us personalize your experience</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Farm Name</label>
                                <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder='e.g. "North Plot" or "River Field"' value={formData.farmName} onChange={(e) => setFormData({ ...formData, farmName: e.target.value })} />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Total Farm Size (Acres)</label>
                                <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="e.g. 5" value={formData.farmSize} onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })} />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Irrigation Type (Select multiple)</label>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    {[
                                        { value: 'rainfed', label: '🌧️ Rainfed' },
                                        { value: 'canal', label: '🏞️ Canal' },
                                        { value: 'borewell', label: '💧 Borewell' },
                                        { value: 'drip', label: '💦 Drip' },
                                        { value: 'other', label: '🔧 Other' },
                                    ].map(opt => {
                                        const isSelected = formData.irrigationTypes.includes(opt.value);
                                        return (
                                            <button 
                                                key={opt.value} 
                                                type="button" 
                                                onClick={() => {
                                                    setFormData(prev => {
                                                        const newArr = isSelected 
                                                            ? prev.irrigationTypes.filter(i => i !== opt.value)
                                                            : [...prev.irrigationTypes, opt.value];
                                                        return { ...prev, irrigationTypes: newArr };
                                                    });
                                                }}
                                                className={`flex items-center p-3 border rounded-xl transition-all text-sm font-medium ${isSelected ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {submitError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">{submitError}</div>
                )}

                <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <Shield className="w-5 h-5 text-primary flex-shrink-0" />
                        <p className="text-sm text-slate-600 font-medium">Your data is secure and stored locally</p>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        <p className="text-sm text-slate-600 font-medium">Join 100,000+ happy farmers</p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-6 bg-white border-t border-slate-100 mt-auto pb-8">
                <div className="flex gap-3">
                    {step > 1 && (
                        <button onClick={handleBack} className="px-6 py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                    )}
                    <button onClick={handleNext} disabled={!isStepValid() || isSubmitting} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : step === 3 ? <>Complete Registration <ChevronRight className="w-5 h-5" /></> : <>Continue <ChevronRight className="w-5 h-5" /></>}
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default FarmerRegistrationFlow;
