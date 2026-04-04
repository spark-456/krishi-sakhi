/**
 * FarmFinanceTracker — Expense Tracking from Supabase
 * ───────────────────────────────────────────────────
 * Fetches from expense_logs table. Farm & farmer based.
 * Supports adding new expenses with category selection.
 */
import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingDown, IndianRupee, Plus, Loader2, X, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../hooks/useAuth';

const CATEGORIES = [
    { value: 'seeds', label: '🌱 Seeds', color: 'bg-emerald-500' },
    { value: 'fertilizer', label: '🧪 Fertilizer', color: 'bg-green-500' },
    { value: 'pesticide', label: '🛡️ Pesticide', color: 'bg-amber-500' },
    { value: 'labour', label: '👷 Labour', color: 'bg-blue-500' },
    { value: 'irrigation', label: '💧 Irrigation', color: 'bg-cyan-500' },
    { value: 'equipment', label: '🔧 Equipment', color: 'bg-orange-500' },
    { value: 'other', label: '📦 Other', color: 'bg-slate-400' },
];

const FarmFinanceTracker = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
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
    }).filter(c => c.total > 0);

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
            </header>

            <main className="flex-1 p-5 space-y-6 -mt-2">
                {/* Category Breakdown */}
                {categorySummary.length > 0 && (
                    <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4">Expense Breakdown</h3>
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
