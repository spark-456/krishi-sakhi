import React, { useState } from 'react';
import { ArrowLeft, Map, LocateFixed, TreePine, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const AddNewFarmScreen = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        size: '',
        soilType: '',
        irrigation: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        navigate('/farms');
    };

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
                {/* Map Selection Area (Simulated) */}
                <div className="relative h-64 bg-slate-200 w-full overflow-hidden">
                    <img
                        src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop"
                        alt="Map View"
                        className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-primary bg-primary/20 rounded-lg relative">
                            <div className="absolute -top-3 -left-3 bg-white p-1 rounded shadow-sm">
                                <div className="bg-primary w-2 h-2 rounded-full" />
                            </div>
                        </div>
                    </div>
                    <button className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg text-slate-700 hover:text-primary transition-colors">
                        <LocateFixed className="w-5 h-5" />
                    </button>
                    <div className="absolute top-4 left-4 right-4 bg-white/90 backdrop-blur-sm px-4 py-3 rounded-xl shadow-sm border border-white flex items-center gap-3">
                        <Map className="w-5 h-5 text-primary" />
                        <p className="text-sm font-semibold text-slate-700 truncate">Selecting: Plot 42, Ahmednagar</p>
                    </div>
                </div>

                {/* Form Details */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">Farm Alias/Name</label>
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
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">Soil Type (Optional)</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-slate-800 appearance-none"
                                value={formData.soilType}
                                onChange={(e) => setFormData({ ...formData, soilType: e.target.value })}
                            >
                                <option value="">Select</option>
                                <option value="black">Black Soil</option>
                                <option value="red">Red Soil</option>
                                <option value="alluvial">Alluvial</option>
                                <option value="laterite">Laterite</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <label className="text-sm font-bold text-slate-700">Primary Irrigation Method</label>
                        <div className="grid grid-cols-2 gap-3">
                            {['Rainfed', 'Drip', 'Sprinkler', 'Canal', 'Tube Well', 'Other'].map((method) => (
                                <div
                                    key={method}
                                    onClick={() => setFormData({ ...formData, irrigation: method })}
                                    className={`px-4 py-3 border rounded-xl text-center text-sm font-semibold cursor-pointer transition-colors ${formData.irrigation === method
                                            ? 'border-primary bg-primary/5 text-primary'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                        }`}
                                >
                                    {method}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>
            </main>

            {/* Floating Action Bar */}
            <div className="fixed max-w-md w-full bottom-0 bg-white border-t border-slate-100 p-4 pb-8 z-30">
                <button
                    onClick={handleSubmit}
                    className="w-full bg-primary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all active:scale-[0.98]"
                >
                    <Save className="w-5 h-5" /> Save Farm Details
                </button>
            </div>
        </div>
    );
};

export default AddNewFarmScreen;
