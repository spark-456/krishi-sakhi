/**
 * FarmFinanceTracker — Expense Tracking from Supabase
 * ───────────────────────────────────────────────────
 * Fetches from expense_logs table. Farm & farmer based.
 * Supports adding new expenses with category selection.
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, TrendingUp, IndianRupee, Plus, Loader2, X, Trash2, Sprout, BarChart3, PieChart, Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { getCropRecommendation } from '../lib/backendClient';
import { shouldRefresh, subscribeToDataRefresh } from '../lib/appEvents';

const CATEGORIES = [
    { value: 'seeds', label: '🌱 Seeds', color: 'bg-emerald-500', accent: '#10b981' },
    { value: 'fertilizer', label: '🧪 Fertilizer', color: 'bg-green-500', accent: '#22c55e' },
    { value: 'pesticide', label: '🛡️ Pesticide', color: 'bg-amber-500', accent: '#f59e0b' },
    { value: 'labour', label: '👷 Labour', color: 'bg-blue-500', accent: '#3b82f6' },
    { value: 'irrigation', label: '💧 Irrigation', color: 'bg-cyan-500', accent: '#06b6d4' },
    { value: 'equipment', label: '🔧 Equipment', color: 'bg-orange-500', accent: '#f97316' },
    { value: 'other', label: '📦 Other', color: 'bg-slate-400', accent: '#94a3b8' },
];

const formatInr = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const startOfDay = (input) => {
    const value = new Date(input);
    value.setHours(0, 0, 0, 0);
    return value;
};

const buildDailySpend = (expenses) => {
    const today = startOfDay(new Date());
    const buckets = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - offset);
        const key = day.toISOString().split('T')[0];
        buckets.push({
            key,
            label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
            total: 0,
        });
    }

    expenses.forEach((expense) => {
        const expenseKey = expense.expense_date;
        const bucket = buckets.find((item) => item.key === expenseKey);
        if (bucket) bucket.total += parseFloat(expense.amount_inr || 0);
    });

    return buckets;
};

const buildFarmSummary = (expenses, farms) => {
    const farmMap = Object.fromEntries((farms || []).map((farm) => [farm.id, farm.farm_name || 'Unnamed Farm']));
    const totals = {};
    expenses.forEach((expense) => {
        const key = expense.farm_id || 'unassigned';
        if (!totals[key]) {
            totals[key] = {
                farmId: expense.farm_id || null,
                label: expense.farm_id ? (farmMap[expense.farm_id] || 'Unnamed Farm') : 'General / Unassigned',
                total: 0,
            };
        }
        totals[key].total += parseFloat(expense.amount_inr || 0);
    });
    return Object.values(totals).sort((a, b) => b.total - a.total);
};

const buildFinanceSuggestions = ({ expenses, totalExpenses, categorySummary, dailySpend, farmSummary, cropRec }) => {
    const suggestions = [];
    if (expenses.length === 0) {
        return [{
            title: 'Start building your spending baseline',
            body: 'Add each major purchase and labour payment. Once at least a week of expenses is logged, Sakhi can highlight cost spikes and heavy categories.',
            tone: 'bg-slate-50 border-slate-200 text-slate-700',
        }];
    }

    const latestWeek = dailySpend.slice(-7).reduce((sum, item) => sum + item.total, 0);
    const previousWeek = expenses.reduce((sum, expense) => {
        const value = parseFloat(expense.amount_inr || 0);
        const dateValue = startOfDay(expense.expense_date);
        const today = startOfDay(new Date());
        const diffDays = Math.floor((today - dateValue) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7 && diffDays <= 13) return sum + value;
        return sum;
    }, 0);

    const topCategory = categorySummary[0];
    if (topCategory && topCategory.percent >= 35) {
        suggestions.push({
            title: `${topCategory.label} is driving most of your spend`,
            body: `${topCategory.percent}% of recorded expenses are in ${topCategory.label.replace(/^[^\s]+\s/, '').toLowerCase()}. Compare supplier rate, quantity, and timing before the next purchase cycle.`,
            tone: 'bg-amber-50 border-amber-200 text-amber-800',
        });
    }

    if (latestWeek > previousWeek * 1.2 && previousWeek > 0) {
        suggestions.push({
            title: 'Recent spending is higher than the previous week',
            body: `The last 7 days total ${formatInr(latestWeek)}, versus ${formatInr(previousWeek)} in the prior 7 days. Review whether the spike is seasonal input buying or an avoidable cost jump.`,
            tone: 'bg-rose-50 border-rose-200 text-rose-800',
        });
    }

    const unassigned = farmSummary.find((item) => item.farmId === null);
    if (unassigned && unassigned.total >= totalExpenses * 0.25) {
        suggestions.push({
            title: 'A large share of costs is not tied to a farm',
            body: `${formatInr(unassigned.total)} is logged as general expense. Assigning those costs to the right farm will make crop-level profitability analysis much more useful.`,
            tone: 'bg-blue-50 border-blue-200 text-blue-800',
        });
    }

    if (cropRec) {
        suggestions.push({
            title: `Budget around ${cropRec} for the next cycle`,
            body: `Your crop recommendation currently points to ${cropRec}. Use the trend chart to estimate how much of your next seasonal budget should be reserved for seeds, irrigation, and protection inputs.`,
            tone: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        });
    }

    return suggestions.slice(0, 3);
};

const FarmFinanceTracker = () => {
    const navigate = useNavigate();
    const { user, session } = useAuth();
    const [expenses, setExpenses] = useState([]);
    const [farms, setFarms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    const [formData, setFormData] = useState({
        farm_id: '',
        category: 'seeds',
        amount_inr: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    useEffect(() => {
        if (user?.id) fetchAll();
    }, [user?.id]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['finance', 'dashboard']) && user?.id) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [user?.id]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [expRes, farmRes] = await Promise.all([
                supabase.from('expense_logs').select('*')
                    .eq('farmer_id', user.id)
                    .order('expense_date', { ascending: false }),
                supabase.from('farms').select('id, farm_name')
                    .eq('farmer_id', user.id),
            ]);
            setExpenses(expRes.data || []);
            setFarms(farmRes.data || []);
        } catch (err) {
            console.error('[Finance] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };
    
    // ML Recommendation Placard
    const [cropRec, setCropRec] = useState(null);
    useEffect(() => {
        if (farms.length > 0 && session?.access_token) {
            const primaryFarmId = farms[0].id;
            getCropRecommendation({ farmId: primaryFarmId, token: session.access_token })
                .then(res => setCropRec(res?.top_recommendation))
                .catch(err => console.error(err));
        }
    }, [farms, session]);

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!formData.amount_inr || parseFloat(formData.amount_inr) <= 0) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('expense_logs').insert({
                farmer_id: user.id,
                farm_id: formData.farm_id || null,
                crop_record_id: null,
                category: formData.category,
                amount_inr: parseFloat(formData.amount_inr),
                expense_date: formData.expense_date,
                notes: formData.notes || null,
            });
            if (error) throw error;
            setShowAddForm(false);
            setFormData({ farm_id: '', category: 'seeds', amount_inr: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
            showToast('Expense added ✓');
            fetchAll();
        } catch (err) {
            console.error('[Finance] Insert error:', err);
            showToast('Failed to add expense');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await supabase.from('expense_logs').delete().eq('id', id);
            setExpenses(prev => prev.filter(e => e.id !== id));
            showToast('Expense removed');
        } catch (err) {
            console.error('[Finance] Delete error:', err);
        }
    };

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    // Compute summaries
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount_inr || 0), 0);
    const categorySummary = CATEGORIES.map(cat => {
        const total = expenses
            .filter(e => e.category === cat.value)
            .reduce((sum, e) => sum + parseFloat(e.amount_inr || 0), 0);
        return { ...cat, total, percent: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0 };
    }).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    const dailySpend = buildDailySpend(expenses);
    const maxDailySpend = Math.max(...dailySpend.map((item) => item.total), 1);
    const averageExpense = expenses.length ? totalExpenses / expenses.length : 0;
    const latestWeekSpend = dailySpend.reduce((sum, item) => sum + item.total, 0);
    const farmSummary = buildFarmSummary(expenses, farms);
    const financeSuggestions = buildFinanceSuggestions({
        expenses,
        totalExpenses,
        categorySummary,
        dailySpend,
        farmSummary,
        cropRec,
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading expenses...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg">
                    {toast}
                </div>
            )}

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
                    <p className="text-white/80 text-sm font-medium mb-1">Total Expenses</p>
                    <div className="flex items-center gap-2 mb-2">
                        <IndianRupee className="w-6 h-6 opacity-90" />
                        <h2 className="text-4xl font-extrabold tracking-tight">
                            {totalExpenses.toLocaleString('en-IN')}
                        </h2>
                    </div>
                    <p className="text-white/60 text-xs font-medium">
                        {expenses.length} transaction{expenses.length !== 1 ? 's' : ''} recorded
                    </p>
                </div>
                
                {/* AI Crop Placard */}
                {cropRec && (
                    <div className="mt-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3 flex items-center gap-3 backdrop-blur-sm">
                        <div className="bg-emerald-500/30 p-2 rounded-lg">
                            <Sprout className="w-5 h-5 text-emerald-100" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">Season Suggestion</p>
                            <p className="text-sm font-bold text-white leading-tight">Consider planting <span className="text-emerald-300">{cropRec}</span> next to maximize layout and returns.</p>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1 p-5 space-y-6 -mt-2">
                {expenses.length > 0 && (
                    <section className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">7 Days</p>
                            <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(latestWeekSpend)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">recent spend</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average</p>
                            <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(averageExpense)}</p>
                            <p className="text-[11px] text-slate-500 mt-1">per entry</p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Top Cost</p>
                            <p className="text-sm font-extrabold text-slate-800 mt-2 line-clamp-2">{categorySummary[0]?.label || 'N/A'}</p>
                            <p className="text-[11px] text-slate-500 mt-1">{categorySummary[0]?.percent || 0}% share</p>
                        </div>
                    </section>
                )}

                {expenses.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-primary" />
                                <h3 className="font-bold text-slate-800">Spending Trend</h3>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Last 7 Days</span>
                        </div>
                        <div className="grid grid-cols-7 gap-2 items-end h-40">
                            {dailySpend.map((item) => (
                                <div key={item.key} className="flex flex-col items-center justify-end h-full">
                                    <div className="text-[10px] font-semibold text-slate-400 mb-2 min-h-[20px] text-center">
                                        {item.total > 0 ? formatInr(item.total) : ''}
                                    </div>
                                    <div className="w-full flex items-end justify-center h-24">
                                        <div
                                            className="w-full max-w-[28px] rounded-t-2xl bg-gradient-to-t from-primary to-emerald-400"
                                            style={{ height: `${Math.max((item.total / maxDailySpend) * 100, item.total > 0 ? 14 : 4)}%` }}
                                        />
                                    </div>
                                    <div className="text-[11px] font-bold text-slate-500 mt-3">{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Category Breakdown */}
                {categorySummary.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart className="w-4 h-4 text-primary" />
                            <h3 className="font-bold text-slate-800">Expense Breakdown</h3>
                        </div>
                        <div className="space-y-3">
                            {categorySummary.map((item) => (
                                <div key={item.value}>
                                    <div className="flex justify-between text-sm font-semibold mb-1">
                                        <span className="text-slate-600">{item.label}</span>
                                        <span className="text-slate-800">₹{item.total.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${item.percent}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {farmSummary.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4">Farm-Wise Cost Split</h3>
                        <div className="space-y-3">
                            {farmSummary.map((farm, index) => {
                                const share = totalExpenses > 0 ? Math.round((farm.total / totalExpenses) * 100) : 0;
                                const accent = CATEGORIES[index % CATEGORIES.length]?.accent || '#16a34a';
                                return (
                                    <div key={farm.label}>
                                        <div className="flex justify-between items-center gap-3 text-sm mb-1.5">
                                            <p className="font-semibold text-slate-700 truncate">{farm.label}</p>
                                            <p className="font-bold text-slate-800">{formatInr(farm.total)}</p>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: accent }} />
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">{share}% of total expense</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {financeSuggestions.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold text-slate-800">Smart Suggestions</h3>
                        </div>
                        <div className="space-y-3">
                            {financeSuggestions.map((suggestion, index) => (
                                <div key={`${suggestion.title}-${index}`} className={`rounded-2xl border p-4 ${suggestion.tone}`}>
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                                            {index === 0 ? <TrendingUp className="w-5 h-5" /> : index === 1 ? <BarChart3 className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm">{suggestion.title}</h4>
                                            <p className="text-sm leading-relaxed mt-1">{suggestion.body}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Transaction List */}
                <section>
                    <h3 className="font-bold text-slate-800 mb-3">Recent Expenses</h3>
                    {expenses.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <IndianRupee className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium text-sm">No expenses recorded yet</p>
                            <p className="text-slate-400 text-xs mt-1">Tap + to add your first expense</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                            {expenses.map((exp) => {
                                const cat = CATEGORIES.find(c => c.value === exp.category);
                                return (
                                    <div key={exp.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <TrendingDown className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{exp.notes || cat?.label || exp.category}</h4>
                                                <p className="text-xs font-semibold text-slate-400 mt-0.5 capitalize">
                                                    {exp.category} • {exp.expense_date ? new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-800">-₹{parseFloat(exp.amount_inr).toLocaleString('en-IN')}</span>
                                            <button onClick={() => handleDeleteExpense(exp.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>

            {/* Add Expense Modal */}
            {showAddForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-slate-800">Add Expense</h3>
                            <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleAddExpense} className="space-y-4">
                            {/* Amount */}
                            <div>
                                <label className="text-sm font-bold text-slate-700">Amount (₹) *</label>
                                <input type="number" required min="1" step="0.01"
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-lg font-bold"
                                    placeholder="0.00"
                                    value={formData.amount_inr}
                                    onChange={(e) => setFormData({ ...formData, amount_inr: e.target.value })}
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-sm font-bold text-slate-700">Category *</label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {CATEGORIES.map(cat => (
                                        <button key={cat.value} type="button"
                                            onClick={() => setFormData({ ...formData, category: cat.value })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${formData.category === cat.value
                                                ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                                                : 'border-slate-200 text-slate-600 hover:border-slate-300'
                                            }`}>
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Farm */}
                            {farms.length > 0 && (
                                <div>
                                    <label className="text-sm font-bold text-slate-700">Farm (optional)</label>
                                    <select
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        value={formData.farm_id}
                                        onChange={(e) => setFormData({ ...formData, farm_id: e.target.value })}>
                                        <option value="">General / All Farms</option>
                                        {farms.map(f => <option key={f.id} value={f.id}>{f.farm_name || 'Unnamed'}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Date */}
                            <div>
                                <label className="text-sm font-bold text-slate-700">Date</label>
                                <input type="date"
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                    value={formData.expense_date}
                                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-sm font-bold text-slate-700">Notes</label>
                                <input type="text"
                                    className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                    placeholder="e.g. 2 bags of urea"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <button type="submit" disabled={isSubmitting || !formData.amount_inr}
                                className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : 'Add Expense'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* FAB */}
            <div className="fixed max-w-md w-full bottom-6 px-6 z-30 flex justify-end pointer-events-none">
                <button onClick={() => setShowAddForm(true)}
                    className="bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-transform active:scale-95 pointer-events-auto flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default FarmFinanceTracker;
