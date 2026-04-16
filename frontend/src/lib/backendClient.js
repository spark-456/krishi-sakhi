const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function askAdvisory({ sessionId, inputChannel, farmerInputText, farmId, cropRecordId, token }) {
    const resp = await fetch(`${API_BASE}/api/v1/advisory/ask`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            session_id: sessionId,
            input_channel: inputChannel,
            farmer_input_text: farmerInputText,
            farm_id: farmId || null,
            crop_record_id: cropRecordId || null,
        }),
    })
    if (!resp.ok) throw new Error(`Advisory API error ${resp.status}`)
    return resp.json()
}

export async function createAdvisorySession({ token }) {
    const resp = await fetch(`${API_BASE}/api/v1/advisory/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    })
    if (!resp.ok) throw new Error(`Session create error ${resp.status}`)
    return resp.json()
}
export async function sendVoiceMessage({ audioBlob, farmerId, conversationId, token }) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('farmer_id', farmerId);
  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }

  const resp = await fetch(`${API_BASE}/api/v1/advisory/voice-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });

  if (!resp.ok) {
    throw new Error(`Failed to process voice message: ${resp.status}`);
  }
  
  return await resp.json();
}
