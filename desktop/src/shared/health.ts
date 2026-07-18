

export const isUp = async (url: string): Promise<boolean> => {
    try{
        const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        return res.ok || res.status === 404;
    }catch{
        return false;
    }
};

export const PROBE_PATH = '/api/auth/emails/probe%40volt.local/availability';

export const webProbeUrl = (env: Record<string, string>): string =>
    `http://localhost:${env.WEB_PORT ?? '5273'}${PROBE_PATH}`;
