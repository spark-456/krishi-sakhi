/**
 * Dify Chat API Client
 * ────────────────────
 * Wrapper for Dify Chat Message API (blocking mode).
 * Preserves conversation_id across turns for multi-turn context.
 *
 * If Dify is unreachable, returns a fallback response so the UI never crashes.
 */

const DIFY_API_URL = import.meta.env.VITE_DIFY_API_URL || 'http://localhost/v1'
const DIFY_API_KEY = import.meta.env.VITE_DIFY_CHATBOT_API_KEY || ''

const FALLBACK_RESPONSE = {
    answer: "I'm sorry, Sakhi is currently unavailable. Please check your connection and try again.",
    conversation_id: null,
}

/**
 * Send a message to Dify Chat API.
 *
 * @param {string} query           — The user's message text
 * @param {string|null} conversationId — Dify conversation ID for multi-turn. null = new conversation.
 * @param {string} userId          — Unique user identifier (farmer UUID)
 * @returns {Promise<{ answer: string, conversation_id: string }>}
 */
export async function sendMessage(query, conversationId = null, userId = 'demo-user') {
    if (!DIFY_API_KEY) {
        console.warn('[difyClient] VITE_DIFY_CHATBOT_API_KEY not set. Returning fallback.')
        return FALLBACK_RESPONSE
    }

    const payload = {
        inputs: {},
        query,
        response_mode: 'blocking',
        user: userId,
    }

    // Only include conversation_id if we have one (continuing a conversation)
    if (conversationId) {
        payload.conversation_id = conversationId
    }

    try {
        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error')
            console.error(`[difyClient] API error ${response.status}: ${errorText}`)
            return {
                ...FALLBACK_RESPONSE,
                answer: `Sakhi encountered an error (${response.status}). Please try again.`,
            }
        }

        const data = await response.json()

        return {
            answer: data.answer || FALLBACK_RESPONSE.answer,
            conversation_id: data.conversation_id || conversationId,
        }
    } catch (error) {
        console.error('[difyClient] Network error:', error.message)
        return FALLBACK_RESPONSE
    }
}
