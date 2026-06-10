// Shared health-probe helpers. Centralizing the probe URL is not cosmetic: the
// CLI's no-op gate and Deploy.#startCore's skip-check must probe the IDENTICAL URL,
// or the gate silently disagrees with the start path.

/** A liveness probe that treats 404 as "reachable" (the route exists, server is up). */
export const isUp = async (url: string): Promise<boolean> => {
    try{
        const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        return res.ok || res.status === 404;
    }catch{
        return false;
    }
};

/** Always-present route used to detect that the API/web app is serving. */
export const PROBE_PATH = '/api/auth/emails/probe%40volt.local/availability';

/** Web-app probe URL, honoring the WEB_PORT default used across the stack. */
export const webProbeUrl = (env: Record<string, string>): string =>
    `http://localhost:${env.WEB_PORT ?? '5273'}${PROBE_PATH}`;
