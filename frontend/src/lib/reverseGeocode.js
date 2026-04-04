/**
 * Reverse Geocode — GPS to State/District/Village
 * ────────────────────────────────────────────────
 * Uses free Nominatim (OpenStreetMap) API.
 * Rate limit: 1 request/sec. Fine for onboarding.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ state: string|null, district: string|null, village: string|null }>}
 */
export async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'en',
                    // Nominatim requires a User-Agent for their usage policy
                    'User-Agent': 'KrishiSakhi-PWA/1.0',
                },
            }
        )

        if (!response.ok) {
            console.warn('[reverseGeocode] API returned', response.status)
            return { state: null, district: null, village: null }
        }

        const data = await response.json()
        const address = data.address || {}

        // Nominatim returns: state, county (often = district), village/town/city
        const state = address.state || null
        const district =
            address.county ||
            address.state_district ||
            address.city_district ||
            address.city ||
            null
        const village =
            address.village ||
            address.town ||
            address.suburb ||
            address.neighbourhood ||
            null

        return { state, district, village }
    } catch (err) {
        console.error('[reverseGeocode] Failed:', err.message)
        return { state: null, district: null, village: null }
    }
}
