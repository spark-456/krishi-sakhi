import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Mic, Image as ImageIcon, Sparkles, User, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const AIAssistantChatScreen = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: "Namaste! I am Sakhi, your farming expert. I noticed your wheat crop is in the vegetative stage. How can I help you today?",
            time: "10:00 AM",
            suggestions: ["When should I apply urea?", "Check weather forecast", "Scan crop for diseases"]
        }
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (text = input) => {
        if (!text.trim()) return;

        // Add user message
        const newUserMsg = { id: Date.now(), sender: 'user', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        setMessages(prev => [...prev, newUserMsg]);
        setInput('');

        // Simulate AI typing and response
        setTimeout(() => {
            const aiResponse = {
                id: Date.now() + 1,
                sender: 'ai',
                text: "I understand you are asking about: '" + text + "'. As an AI model placeholder, I will connect to the backend logic (Dify/Langchain) once it is integrated to provide an accurate agricultural response based on local real-time context.",
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-screen max-w-md mx-auto bg-[#F4F7F4] font-sans">
            {/* Header */}
            <header className="bg-primary px-4 py-4 text-white flex items-center justify-between shadow-md relative z-20">
                <div className="flex items-center gap-3">
                    <Link to="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors -ml-2">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-inner border-2 border-green-400">
                                👩🏽‍🌾
                            </div>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-primary rounded-full"></span>
                        </div>
                        <div>
                            <h1 className="font-bold text-[17px] leading-tight flex items-center gap-1">
                                Ask Sakhi <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                            </h1>
                            <p className="text-[11px] text-green-100 font-medium">Expert Agronomist • Online</p>
                        </div>
                    </div>
                </div>
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <FileText className="w-5 h-5" />
                </button>
            </header>

            {/* Chat Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
                <div className="flex justify-center">
                    <span className="bg-slate-200/50 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                        Today
                    </span>
                </div>

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                            {/* Avatar */}
                            {msg.sender === 'ai' ? (
                                <div className="w-8 h-8 rounded-full bg-white shadow-sm flex-shrink-0 flex items-center justify-center border border-slate-100 mt-1">
                                    <span className="text-sm">👩🏽‍🌾</span>
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex-shrink-0 flex items-center justify-center mt-1">
                                    <User className="w-4 h-4" />
                                </div>
                            )}

                            {/* Message Bubble */}
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

                        {/* Smart Suggestions Chips (Only AI can show these) */}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-3 ml-10 flex flex-wrap gap-2">
                                {msg.suggestions.map((s, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(s)}
                                        className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-green-100 hover:border-green-300 transition-colors shadow-sm"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 p-3 pb-safe">
                <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-1 shadow-inner pr-2 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                    <button className="p-3 text-slate-400 hover:text-primary transition-colors hover:bg-slate-100 rounded-full shrink-0">
                        <ImageIcon className="w-5 h-5" />
                    </button>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Type your farming question..."
                        className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none py-3 text-[15px] text-slate-800"
                        rows={1}
                    />

                    {input.trim() ? (
                        <button
                            onClick={() => handleSend()}
                            className="p-3 mb-0.5 bg-primary text-white rounded-full hover:bg-primary/90 transition-transform active:scale-95 shrink-0 shadow-md shadow-primary/20"
                        >
                            <Send className="w-4 h-4 ml-0.5" />
                        </button>
                    ) : (
                        <button className="p-3 mb-0.5 bg-slate-200 text-slate-600 rounded-full hover:bg-slate-300 transition-colors shrink-0">
                            <Mic className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIAssistantChatScreen;
