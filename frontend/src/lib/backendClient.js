import { API_BASE } from './apiBase'

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
export async function sendVoiceMessage({ audioBlob, farmerId, conversationId, token, retries = 2 }) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('farmer_id', farmerId);
  if (conversationId) {
    formData.append('conversation_id', conversationId);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
      try {
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
      } catch (err) {
          if (attempt === retries) throw err;
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // exponential backoff
      }
  }
}

export async function getCropRecommendation({ farmId, token }) {
    const url = new URL(`${API_BASE}/api/v1/ml-insights/crop-recommendation`);
    if (farmId) url.searchParams.append('farm_id', farmId);
    
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Crop rec error ${resp.status}`);
    return resp.json();
}

export async function getPriceForecast({ crop, horizon = 7, token }) {
    const url = new URL(`${API_BASE}/api/v1/ml-insights/price-forecast`);
    url.searchParams.append('crop', crop);
    url.searchParams.append('horizon', horizon.toString());
    
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Price forecast error ${resp.status}`);
    return resp.json();
}

export async function getWeather({ token }) {
    const url = new URL(`${API_BASE}/api/v1/weather`);
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Weather fetch error ${resp.status}`);
    return resp.json();
}

export async function getPublishedBlogs({ token, limit = 2 }) {
    const url = new URL(`${API_BASE}/api/v1/blog`);
    url.searchParams.append('limit', limit.toString());
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Blog fetch error ${resp.status}`);
    return resp.json();
}

export async function getNotifications({ token, unreadOnly = false, limit = 25 }) {
    const url = new URL(`${API_BASE}/api/v1/notifications`);
    url.searchParams.append('limit', limit.toString());
    if (unreadOnly) url.searchParams.append('unread_only', 'true');
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Notifications fetch error ${resp.status}`);
    return resp.json();
}

export async function getFarmerToday({ token }) {
    const resp = await fetch(`${API_BASE}/api/v1/farmer-insights/today`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    if (!resp.ok) throw new Error(`Today view fetch error ${resp.status}`)
    return resp.json()
}

export async function getYieldRecords({ token, cropRecordId = null }) {
    const url = new URL(`${API_BASE}/api/v1/yields`)
    if (cropRecordId) url.searchParams.append('crop_record_id', cropRecordId)
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    if (!resp.ok) throw new Error(`Yield fetch error ${resp.status}`)
    return resp.json()
}

export async function createYieldRecord({ payload, token }) {
    const resp = await fetch(`${API_BASE}/api/v1/yields`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
    })
    if (!resp.ok) throw new Error(`Yield create error ${resp.status}`)
    return resp.json()
}

export async function deleteYieldRecord({ yieldId, token }) {
    const resp = await fetch(`${API_BASE}/api/v1/yields/${yieldId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    if (!resp.ok) throw new Error(`Yield delete error ${resp.status}`)
    return resp.json()
}

export async function markNotificationRead({ notificationId, token, isRead = true }) {
    const resp = await fetch(`${API_BASE}/api/v1/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_read: isRead })
    });
    if (!resp.ok) throw new Error(`Notification update error ${resp.status}`);
    return resp.json();
}

export async function markAllNotificationsRead({ token }) {
    const resp = await fetch(`${API_BASE}/api/v1/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    if (!resp.ok) throw new Error(`Mark-all notifications error ${resp.status}`);
    return resp.json();
}
