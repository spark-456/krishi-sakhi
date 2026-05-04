const DEFAULT_BACKEND_PORT = '8000';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isPrivateIpv4(hostname) {
    return (
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    );
}

function buildDerivedUrl(protocol, hostname, port) {
    return `${protocol}//${hostname}:${port || DEFAULT_BACKEND_PORT}`;
}

export function resolveApiBaseUrl() {
    const configured = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const hasWindow = typeof window !== 'undefined';
    const currentHost = hasWindow ? window.location.hostname : '';
    const useLoopback = LOOPBACK_HOSTS.has(currentHost);

    // In Vite dev, always talk to the same HTTPS origin and let the dev server
    // proxy API requests to the FastAPI backend. This avoids mixed-content
    // failures when the app is opened on https://<laptop-ip>:5173.
    if (import.meta.env.DEV) {
        if (!hasWindow) return 'https://127.0.0.1:5173';
        return window.location.origin;
    }

    if (!configured) {
        if (!hasWindow) return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
        return buildDerivedUrl('http', useLoopback ? '127.0.0.1' : currentHost, DEFAULT_BACKEND_PORT);
    }

    try {
        const parsed = new URL(configured);
        const configuredPort = parsed.port || DEFAULT_BACKEND_PORT;

        if (useLoopback && isPrivateIpv4(parsed.hostname)) {
            return buildDerivedUrl(parsed.protocol.replace(':', ''), '127.0.0.1', configuredPort);
        }

        if (isPrivateIpv4(currentHost) && isPrivateIpv4(parsed.hostname) && currentHost !== parsed.hostname) {
            return buildDerivedUrl(parsed.protocol.replace(':', ''), currentHost, configuredPort);
        }

        return configured;
    } catch {
        return configured;
    }
}

export const API_BASE = resolveApiBaseUrl();
