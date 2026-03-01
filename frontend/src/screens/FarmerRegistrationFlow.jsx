import React, { useState } from 'react';
import { ChevronRight, Leaf, Shield, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FarmerRegistrationFlow = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        state: '',
        district: '',
        village: '',
        farmSize: '',
        primaryCrop: ''
    });

    const handleNext = () => {
        if (step < 3) setStep(step + 1);
        else navigate('/dashboard');
    };

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

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Phone Number</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                    placeholder="+91"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Location Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Where is your farm located?</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">State</label>
                                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white outline-none">
                                    <option value="">Select State</option>
                                    <option value="maharashtra">Maharashtra</option>
                                    <option value="punjab">Punjab</option>
                                    <option value="gujarat">Gujarat</option>
                                    <option value="telangana">Telangana</option>
                                    <option value="karnataka">Karnataka</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">District</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="District" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-slate-700">Village/Town</label>
                                    <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="Village" />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Farm Details</h2>
                                <p className="text-sm text-slate-500 mt-1">Help us personalize your experience</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Total Farm Size (in Acres)</label>
                                <input type="number" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="e.g. 5" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-700">Primary Crops Grown</label>
                                <div className="grid grid-cols-2 gap-3 mt-2">
                                    {['Wheat', 'Rice', 'Cotton', 'Sugarcane', 'Soybean', 'Other'].map((crop) => (
                                        <div key={crop} className="flex items-center p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                                            <input type="checkbox" id={crop} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
                                            <label htmlFor={crop} className="ml-2 text-sm text-slate-700 font-medium w-full cursor-pointer">{crop}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Feature Highlights */}
                <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <Shield className="w-5 h-5 text-primary" />
                        <p className="text-sm text-slate-600 font-medium">Your data is secure and encrypted</p>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        <p className="text-sm text-slate-600 font-medium">Join 100,000+ happy farmers</p>
                    </div>
                </div>

            </main>

            {/* Footer Navigation */}
            <footer className="p-6 bg-white border-t border-slate-100 mt-auto pb-8">
                <button
                    onClick={handleNext}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/25"
                >
                    {step === 3 ? 'Complete Registration' : 'Continue'}
                    <ChevronRight className="w-5 h-5" />
                </button>
            </footer>
        </div>
    );
};

export default FarmerRegistrationFlow;
