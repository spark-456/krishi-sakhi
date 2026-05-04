import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft, BarChart3, IndianRupee, Lightbulb, Loader2, Plus, Sprout, Trash2, TrendingDown,
    TrendingUp, Trophy, Wallet, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { createYieldRecord, deleteYieldRecord, getCropRecommendation, getYieldRecords } from '../lib/backendClient';
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

const BUYER_TYPES = ['mandi', 'trader', 'direct', 'cooperative', 'other'];

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
        const bucket = buckets.find((item) => item.key === expense.expense_date);
        if (bucket) bucket.total += parseFloat(expense.amount_inr || 0);
    });

    return buckets;
};

const buildFarmSummary = (expenses, revenueByFarm, farms) => {
    const farmMap = Object.fromEntries((farms || []).map((farm) => [farm.id, farm.farm_name || 'Unnamed Farm']));
    const keys = new Set([
        ...expenses.map((expense) => expense.farm_id || 'unassigned'),
        ...Object.keys(revenueByFarm),
    ]);

    return Array.from(keys).map((key) => {
        const expenseTotal = expenses
            .filter((expense) => (expense.farm_id || 'unassigned') === key)
            .reduce((sum, expense) => sum + parseFloat(expense.amount_inr || 0), 0);
        const revenueTotal = revenueByFarm[key] || 0;
        return {
            farmId: key === 'unassigned' ? null : key,
            label: key === 'unassigned' ? 'General / Unassigned' : (farmMap[key] || 'Unnamed Farm'),
            expenseTotal,
            revenueTotal,
            profitLoss: revenueTotal - expenseTotal,
        };
    }).sort((a, b) => Math.abs(b.profitLoss) - Math.abs(a.profitLoss));
};

const buildProfitByCrop = (yieldRecords, cropMap, farmMap, expenses) => {
    const expenseByCrop = {};
    expenses.forEach((expense) => {
        if (!expense.crop_record_id) return;
        expenseByCrop[expense.crop_record_id] = (expenseByCrop[expense.crop_record_id] || 0) + parseFloat(expense.amount_inr || 0);
    });

    return yieldRecords.map((yieldRecord) => {
        const crop = cropMap[yieldRecord.crop_record_id] || {};
        const revenue = parseFloat(yieldRecord.yield_kg || 0) * parseFloat(yieldRecord.sale_price_per_kg || 0);
        const expenseTotal = expenseByCrop[yieldRecord.crop_record_id] || 0;
        return {
            id: yieldRecord.id,
            cropRecordId: yieldRecord.crop_record_id,
            cropName: crop.crop_name || 'Harvested Crop',
            farmName: (farmMap[crop.farm_id] || {}).farm_name || 'Unknown Farm',
            revenue,
            expenseTotal,
            profitLoss: revenue - expenseTotal,
            saleDate: yieldRecord.sale_date,
            yieldKg: yieldRecord.yield_kg,
            salePricePerKg: yieldRecord.sale_price_per_kg,
            buyerType: yieldRecord.buyer_type,
        };
    }).sort((a, b) => b.profitLoss - a.profitLoss);
};

