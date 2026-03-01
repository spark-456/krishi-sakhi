import React, { useState } from 'react';
import { ArrowLeft, Search, Filter, Sprout, Droplets, ThermometerSun, Scissors, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FarmActivityLogs = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('All');

    const logs = [
        {
            id: 1,
            type: 'fertilizer',
            title: 'Urea Applied',
            farm: 'Farm 1 - Main Acreage',
            crop: 'Wheat',
            date: 'Today, 08:30 AM',
            icon: Sprout,
            color: 'bg-emerald-100 text-emerald-600',
            description: 'Applied 50kg of Urea per acre as scheduled for vegetative stage.'
        },
        {
            id: 2,
            type: 'irrigation',
            title: 'Drip Irrigation Started',
            farm: 'Farm 2 - River Side',
            crop: 'Sugarcane',
            date: 'Yesterday, 06:15 PM',
            icon: Droplets,
            color: 'bg-blue-100 text-blue-600',
            description: 'System ran for 4 hours. Soil moisture levels restored to optimal.'
        },
        {
            id: 3,
            type: 'disease',
            title: 'Rust Detected',
            farm: 'Farm 1 - Main Acreage',
            crop: 'Wheat',
            date: 'Mon, 12 Oct',
            icon: ShieldAlert,
            color: 'bg-rose-100 text-rose-600',
            description: 'Early signs of rust detected via camera scan. Treatment recommended within 48h.'
        },
        {
            id: 4,
            type: 'harvest',
            title: 'Pruning Completed',
            farm: 'Farm 2 - River Side',
            crop: 'Sugarcane',
            date: 'Sun, 11 Oct',
            icon: Scissors,
            color: 'bg-amber-100 text-amber-600',
            description: 'Removed lower dried leaves manually to improve aeration.'
        }
    ];

    const filteredLogs = filter === 'All' ? logs : logs.filter(log => log.type === filter.toLowerCase());

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-white border-b border-slate-100 px-6 py-5 sticky top-0 z-20">
                <div className="flex justify-between items-center mb-5">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Activity Logs</h1>
                    </div>
                    <button className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-full transition-colors border border-slate-200">
                        <Filter className="w-5 h-5" />
                    </button>
                </div>

                {/* Search & Tabs */}
                <div className="relative mb-4">
                    <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search activities..."
                        className="w-full bg-slate-100/80 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
                    {['All', 'Fertilizer', 'Irrigation', 'Disease', 'Harvest'].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === cat ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            {/* Timeline Content */}
            <main className="flex-1 p-6 relative">
                {/* Continuous Timeline Line */}
                <div className="absolute left-[39px] top-6 bottom-6 w-px bg-slate-200"></div>

                <div className="space-y-6 relative z-10">
                    {filteredLogs.map((log) => {
                        const Icon = log.icon;
                        return (
                            <div key={log.id} className="relative pl-12 group">
                                {/* Timeline Dot */}
                                <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-slate-50 flex items-center justify-center shadow-sm ${log.color} bg-white`}>
                                    <Icon className="w-4 h-4" />
                                </div>

                                {/* Card */}
                                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 group-hover:border-primary/20 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-slate-800 text-[15px]">{log.title}</h3>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{log.date.split(',')[0]}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mb-3">{log.farm} • {log.crop}</p>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        {log.description}
                                    </p>
                                    <div className="mt-3 flex justify-between items-center text-[11px] font-bold text-slate-400">
                                        <span>{log.date.split(',')[1]}</span>
                                        <button className="text-primary hover:underline">Edit Entry</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredLogs.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-slate-500 font-medium">No activity logs found for "{filter}".</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default FarmActivityLogs;
