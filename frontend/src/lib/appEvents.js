export const DATA_REFRESH_EVENT = 'ks:data-refresh'

export function dispatchDataRefresh(targets = []) {
    if (!Array.isArray(targets) || targets.length === 0) return
    window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT, { detail: { targets } }))
}

export function subscribeToDataRefresh(handler) {
    const wrapped = (event) => handler(event.detail?.targets || [])
    window.addEventListener(DATA_REFRESH_EVENT, wrapped)
    return () => window.removeEventListener(DATA_REFRESH_EVENT, wrapped)
}

export function shouldRefresh(targets = [], watched = []) {
    return watched.some((key) => targets.includes(key))
}
