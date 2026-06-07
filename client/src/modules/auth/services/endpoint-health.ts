const HEALTH_PROBE_TIMEOUT_MS = 5000;

export enum EndpointHealthFailure {
    Invalid = 'invalid',
    Unreachable = 'unreachable',
    NotVolt = 'not-volt',
    Timeout = 'timeout'
}

export type EndpointHealthResult =
    | { ok: true; origin: string }
    | { ok: false; reason: EndpointHealthFailure };

const trimTrailingSlash = (value: string): string => value.replace(/\/$/, '');

export const normalizeEndpoint = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }

    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const url = new URL(withScheme);
        return trimTrailingSlash(url.origin);
    } catch {
        return null;
    }
};

export const probeEndpointHealth = async (rawEndpoint: string): Promise<EndpointHealthResult> => {
    const origin = normalizeEndpoint(rawEndpoint);
    if (!origin) {
        return { ok: false, reason: EndpointHealthFailure.Invalid };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT_MS);

    try {
        const response = await fetch(`${origin}/healthz`, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
            return { ok: false, reason: EndpointHealthFailure.NotVolt };
        }

        const payload = await response.json().catch(() => null);
        if (!payload || payload.status !== 'ok') {
            return { ok: false, reason: EndpointHealthFailure.NotVolt };
        }

        return { ok: true, origin };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return { ok: false, reason: EndpointHealthFailure.Timeout };
        }

        return { ok: false, reason: EndpointHealthFailure.Unreachable };
    } finally {
        window.clearTimeout(timeoutId);
    }
};

export const describeEndpointFailure = (reason: EndpointHealthFailure): string => {
    switch (reason) {
        case EndpointHealthFailure.Invalid:
            return 'Enter a valid server address.';
        case EndpointHealthFailure.NotVolt:
            return 'That address does not look like a Volt server.';
        case EndpointHealthFailure.Timeout:
            return 'The server took too long to respond. Check the address and try again.';
        default:
            return 'Could not reach that server. Check the address and try again.';
    }
};