const buildFinanceSuggestions = ({ totalExpenses, totalRevenue, profitLoss, categorySummary, farmSummary, unrealizedHarvests }) => {
    const suggestions = [];

    if (totalExpenses === 0 && totalRevenue === 0) {
        return [{
            title: 'Start building your season ledger',
            body: 'Add major expenses and harvest sales. Sakhi will then show real profit or loss, cost-heavy categories, and farm-wise performance.',
            tone: 'bg-slate-50 border-slate-200 text-slate-700',
        }];
    }

    const topCategory = categorySummary[0];
    if (topCategory && topCategory.percent >= 35) {
        suggestions.push({
            title: `${topCategory.label} is dominating your cost structure`,
            body: `${topCategory.percent}% of your recorded costs are in this category. Compare quantity, timing, and supplier rate before the next purchase.`,
            tone: 'bg-amber-50 border-amber-200 text-amber-800',
        });
    }

    if (profitLoss < 0) {
        suggestions.push({
            title: 'You are currently running at a recorded loss',
            body: `Recorded revenue is ${formatInr(Math.abs(profitLoss))} below recorded spend. Check whether harvest sales are still missing and review high-cost categories.`,
            tone: 'bg-rose-50 border-rose-200 text-rose-800',
        });
    }

    const strongestFarm = farmSummary.find((item) => item.profitLoss > 0);
    if (strongestFarm) {
        suggestions.push({
            title: `${strongestFarm.label} is your strongest recorded performer`,
            body: `This farm is currently showing the healthiest balance between sales and costs. Use it as a benchmark for crop planning and input discipline.`,
            tone: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        });
    }

    if (unrealizedHarvests > 0) {
        suggestions.push({
            title: 'Some harvested crops still need sale entries',
            body: `${unrealizedHarvests} harvested crop record(s) still do not have yield or selling data. Logging them will improve profit tracking immediately.`,
            tone: 'bg-blue-50 border-blue-200 text-blue-800',
        });
    }

    return suggestions.slice(0, 4);
};

