/**
 * AIAssistantChatScreen — Ask Sakhi (Enhanced Context)
 * ────────────────────────────────────────────────────
 * Sends farmer profile, crops, and recent activities to Dify.
 * Fixed: Input positioned correctly above BottomNav via ProtectedLayout.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image as ImageIcon, Sparkles, User, RotateCcw, Loader2 } from 'lucide-react';
import { sendMessage as difySendMessage } from '../lib/difyClient';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';

const CONVERSATION_KEY = (id) => `ks_chat_conv_${id}`;

const AIAssistantChatScreen = () => {
    const { user } = useAuth();
    const [farmerContext, setFarmerContext] = useState(null);

    const [messages, setMessages] = useState([
        {
            id: crypto.randomUUID(),
            sender: 'ai',
            text: "Namaste! I am Sakhi, your farming expert. How can I help you today?",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: ["What crops suit my soil?", "Check weather forecast", "How to improve yield?"]
        }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (user?.id) {
            const savedConvId = localStorage.getItem(CONVERSATION_KEY(user.id));
            if (savedConvId) setConversationId(savedConvId);
            loadFarmerContext();
        }
    }, [user?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

    /**
     * Load ALL farmer context: profile, farms, crops, recent activities
     * This gives Dify comprehensive knowledge about the farmer.
     */
    const loadFarmerContext = async () => {
        try {
            const { data: farmer } = await supabase
                .from('farmers').select('*').eq('id', user.id).single();

            const { data: farms } = await supabase
                .from('farms').select('*').eq('farmer_id', user.id);

            // Fetch active crops across all farms
            const { data: allCrops } = await supabase
                .from('crop_records').select('*').eq('farmer_id', user.id).eq('status', 'active');
            const farmerFarmIds = (farms || []).map(f => f.id);
            const farmerCrops = (allCrops || []).filter(c => farmerFarmIds.includes(c.farm_id));

            // Fetch recent activity logs (last 15)
            const { data: allLogs } = await supabase
                .from('activity_logs').select('*').eq('farmer_id', user.id)
                .order('date', { ascending: false }).limit(15);

            if (farmer) {
                setFarmerContext({
                    farmer_name: farmer.full_name,
                    phone: farmer.phone_number,
                    state: farmer.state,
                    district: farmer.district,
                    village: farmer.village,
                    language: farmer.preferred_language,
                    farms: (farms || []).map(f => ({
                        name: f.farm_name,
                        area_acres: f.area_acres,
                        soil_type: f.soil_type,
                        irrigation: f.irrigation_type,
                    })),
                    crops: farmerCrops.map(c => ({
                        crop: c.crop_name,
                        stage: c.growth_stage,
                        season: c.season,
                        planted: c.planted_date,
                    })),
                    recent_activities: (allLogs || []).map(l => ({
                        type: l.activity_type,
                        title: l.title,
                        crop: l.crop_name,
                        date: l.date,
                    })),
                });
            }
        } catch (err) {
            console.warn('[Chat] Could not load farmer context:', err);
        }
    };

    const handleSend = async (text = input) => {
        if (!text.trim() || isTyping) return;

        const userMsg = {
            id: crypto.randomUUID(),
            sender: 'user',
            text: text.trim(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const result = await difySendMessage(
                text.trim(),
                conversationId,
                user?.id || 'anon',
                farmerContext
            );

            if (result.conversation_id) {
                setConversationId(result.conversation_id);
                if (user?.id) {
                    localStorage.setItem(CONVERSATION_KEY(user.id), result.conversation_id);
                }
            }

            const aiMsg = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: result.answer,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('[Chat] Error:', error);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: "I'm sorry, I'm having trouble connecting. Please try again.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleNewChat = () => {
        setMessages([{
            id: crypto.randomUUID(),
            sender: 'ai',
            text: "Namaste! I am Sakhi, your farming expert. How can I help you today?",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: ["What crops suit my soil?", "Check weather forecast", "How to improve yield?"]
        }]);
        setConversationId(null);
        if (user?.id) localStorage.removeItem(CONVERSATION_KEY(user.id));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col" style={{ height: 'calc(100dvh - 6.5rem)' }}>
            {/* Header */}
            <header className="bg-primary px-4 py-3 text-white flex items-center justify-between shadow-md relative z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                        <span className="text-lg">👩🏽‍🌾</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg flex items-center gap-1.5">
                            Ask Sakhi <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                        </h1>
                        <p className="text-[11px] text-green-100 font-medium">
                            Expert Agronomist • {farmerContext ? `For ${farmerContext.farmer_name}` : 'Online'}
                        </p>
                    </div>
                </div>
                <button onClick={handleNewChat} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Start new conversation">
                    <RotateCcw className="w-5 h-5" />
                </button>
            </header>

            {/* Context badge */}
            {farmerContext?.crops?.length > 0 && (
                <div className="bg-green-50 px-4 py-1.5 border-b border-green-100 flex-shrink-0">
                    <p className="text-[10px] text-green-700 font-medium truncate">
                        🌱 {farmerContext.crops.map(c => c.crop).join(', ')} | 📋 {farmerContext.recent_activities?.length || 0} recent logs
                    </p>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="flex justify-center">
                    <span className="bg-slate-200/50 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Today
                    </span>
                </div>

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.sender === 'ai' ? (
                                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-100 mt-1">
                                    <span className="text-sm">👩🏽‍🌾</span>
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex-shrink-0 flex items-center justify-center mt-1">
                                    <User className="w-4 h-4" />
                                </div>
                            )}
                            <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-[15px] leading-relaxed ${msg.sender === 'user'
                                ? 'bg-primary text-white rounded-tr-sm'
                                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                                }`}>
                                {msg.text}
                                <div className={`text-[10px] mt-1.5 opacity-70 font-medium ${msg.sender === 'user' ? 'text-right text-green-100' : 'text-slate-400'}`}>
                                    {msg.time}
                                </div>
                            </div>
                        </div>

                        {msg.suggestions?.length > 0 && (
                            <div className="mt-3 ml-10 flex flex-wrap gap-2">
                                {msg.suggestions.map((s, idx) => (
                                    <button key={idx} onClick={() => handleSend(s)} disabled={isTyping}
                                        className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-100 hover:border-green-300 transition-colors shadow-sm disabled:opacity-50">
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {isTyping && (
                    <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-100 mt-1">
                            <span className="text-sm">👩🏽‍🌾</span>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2 border-2 border-primary/30 rounded-2xl px-3 py-2 bg-slate-50 focus-within:border-primary/60 transition-colors">
                    <button className="p-1.5 text-slate-400 hover:text-primary transition-colors flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                    </button>
                    <input ref={inputRef} type="text"
                        className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm py-1"
                        placeholder="Type your farming question..."
                        value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown} disabled={isTyping} />
                    {input.trim() ? (
                        <button onClick={() => handleSend()} disabled={isTyping}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0">
                            <Send className="w-4 h-4" />
                        </button>
                    ) : (
                        <button className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-colors flex-shrink-0">
                            <Mic className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIAssistantChatScreen;
