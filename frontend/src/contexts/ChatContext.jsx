import React, { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext();

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }) => {
    const buildInitialMessages = () => {
        const saved = localStorage.getItem('krishi_chat_messages');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {}
        }
        return [{
            id: crypto.randomUUID(),
            sender: 'ai',
            text: "Namaste! I am Sakhi, your farming expert. How can I help you today?",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggestions: ["What crops suit my soil?", "Check weather forecast", "How to improve yield?"]
        }];
    };

    const [messages, setMessages] = useState(buildInitialMessages);
    const [sessionId, setSessionId] = useState(null);

    useEffect(() => {
        localStorage.setItem('krishi_chat_messages', JSON.stringify(messages));
    }, [messages]);

    // Provide a way to inject soil scan results
    const injectSoilResult = (incomingSoilResult) => {
        if (!incomingSoilResult) return;
        
        // Don't inject if we already have it (basic check)
        if (messages.some(m => m.isSoilResult)) return;

        const { soilClass, confidence, description, tip, advisoryText } = incomingSoilResult;
        const soilLabel = soilClass ? soilClass.charAt(0).toUpperCase() + soilClass.slice(1) : 'Unknown';
        const soilText = advisoryText ||
            `Your soil is classified as **${soilLabel} Soil** (${confidence}% confidence).\n\n${description}\n\n💡 **Management Tip:** ${tip}`;

        const newMessages = [
            {
                id: crypto.randomUUID(),
                sender: 'user',
                text: `📷 *Uploaded a soil scan photo...*`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: soilText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isSoilResult: true,
            }
        ];

        setMessages(prev => [...prev, ...newMessages]);
    };

    const injectPestResult = (incomingPestResult) => {
        if (!incomingPestResult) return;
        if (messages.some(m => m.isPestResult)) return;

        const label = incomingPestResult.predicted_pest_or_disease || incomingPestResult.disease || 'Crop issue';
        const pestText =
            `I reviewed your crop image and the likely issue is **${label}** (${incomingPestResult.confidence_pct || incomingPestResult.confidence_score || 0}% confidence).\n\n` +
            `${incomingPestResult.description || 'Crop stress or disease indicators were detected.'}\n\n` +
            `💡 **Immediate Tip:** ${incomingPestResult.tip || 'Scout nearby plants and confirm severity before spraying.'}`;

        const newMessages = [
            {
                id: crypto.randomUUID(),
                sender: 'user',
                text: `📷 *Uploaded a pest or disease scan photo...*`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
                id: crypto.randomUUID(),
                sender: 'ai',
                text: pestText,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isPestResult: true,
                suggestions: [
                    'How serious is this issue for my crop?',
                    'What should I do today?',
                    'Create a support ticket for this issue',
                ],
            }
        ];

        setMessages(prev => [...prev, ...newMessages]);
    };

    const handleNewChat = () => {
        localStorage.removeItem('krishi_chat_messages');
        setMessages(buildInitialMessages());
        setSessionId(null);
    };

    return (
        <ChatContext.Provider value={{
            messages, setMessages,
            sessionId, setSessionId,
            injectSoilResult, injectPestResult, handleNewChat
        }}>
            {children}
        </ChatContext.Provider>
    );
};