const FarmFinanceTracker = () => {
    const navigate = useNavigate();
    const { user, session } = useAuth();

    const [expenses, setExpenses] = useState([]);
    const [farms, setFarms] = useState([]);
    const [crops, setCrops] = useState([]);
    const [yieldRecords, setYieldRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cropRec, setCropRec] = useState(null);

    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [showRevenueForm, setShowRevenueForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    const [expenseForm, setExpenseForm] = useState({
        farm_id: '',
        category: 'seeds',
        amount_inr: '',
        expense_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const [yieldForm, setYieldForm] = useState({
        crop_record_id: '',
        yield_kg: '',
        sale_price_per_kg: '',
        sale_date: new Date().toISOString().split('T')[0],
        buyer_type: 'mandi',
        notes: '',
    });

    useEffect(() => {
        if (user?.id && session?.access_token) fetchAll();
    }, [user?.id, session?.access_token]);

    useEffect(() => {
        const unsubscribe = subscribeToDataRefresh((targets) => {
            if (shouldRefresh(targets, ['finance', 'dashboard', 'farms', 'activity']) && user?.id && session?.access_token) {
                fetchAll();
            }
        });
        return unsubscribe;
    }, [user?.id, session?.access_token]);

    const fetchAll = async () => {
        setIsLoading(true);
        try {
            const [expRes, farmRes, cropRes, yieldRes] = await Promise.all([
                supabase.from('expense_logs').select('*').eq('farmer_id', user.id).order('expense_date', { ascending: false }),
                supabase.from('farms').select('id, farm_name').eq('farmer_id', user.id),
                supabase.from('crop_records').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false }),
                getYieldRecords({ token: session.access_token }),
            ]);
            setExpenses(expRes.data || []);
            setFarms(farmRes.data || []);
            setCrops(cropRes.data || []);
            setYieldRecords(yieldRes || []);

            if ((farmRes.data || []).length > 0) {
                const rec = await getCropRecommendation({ farmId: farmRes.data[0].id, token: session.access_token }).catch(() => null);
                setCropRec(rec?.top_recommendation || null);
            }
        } catch (err) {
            console.error('[Finance] Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!expenseForm.amount_inr || parseFloat(expenseForm.amount_inr) <= 0) return;
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('expense_logs').insert({
                farmer_id: user.id,
                farm_id: expenseForm.farm_id || null,
                crop_record_id: null,
                category: expenseForm.category,
                amount_inr: parseFloat(expenseForm.amount_inr),
                expense_date: expenseForm.expense_date,
                notes: expenseForm.notes || null,
            });
            if (error) throw error;
            setShowExpenseForm(false);
            setExpenseForm({
                farm_id: '',
                category: 'seeds',
                amount_inr: '',
                expense_date: new Date().toISOString().split('T')[0],
                notes: '',
            });
            showToast('Expense added');
            fetchAll();
        } catch (err) {
            console.error('[Finance] Insert error:', err);
            showToast('Failed to add expense');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddRevenue = async (e) => {
        e.preventDefault();
        if (!yieldForm.crop_record_id || !yieldForm.yield_kg || !yieldForm.sale_price_per_kg) return;
        setIsSubmitting(true);
        try {
            await createYieldRecord({
                token: session.access_token,
                payload: {
                    crop_record_id: yieldForm.crop_record_id,
                    yield_kg: parseFloat(yieldForm.yield_kg),
                    sale_price_per_kg: parseFloat(yieldForm.sale_price_per_kg),
                    sale_date: yieldForm.sale_date,
                    buyer_type: yieldForm.buyer_type,
                    notes: yieldForm.notes || null,
                }
            });
            setShowRevenueForm(false);
            setYieldForm({
                crop_record_id: '',
                yield_kg: '',
                sale_price_per_kg: '',
                sale_date: new Date().toISOString().split('T')[0],
                buyer_type: 'mandi',
                notes: '',
            });
            showToast('Revenue entry added');
            fetchAll();
        } catch (err) {
            console.error('[Finance] Revenue insert error:', err);
            showToast('Failed to add sale');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!window.confirm('Delete this expense?')) return;
        try {
            await supabase.from('expense_logs').delete().eq('id', id);
            setExpenses((prev) => prev.filter((item) => item.id !== id));
            showToast('Expense removed');
        } catch (err) {
            console.error('[Finance] Delete error:', err);
        }
    };

    const handleDeleteYield = async (yieldId) => {
        if (!window.confirm('Delete this revenue entry?')) return;
        try {
            await deleteYieldRecord({ yieldId, token: session.access_token });
            setYieldRecords((prev) => prev.filter((item) => item.id !== yieldId));
            showToast('Revenue entry removed');
        } catch (err) {
            console.error('[Finance] Yield delete error:', err);
        }
    };

    const totalExpenses = useMemo(
        () => expenses.reduce((sum, expense) => sum + parseFloat(expense.amount_inr || 0), 0),
        [expenses]
    );
    const totalRevenue = useMemo(
        () => yieldRecords.reduce((sum, item) => sum + (parseFloat(item.yield_kg || 0) * parseFloat(item.sale_price_per_kg || 0)), 0),
        [yieldRecords]
    );
    const profitLoss = totalRevenue - totalExpenses;
    const averageExpense = expenses.length ? totalExpenses / expenses.length : 0;

    const categorySummary = useMemo(() => {
        return CATEGORIES.map((cat) => {
            const total = expenses
                .filter((expense) => expense.category === cat.value)
                .reduce((sum, expense) => sum + parseFloat(expense.amount_inr || 0), 0);
            return { ...cat, total, percent: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0 };
        }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
    }, [expenses, totalExpenses]);

    const dailySpend = useMemo(() => buildDailySpend(expenses), [expenses]);
    const maxDailySpend = Math.max(...dailySpend.map((item) => item.total), 1);
    const latestWeekSpend = dailySpend.reduce((sum, item) => sum + item.total, 0);

    const cropMap = useMemo(() => Object.fromEntries(crops.map((crop) => [crop.id, crop])), [crops]);
    const farmMap = useMemo(() => Object.fromEntries(farms.map((farm) => [farm.id, farm])), [farms]);

    const revenueByFarm = useMemo(() => {
        const summary = {};
        yieldRecords.forEach((yieldRecord) => {
            const crop = cropMap[yieldRecord.crop_record_id];
            const key = crop?.farm_id || 'unassigned';
            summary[key] = (summary[key] || 0) + (parseFloat(yieldRecord.yield_kg || 0) * parseFloat(yieldRecord.sale_price_per_kg || 0));
        });
        return summary;
    }, [yieldRecords, cropMap]);

    const farmSummary = useMemo(() => buildFarmSummary(expenses, revenueByFarm, farms), [expenses, revenueByFarm, farms]);
    const profitByCrop = useMemo(() => buildProfitByCrop(yieldRecords, cropMap, farmMap, expenses), [yieldRecords, cropMap, farmMap, expenses]);

    const harvestedWithoutYield = crops.filter((crop) => crop.status === 'harvested' && !yieldRecords.some((item) => item.crop_record_id === crop.id));

    const financeSuggestions = useMemo(() => buildFinanceSuggestions({
        totalExpenses,
        totalRevenue,
        profitLoss,
        categorySummary,
        farmSummary,
        unrealizedHarvests: harvestedWithoutYield.length,
    }), [totalExpenses, totalRevenue, profitLoss, categorySummary, farmSummary, harvestedWithoutYield.length]);

    const availableHarvestCrops = crops.filter((crop) => !yieldRecords.some((item) => item.crop_record_id === crop.id));

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-slate-500 font-medium">Loading finance view...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans pb-24">
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg">
                    {toast}
                </div>
            )}

            <header className="bg-primary px-6 py-5 text-primary-foreground shadow-md rounded-b-3xl">
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold tracking-tight">Farm Finance</h1>
                </div>

                <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                    <p className="text-white/80 text-sm font-medium mb-1">Season Profit / Loss</p>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Wallet className="w-6 h-6 opacity-90" />
                                <h2 className="text-4xl font-extrabold tracking-tight">
                                    {Math.round(profitLoss).toLocaleString('en-IN')}
                                </h2>
                            </div>
                            <p className="text-white/60 text-xs font-medium">
                                Revenue {formatInr(totalRevenue)} • Spend {formatInr(totalExpenses)}
                            </p>
                        </div>
                        <div className={`rounded-2xl px-3 py-2 text-xs font-bold ${profitLoss >= 0 ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>
                            {profitLoss >= 0 ? 'Net Positive' : 'Net Negative'}
                        </div>
                    </div>
                </div>

                {cropRec && (
                    <div className="mt-4 bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-3 flex items-center gap-3 backdrop-blur-sm">
                        <div className="bg-emerald-500/30 p-2 rounded-lg">
                            <Sprout className="w-5 h-5 text-emerald-100" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">Planning Signal</p>
                            <p className="text-sm font-bold text-white leading-tight">Use the profit cards below to compare current performance before switching into <span className="text-emerald-300">{cropRec}</span> next season.</p>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-1 p-5 space-y-6 -mt-2">
                <section className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">7 Days</p>
                        <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(latestWeekSpend)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">recent spend</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Average</p>
                        <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(averageExpense)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">per expense</p>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sales</p>
                        <p className="text-lg font-extrabold text-slate-800 mt-2">{yieldRecords.length}</p>
                        <p className="text-[11px] text-slate-500 mt-1">yield entries</p>
                    </div>
                </section>

                {dailySpend.length > 0 && (
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

                <section className="grid grid-cols-1 gap-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <IndianRupee className="w-4 h-4 text-emerald-600" />
                            <h3 className="font-bold text-slate-800">Revenue vs Cost</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-2xl bg-rose-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">Costs</p>
                                <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(totalExpenses)}</p>
                            </div>
                            <div className="rounded-2xl bg-emerald-50 p-4">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Revenue</p>
                                <p className="text-lg font-extrabold text-slate-800 mt-2">{formatInr(totalRevenue)}</p>
                            </div>
                            <div className={`rounded-2xl p-4 ${profitLoss >= 0 ? 'bg-teal-50' : 'bg-amber-50'}`}>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Net</p>
                                <p className={`text-lg font-extrabold mt-2 ${profitLoss >= 0 ? 'text-teal-700' : 'text-amber-700'}`}>{formatInr(profitLoss)}</p>
                            </div>
                        </div>
                    </div>

                    {categorySummary.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingDown className="w-4 h-4 text-primary" />
                                <h3 className="font-bold text-slate-800">Expense Breakdown</h3>
                            </div>
                            <div className="space-y-3">
                                {categorySummary.map((item) => (
                                    <div key={item.value}>
                                        <div className="flex justify-between text-sm font-semibold mb-1">
                                            <span className="text-slate-600">{item.label}</span>
                                            <span className="text-slate-800">{formatInr(item.total)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-2">
                                            <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${item.percent}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {profitByCrop.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <h3 className="font-bold text-slate-800">Crop Profitability</h3>
                        </div>
                        <div className="space-y-3">
                            {profitByCrop.map((item) => (
                                <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{item.cropName}</p>
                                            <p className="text-xs text-slate-500 mt-1">{item.farmName} • {item.saleDate ? new Date(item.saleDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Sale date missing'}</p>
                                        </div>
                                        <button onClick={() => handleDeleteYield(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 mt-4">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Revenue</p>
                                            <p className="text-sm font-extrabold text-emerald-700 mt-1">{formatInr(item.revenue)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cost</p>
                                            <p className="text-sm font-extrabold text-slate-800 mt-1">{formatInr(item.expenseTotal)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">P/L</p>
                                            <p className={`text-sm font-extrabold mt-1 ${item.profitLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatInr(item.profitLoss)}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">
                                        {item.yieldKg} kg sold at {formatInr(item.salePricePerKg)} per kg
                                        {item.buyerType ? ` • ${item.buyerType}` : ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {farmSummary.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4">Farm-Wise Outcome</h3>
                        <div className="space-y-3">
                            {farmSummary.map((farm, index) => {
                                const scaleBase = Math.max(...farmSummary.map((item) => Math.abs(item.profitLoss)), 1);
                                const width = Math.max((Math.abs(farm.profitLoss) / scaleBase) * 100, 10);
                                const accent = CATEGORIES[index % CATEGORIES.length]?.accent || '#16a34a';
                                return (
                                    <div key={farm.label}>
                                        <div className="flex justify-between items-center gap-3 text-sm mb-1.5">
                                            <p className="font-semibold text-slate-700 truncate">{farm.label}</p>
                                            <p className={`font-bold ${farm.profitLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatInr(farm.profitLoss)}</p>
                                        </div>
                                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: accent }} />
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Revenue {formatInr(farm.revenueTotal)} • Cost {formatInr(farm.expenseTotal)}
                                        </p>
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

                <section className="space-y-4">
                    <div>
                        <h3 className="font-bold text-slate-800 mb-3">Recent Expenses</h3>
                        {expenses.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                                <IndianRupee className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-sm">No expenses recorded yet</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                                {expenses.map((expense) => {
                                    const cat = CATEGORIES.find((item) => item.value === expense.category);
                                    return (
                                        <div key={expense.id} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <TrendingDown className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{expense.notes || cat?.label || expense.category}</h4>
                                                    <p className="text-xs font-semibold text-slate-400 mt-0.5 capitalize">
                                                        {expense.category} • {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-slate-800">-{formatInr(expense.amount_inr)}</span>
                                                <button onClick={() => handleDeleteExpense(expense.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="font-bold text-slate-800 mb-3">Harvest Sales</h3>
                        {yieldRecords.length === 0 ? (
                            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                                <TrendingUp className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium text-sm">No sales logged yet</p>
                                <p className="text-slate-400 text-xs mt-1">Add harvest revenue to unlock true profit/loss.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-100">
                                {yieldRecords.map((item) => {
                                    const crop = cropMap[item.crop_record_id];
                                    const revenue = parseFloat(item.yield_kg || 0) * parseFloat(item.sale_price_per_kg || 0);
                                    return (
                                        <div key={item.id} className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <TrendingUp className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 text-sm">{crop?.crop_name || 'Harvest sale'}</h4>
                                                    <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                                        {item.yield_kg} kg • {item.sale_price_per_kg} / kg • {item.sale_date ? new Date(item.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-emerald-700">+{formatInr(revenue)}</span>
                                                <button onClick={() => handleDeleteYield(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </section>
            </main>

            {(showExpenseForm || showRevenueForm) && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 pb-10">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-slate-800">{showRevenueForm ? 'Add Harvest Sale' : 'Add Expense'}</h3>
                            <button onClick={() => { setShowExpenseForm(false); setShowRevenueForm(false); }} className="p-1 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {showExpenseForm ? (
                            <form onSubmit={handleAddExpense} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700">Amount (₹) *</label>
                                    <input type="number" required min="1" step="0.01"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        placeholder="0.00"
                                        value={expenseForm.amount_inr}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, amount_inr: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">Category *</label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {CATEGORIES.map((cat) => (
                                            <button key={cat.value} type="button"
                                                onClick={() => setExpenseForm({ ...expenseForm, category: cat.value })}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${expenseForm.category === cat.value ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>
                                                {cat.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">Farm (optional)</label>
                                    <select className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        value={expenseForm.farm_id}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, farm_id: e.target.value })}>
                                        <option value="">General / All Farms</option>
                                        {farms.map((farm) => <option key={farm.id} value={farm.id}>{farm.farm_name || 'Unnamed'}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">Date</label>
                                    <input type="date"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        value={expenseForm.expense_date}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">Notes</label>
                                    <input type="text"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        placeholder="e.g. 2 bags of urea"
                                        value={expenseForm.notes}
                                        onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                                    />
                                </div>

                                <button type="submit" disabled={isSubmitting || !expenseForm.amount_inr}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : 'Add Expense'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleAddRevenue} className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700">Crop *</label>
                                    <select className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        value={yieldForm.crop_record_id}
                                        onChange={(e) => setYieldForm({ ...yieldForm, crop_record_id: e.target.value })}>
                                        <option value="">Select a crop</option>
                                        {availableHarvestCrops.map((crop) => (
                                            <option key={crop.id} value={crop.id}>
                                                {crop.crop_name} • {(farmMap[crop.farm_id] || {}).farm_name || 'Unknown Farm'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">Yield (kg) *</label>
                                        <input type="number" required min="0" step="0.01"
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                            value={yieldForm.yield_kg}
                                            onChange={(e) => setYieldForm({ ...yieldForm, yield_kg: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">Price / kg (₹) *</label>
                                        <input type="number" required min="0" step="0.01"
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                            value={yieldForm.sale_price_per_kg}
                                            onChange={(e) => setYieldForm({ ...yieldForm, sale_price_per_kg: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">Sale Date</label>
                                        <input type="date"
                                            className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                            value={yieldForm.sale_date}
                                            onChange={(e) => setYieldForm({ ...yieldForm, sale_date: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700">Buyer Type</label>
                                        <select className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                            value={yieldForm.buyer_type}
                                            onChange={(e) => setYieldForm({ ...yieldForm, buyer_type: e.target.value })}>
                                            {BUYER_TYPES.map((buyerType) => <option key={buyerType} value={buyerType}>{buyerType}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700">Notes</label>
                                    <input type="text"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary"
                                        placeholder="Buyer name or local mandi note"
                                        value={yieldForm.notes}
                                        onChange={(e) => setYieldForm({ ...yieldForm, notes: e.target.value })}
                                    />
                                </div>

                                <button type="submit" disabled={isSubmitting || !yieldForm.crop_record_id}
                                    className="w-full bg-primary text-white py-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                                    {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</> : 'Add Harvest Sale'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <div className="fixed max-w-md w-full bottom-6 px-6 z-30 flex justify-end gap-3 pointer-events-none">
                <button onClick={() => { setShowRevenueForm(true); setShowExpenseForm(false); }}
                    className="bg-emerald-600 text-white px-4 h-14 rounded-full shadow-lg hover:bg-emerald-700 transition-transform active:scale-95 pointer-events-auto inline-flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-sm font-bold">Sale</span>
                </button>
                <button onClick={() => { setShowExpenseForm(true); setShowRevenueForm(false); }}
                    className="bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary/90 transition-transform active:scale-95 pointer-events-auto flex items-center justify-center">
                    <Plus className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default FarmFinanceTracker;
