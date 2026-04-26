/**
 * AIAssistantChatScreen — Ask Sakhi (Enhanced Context)
 * ────────────────────────────────────────────────────
 * Sends farmer profile, crops, and recent activities to Dify.
 * Fixed: Input positioned correctly above BottomNav via ProtectedLayout.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Image as ImageIcon, Sparkles, User, RotateCcw, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { askAdvisory, createAdvisorySession, sendVoiceMessage } from '../lib/backendClient';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useChat } from '../contexts/ChatContext';

const CONVERSATION_KEY = (id) => `ks_chat_session_${id}`;

const AIAssistantChatScreen = () => {
    const { user, session } = useAuth();
    const location = useLocation();
    const [farmerContext, setFarmerContext] = useState(null);
    const { isRecording, audioBlob, startRecording, stopRecording, clearAudio } = useVoiceRecorder();
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    // Check if we arrived from the soil scanner with a result
    const incomingSoilResult = location.state?.soilScanResult || null;

    const { messages, setMessages, sessionId, setSessionId, injectSoilResult, handleNewChat } = useChat();

    useEffect(() => {
        if (incomingSoilResult) {
            injectSoilResult(incomingSoilResult);
        }
    }, [incomingSoilResult]);

    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (user?.id && session?.access_token) {
            const savedSessionId = localStorage.getItem(CONVERSATION_KEY(user.id));
            if (savedSessionId) {
                setSessionId(savedSessionId);
            } else {
                createAdvisorySession({ token: session.access_token }).then(res => {
                    setSessionId(res.session_id);
                    localStorage.setItem(CONVERSATION_KEY(user.id), res.session_id);
                }).catch(console.warn);
            }
            loadFarmerContext();
        }
    }, [user?.id, session?.access_token]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

    /**
     * Load farmer context mostly for the UI badge.
     * The backend ContextAssembler handles the real data payload for the LLM natively!
     */
    const loadFarmerContext = async () => {
        try {
            const { data: farmer } = await supabase
                .from('farmers').select('*').eq('id', user.id).single();

            const { data: farms } = await supabase
                .from('farms').select('*').eq('farmer_id', user.id);

            const { data: allCrops } = await supabase
                .from('crop_records').select('*').eq('farmer_id', user.id).eq('status', 'active');
            const farmerFarmIds = (farms || []).map(f => f.id);
            const farmerCrops = (allCrops || []).filter(c => farmerFarmIds.includes(c.farm_id));

            const { data: allLogs } = await supabase
                .from('activity_logs').select('*').eq('farmer_id', user.id)
                .order('date', { ascending: false }).limit(15);

            if (farmer) {
                setFarmerContext({
                    farmer_name: farmer.full_name,
                    crops: farmerCrops.map(c => ({ crop: c.crop_name })),
                    recent_activities: (allLogs || []),
                });
            }
        } catch (err) {
            console.warn('[Chat UI] Could not load farmer context for badge:', err);
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
            const result = await askAdvisory({
                sessionId: sessionId,
                inputChannel: 'text',
                farmerInputText: text.trim(),
                farmId: null, 
                cropRecordId: null,
                token: session.access_token
            });

            const aiMsg = {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: result.response_text,
                audio_b64: result.audio_b64,
                isNew: true,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('[Chat] Backend Error:', error);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: "I'm sorry, my backend connection (FastAPI) seems unavailable locally. Please check your local server or `.env` file.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    useEffect(() => {
        if (audioBlob) {
            handleVoiceSend(audioBlob);
        }
    }, [audioBlob]);

    useEffect(() => {
        let interval;
        if (isRecording) {
            setRecordingSeconds(0);
            interval = setInterval(() => {
                setRecordingSeconds(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const handleVoiceSend = async (blob) => {
        setIsTyping(true);
        const tempMsgId = crypto.randomUUID();
        setMessages(prev => [...prev, {
            id: tempMsgId,
            sender: 'user',
            text: '🎤 Transcribing...',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);

        try {
            const data = await sendVoiceMessage({
                audioBlob: blob,
                farmerId: user.id,
                conversationId: sessionId,
                token: session?.access_token
            });

            // Update user message with text transcript
            setMessages(prev => prev.map(m => m.id === tempMsgId ? { ...m, text: data.transcription || '🎤 (empty)' } : m));

            if (data.transcription && data.answer) {
                setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    sender: 'ai',
                    text: data.answer,
                    audio_b64: data.audio_response_b64,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
            } else if (!data.transcription) {
                 setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    sender: 'ai',
                    text: "Sorry, the audio transcription service is currently unavailable or the audio was empty. Please try typing your question.",
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
            }
        } catch (error) {
            console.error('[Voice] Transcription error:', error);
            setMessages(prev => prev.map(m => m.id === tempMsgId ? { ...m, text: '🎤 (error)' } : m));
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: "Sorry, the voice service is under maintenance. Please try again later or type your question.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            clearAudio();
            setIsTyping(false);
        }
    };

    const onNewChatClick = () => {
        handleNewChat();
        
        if (user?.id && session?.access_token) {
            localStorage.removeItem(`ks_chat_session_${user.id}`);
            createAdvisorySession({ token: session.access_token }).then(res => {
                setSessionId(res.session_id);
                localStorage.setItem(`ks_chat_session_${user.id}`, res.session_id);
            }).catch(console.warn);
        }
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
                <button onClick={onNewChatClick} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Start new conversation">
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
                                {msg.sender === 'ai' && msg.audio_b64 && (
                                    <div className="mt-2">
                                        <audio controls autoPlay={msg.isNew} onEnded={() => { msg.isNew = false; }} src={`data:audio/mpeg;base64,${msg.audio_b64}`} className="h-8 w-full max-w-[200px]" />
                                    </div>
                                )}
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
                    {isRecording ? (
                        <div className="flex-1 flex items-center justify-between text-red-500 font-medium px-2">
                            <span className="flex items-center gap-2 animate-pulse">
                                <Mic className="w-4 h-4" /> Recording...
                            </span>
                            <span>{Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                        </div>
                    ) : (
                        <input ref={inputRef} type="text"
                            className="flex-1 bg-transparent outline-none text-slate-800 placeholder-slate-400 text-sm py-1"
                            placeholder="Type your farming question..."
                            value={input} onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown} disabled={isTyping} />
                    )}
                    {input.trim() && !isRecording ? (
                        <button onClick={() => handleSend()} disabled={isTyping}
                            className="p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0">
                            <Send className="w-4 h-4" />
                        </button>
                    ) : isRecording ? (
                        <button onClick={stopRecording} className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex-shrink-0 animate-pulse shadow-md">
                            <Loader2 className="w-4 h-4 animate-spin hidden" />
                            <div className="w-4 h-4 rounded-sm bg-white" />
                        </button>
                    ) : (
                        <button onClick={startRecording} disabled={isTyping} className="p-2 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-colors flex-shrink-0">
                            <Mic className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIAssistantChatScreen;
