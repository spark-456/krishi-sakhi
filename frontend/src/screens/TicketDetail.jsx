import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle, Clock, Loader2, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const statusBadge = {
    open:           'bg-green-100 text-green-700',
    assigned:       'bg-blue-100 text-blue-700',
    in_progress:    'bg-amber-100 text-amber-700',
    waiting_farmer: 'bg-purple-100 text-purple-700',
    resolved:       'bg-slate-100 text-slate-600',
    closed:         'bg-slate-100 text-slate-400',
};

const TicketDetail = () => {
    const { ticketId } = useParams();
    const { session } = useAuth();
    const navigate = useNavigate();
    
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyText, setReplyText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!session?.access_token || !ticketId) return;
        fetchData();
    }, [session, ticketId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchData = async () => {
        try {
            const r = await fetch(`${API}/api/v1/tickets/${ticketId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!r.ok) throw new Error('Failed to fetch ticket');
            const data = await r.json();
            setTicket(data.ticket);
            setMessages(data.messages || []);
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
            const r = await fetch(`${API}/api/v1/tickets/${ticketId}/messages`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}` 
                },
                body: JSON.stringify({ message: replyText })
            });
            if (r.ok) {
                setReplyText('');
                fetchData();
            }
        } catch (e) {
            console.error('Failed to send message:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12 min-h-screen bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-green-600 mt-20" /></div>;
    }

    if (!ticket) {
        return <div className="p-5 text-center mt-20">Ticket not found or no access.</div>;
    }

    const isClosed = ticket.status === 'resolved' || ticket.status === 'closed';

    return (
        <div className="flex flex-col h-[100dvh] bg-slate-50 font-sans">
            {/* Header */}
            <header className="bg-primary px-5 py-4 text-white shadow-md relative z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/tickets')} className="p-2 hover:bg-white/20 rounded-full transition-colors -ml-2 text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className="font-bold text-lg truncate pr-2">{ticket.subject}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-green-100 capitalize">{ticket.category?.replace(/_/g, ' ')}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[ticket.status]}`}>
                                {ticket.status?.replace(/_/g, ' ')}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50">
                {/* Initial Request */}
                <div className="flex flex-col items-end">
                    <div className="flex gap-2 max-w-[85%] flex-row-reverse">
                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex-shrink-0 flex items-center justify-center mt-1">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="relative px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm bg-primary text-white text-[15px] leading-relaxed whitespace-pre-wrap">
                            {ticket.description}
                            <div className="text-[10px] mt-1.5 opacity-70 font-medium text-right text-green-100">
                                {new Date(ticket.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Replies */}
                {messages.map((msg) => {
                    const isAdmin = msg.is_admin_reply;
                    return (
                        <div key={msg.id} className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}>
                            <div className={`flex gap-2 max-w-[85%] ${isAdmin ? 'flex-row' : 'flex-row-reverse'}`}>
                                {isAdmin ? (
                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-100 mt-1">
                                        <span className="text-sm">👩🏽‍🌾</span>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex-shrink-0 flex items-center justify-center mt-1">
                                        <User className="w-4 h-4" />
                                    </div>
                                )}
                                <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap ${
                                    !isAdmin
                                    ? 'bg-primary text-white rounded-tr-sm'
                                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                                }`}>
                                    {msg.message}
                                    <div className={`text-[10px] mt-1.5 opacity-70 font-medium ${!isAdmin ? 'text-right text-green-100' : 'text-slate-400'}`}>
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </main>

            {/* Input */}
            {!isClosed ? (
                <div className="flex-shrink-0 p-3 bg-white border-t border-slate-100 shadow-lg">
                    <div className="flex items-end gap-2 border-2 border-primary/30 rounded-2xl px-3 py-2 bg-slate-50 focus-within:border-primary/60 transition-colors">
                        <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder="Reply to support..."
                            className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm py-1 resize-none max-h-32 min-h-[24px]"
                            rows={1}
                        />
                        <button 
                            onClick={handleSendReply}
                            disabled={isSubmitting || !replyText.trim()}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0 mb-0.5"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex-shrink-0 p-4 bg-slate-100 border-t border-slate-200 text-center text-sm font-medium text-slate-500 shadow-inner">
                    This ticket has been closed. Please open a new ticket if you need further assistance.
                </div>
            )}
        </div>
    );
};

export default TicketDetail;