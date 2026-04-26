import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, User, AlertCircle, Clock, CheckCircle, Ticket, Phone } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const AdminTicketDetail = () => {
    const { ticketId } = useParams();
    const { session } = useAuth();
    const navigate = useNavigate();
    
    const [ticket, setTicket] = useState(null);
    const [farmer, setFarmer] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!session?.access_token || !ticketId) return;
        fetchData();
    }, [session, ticketId]);

    const fetchData = async () => {
        try {
            const r = await fetch(`${API}/api/v1/admin/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!r.ok) throw new Error('Failed to fetch ticket details');
            const data = await r.json();
            setTicket(data.ticket);
            setFarmer(data.farmer);
            setMessages(data.messages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!replyText.trim()) return;
        setIsSubmitting(true);
        try {
            const r = await fetch(`${API}/api/v1/admin/tickets/${ticketId}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({ message: replyText })
            });
            if (r.ok) {
                setReplyText('');
                fetchData(); // reload
            }
        } catch (e) {
            console.error('Failed to send reply:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateStatus = async (newStatus) => {
        try {
            const r = await fetch(`${API}/api/v1/admin/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (r.ok) {
                fetchData();
            }
        } catch (e) {
            console.error('Failed to update status:', e);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen bg-slate-50"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
    }

    if (!ticket) {
        return <div className="p-5 text-center mt-20">Ticket not found.</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-slate-50 font-sans">
            <header className="bg-white px-5 py-4 shadow-sm border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/tickets')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="font-bold text-slate-800 line-clamp-1">{ticket.subject}</h1>
                        <p className="text-xs text-slate-500 capitalize">{ticket.category.replace(/_/g, ' ')} • {ticket.status}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {/* Farmer Info Card */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{farmer?.full_name}</p>
                            <p className="text-xs text-slate-500">{farmer?.district}</p>
                            <a href={`tel:${farmer?.phone_number}`} className="flex items-center gap-1 text-xs text-green-600 mt-1 font-medium">
                                <Phone className="w-3 h-3" /> {farmer?.phone_number}
                            </a>
                        </div>
                    </div>
                    {ticket.status !== 'resolved' && (
                        <button onClick={() => updateStatus('resolved')} className="flex items-center gap-1 text-xs font-bold text-white bg-green-600 px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                            <CheckCircle className="w-3 h-3" /> Resolve
                        </button>
                    )}
                </div>

                {/* Initial Description */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Initial Description</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
                </div>

                {/* Messages */}
                <div className="space-y-3 mt-6">
                    {messages.map((msg) => {
                        const isAdmin = msg.is_admin_reply;
                        return (
                            <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${isAdmin ? 'bg-green-600 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                    <p className={`text-[10px] mt-1 text-right ${isAdmin ? 'text-green-200' : 'text-slate-400'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Reply Input */}
            {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-3 flex gap-2 items-end z-20 shadow-lg">
                    <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type a reply to the farmer..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 resize-none max-h-32 min-h-[48px]"
                        rows={1}
                    />
                    <button 
                        onClick={handleSendReply}
                        disabled={isSubmitting || !replyText.trim()}
                        className="bg-green-600 text-white p-3.5 rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminTicketDetail;
