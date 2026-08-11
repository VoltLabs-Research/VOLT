export type RemoteProbeResult =
    | { ok: true; serverEndpoint: string; clientUrl: string }
    | { ok: false; reason: 'invalid-url' | 'unreachable' | 'not-volt' | 'no-client-host' };

const PROBE_TIMEOUT = 4_000;

const candidateOrigins = (raw: string): string[] => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if(!trimmed) return [];
    const withScheme = /^https?:\/\//i.test(trimmed) ? [trimmed] : [`https://${trimmed}`, `http://${trimmed}`];

    const origins: string[] = [];
    for(const candidate of withScheme){
        try{
            const url = new URL(candidate);
            if(url.protocol === 'http:' || url.protocol === 'https:') origins.push(url.origin);
        }catch{ /* ignore malformed candidate */ }
    }
    return origins;
};

interface HealthzResponse{
    status?: string;
    clientHost?: string | null;
}

export const probeRemoteEndpoint = async (rawEndpoint: string): Promise<RemoteProbeResult> => {
    const origins = candidateOrigins(rawEndpoint);
    if(origins.length === 0) return {
        ok: false,
        reason: 'invalid-url'
    };

    let reachedServer = false;

    for(const origin of origins){
        let res: Response;
        try{
            res = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
        }catch{
            continue;
        }

        if(!res.ok) continue;

        let body: HealthzResponse | null = null;
        try{ body = await res.json() as HealthzResponse; }catch{ /* non-JSON body */ }

        if(body?.status !== 'ok'){
            reachedServer = true;
            continue;
        }

        if(!body.clientHost) return {
            ok: false,
            reason: 'no-client-host'
        };
        return {
            ok: true,
            serverEndpoint: origin,
            clientUrl: body.clientHost
        };
    }

    return {
        ok: false,
        reason: reachedServer ? 'not-volt' : 'unreachable'
    };
};
