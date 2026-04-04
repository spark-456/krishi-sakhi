/**
 * Dify Chat API Client — with Farmer Context
 * ────────────────────────────────────────────
 * Sends farmer profile + farm data to Dify as inputs.
 * This gives Sakhi DB-level awareness without direct DB access.
 *
 * @module difyClient
 * @see docs/ARCHITECTURE.md for the current repo-level data flow
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
 * @param {string} query            — User message text
 * @param {string|null} conversationId — Dify conversation ID for multi-turn. null = new.
 * @param {string} userId           — Unique user identifier (farmer UUID)
 * @param {object|null} farmerContext — Farmer profile + farm data to send as inputs
 * @returns {Promise<{ answer: string, conversation_id: string }>}
 */
export async function sendMessage(query, conversationId = null, userId = 'demo-user', farmerContext = null) {
    if (!DIFY_API_KEY) {
        console.warn('[difyClient] VITE_DIFY_CHATBOT_API_KEY not set. Returning fallback.')
        return FALLBACK_RESPONSE
    }

    // Build inputs from farmer context for Dify to use
    const inputs = {}
    if (farmerContext) {
        inputs.farmer_name = farmerContext.farmer_name || ''
        inputs.farmer_state = farmerContext.state || ''
        inputs.farmer_district = farmerContext.district || ''
        inputs.farmer_village = farmerContext.village || ''
        inputs.farmer_language = farmerContext.language || 'english'
        inputs.farmer_farms = JSON.stringify(farmerContext.farms || [])
        // Phase 3: crops and recent activities
        inputs.farmer_crops = JSON.stringify(farmerContext.crops || [])
        inputs.farmer_recent_activities = JSON.stringify(farmerContext.recent_activities || [])
    }

    const payload = {
        inputs,
        query,
        response_mode: 'blocking',
        user: userId,
    }

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
