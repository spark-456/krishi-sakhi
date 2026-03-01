import React, { useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, IndianRupee, Plus, Calendar, Filter, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FarmFinanceTracker = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    const recentTransactions = [
        { id: 1, type: 'expense', category: 'Fertilizer', description: 'Urea (2 Bags)', amount: 600, date: 'Oct 12' },
        { id: 2, type: 'expense', category: 'Labor', description: 'Weeding wages', amount: 1500, date: 'Oct 10' },
        { id: 3, type: 'income', category: 'Crop Sale', description: 'Wheat (Advance)', amount: 25000, date: 'Oct 05' },
        { id: 4, type: 'expense', category: 'Equipment', description: 'Tractor Rent', amount: 2000, date: 'Oct 02' },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* Header */}
            <header className="bg-primary px-6 py-5 text-primary-foreground shadow-md rounded-b-3xl">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Farm Finance</h1>
                </div>

                {/* Balance Card */}
                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                    <p className="text-white/80 text-sm font-medium mb-1">Total Net Income (YTD)</p>
                    <div className="flex items-center gap-2 mb-4">
                        <IndianRupee className="w-6 h-6 opacity-90" />
                        <h2 className="text-4xl font-extrabold tracking-tight">1,45,200</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                        <div>
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Income</p>
                            <p className="text-emerald-300 font-bold flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" /> ₹2,10,500
                            </p>
                        </div>
                        <div className="border-l border-white/20 pl-4">
                            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Expenses</p>
                            <p className="text-rose-300 font-bold flex items-center gap-1">
                                <TrendingDown className="w-4 h-4" /> ₹65,300
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-5 space-y-6 -mt-2">
                {/* Tabs */}
                <div className="flex bg-slate-200/50 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('transactions')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'transactions' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`flex-1 flex justify-center items-center gap-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'reports' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <PieChart className="w-4 h-4" /> Reports
                    </button>
                </div>

                {/* Expense Breakdown (Overview Tab) */}
                {activeTab === 'overview' && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="font-bold text-slate-800">Expense Breakdown</h3>
                            <button className="text-primary text-xs font-bold hover:underline">This Month</button>
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'Fertilizers & Seeds', amount: '12,400', percent: 45, color: 'bg-emerald-500' },
                                { label: 'Labor & Wages', amount: '8,500', percent: 30, color: 'bg-blue-500' },
                                { label: 'Equipment Rent', amount: '4,200', percent: 15, color: 'bg-amber-500' },
                                { label: 'Others', amount: '2,100', percent: 10, color: 'bg-slate-400' },
                            ].map((item, idx) => (
                                <div key={idx}>
                                    <div className="flex justify-between text-sm font-semibold mb-1.5">
                                        <span className="text-slate-600 border-l-4 pl-2" style={{ borderColor: item.color.replace('bg-', '') }}>{item.label}</span>
                                        <span className="text-slate-800">₹{item.amount}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.percent}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Recent Transactions List */}
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800">Recent Transactions</h3>
                        <button className="p-1.5 bg-white text-slate-600 rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                        {recentTransactions.map((tx) => (
                            <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {tx.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm">{tx.description}</h4>
                                        <p className="text-xs font-semibold text-slate-400 mt-0.5">{tx.category} • {tx.date}</p>
                                    </div>
                                </div>
                                <div className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                    {tx.type === 'income' ? '+' : '-'}₹{tx.amount}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </main>

            {/* Floating Action Buttons */}
            <div className="fixed max-w-md w-full bottom-6 px-6 z-30 flex gap-3 pointer-events-none">
                <div className="flex-1"></div>
                <button className="bg-white text-slate-700 p-4 rounded-full shadow-lg shadow-black/5 hover:bg-slate-50 transition-transform active:scale-95 pointer-events-auto border border-slate-200 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                </button>
                <button className="bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-transform active:scale-95 pointer-events-auto flex items-center justify-center group flex-shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-out"></div>
                    <Plus className="w-6 h-6 relative z-10" />
                </button>
            </div>
        </div>
    );
};

export default FarmFinanceTracker;
