import React from 'react';
import { Plus, MapPin, AlertTriangle, FileText, ChevronRight, Sprout, CloudRain } from 'lucide-react';
import { Link } from 'react-router-dom';

const MyFarmsAndCropsList = () => {
    const farms = [
        {
            id: 1,
            name: "Farm 1 - Main Acreage",
            location: "Pune, Maharashtra",
            size: "5 Acres",
            crops: [
                { name: "Wheat (HD 2967)", stage: "Vegetative", health: "Good", nextAction: "Apply Urea in 2 days" }
            ]
        },
        {
            id: 2,
            name: "Farm 2 - River Side",
            location: "Pune, Maharashtra",
            size: "2.5 Acres",
            crops: [
                { name: "Sugarcane", stage: "Tillering", health: "Attention Needed", nextAction: "Check for red rot disease" }
            ]
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-primary px-6 py-5 text-primary-foreground shadow-md rounded-b-3xl relative z-10">
                <h1 className="text-2xl font-bold tracking-tight mb-1">My Farms & Crops</h1>
                <p className="text-white/80 text-sm font-medium">Manage your agricultural portfolio</p>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-5 space-y-5 -mt-2">

                {/* Farm Cards */}
                {farms.map((farm) => (
                    <div key={farm.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {/* Card Header */}
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    {farm.name}
                                </h2>
                                <p className="text-sm text-slate-500 ml-6 mt-0.5">{farm.location} • {farm.size}</p>
                            </div>
                            <button className="text-primary p-2 hover:bg-primary/5 rounded-full transition-colors">
                                <FileText className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Crops List */}
                        <div className="p-4 space-y-3">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Crops</h3>

                            {farm.crops.map((crop, idx) => (
                                <div key={idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 relative group cursor-pointer hover:border-primary/30 transition-colors">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-emerald-100 p-1.5 rounded-lg text-emerald-600">
                                                <Sprout className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-slate-800 text-[15px]">{crop.name}</span>
                                        </div>
                                        {crop.health === 'Good' ? (
                                            <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase">Healthy</span>
                                        ) : (
                                            <span className="bg-rose-50 text-rose-600 text-[10px] font-bold px-2 py-1 rounded-md uppercase flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> Issue
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-3">
                                        <div>
                                            <p className="text-[11px] text-slate-500 font-medium">Growth Stage</p>
                                            <p className="text-sm font-semibold text-slate-700">{crop.stage}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-slate-500 font-medium">Next Action</p>
                                            <p className={`text-xs font-semibold ${crop.health === 'Good' ? 'text-blue-600' : 'text-rose-600'}`}>
                                                {crop.nextAction}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-50 p-3 flex border-t border-slate-100">
                            <button className="w-1/2 flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary text-sm font-semibold py-2 transition-colors border-r border-slate-200">
                                <CloudRain className="w-4 h-4" /> Weather
                            </button>
                            <button className="w-1/2 flex items-center justify-center gap-1.5 text-slate-600 hover:text-primary text-sm font-semibold py-2 transition-colors">
                                <Plus className="w-4 h-4" /> Add Crop
                            </button>
                        </div>
                    </div>
                ))}

                {/* Add Farm Button */}
                <Link to="/add-farm" className="block w-full border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-100 hover:border-primary/50 transition-all group">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors text-slate-400">
                        <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-700">Add New Farm</h3>
                    <p className="text-sm text-slate-500 mt-1">Register another piece of land</p>
                </Link>

            </main>
        </div>
    );
};

export default MyFarmsAndCropsList;
