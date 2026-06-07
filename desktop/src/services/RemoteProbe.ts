export type RemoteProbeResult =
    | { ok: true; serverEndpoint: string; clientUrl: string }
    | { ok: false; reason: 'invalid-url' | 'unreachable' | 'not-volt' | 'no-client-host' };

const PROBE_TIMEOUT = 4_000;

// Accept bare hosts too (e.g. "volt.lab.org" or "192.168.1.5:8000"). We prefer
// https for ambiguous input, then fall back to http for LAN-style endpoints.
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

export default class RemoteProbe{
    async probe(rawEndpoint: string): Promise<RemoteProbeResult>{
        const origins = candidateOrigins(rawEndpoint);
        if(origins.length === 0) return { ok: false, reason: 'invalid-url' };

        let reachedServer = false;

        for(const origin of origins){
            let res: Response;
            try{
                res = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(PROBE_TIMEOUT) });
            }catch{
                continue; // try the next scheme before giving up
            }

            if(!res.ok) continue;

            let body: HealthzResponse | null = null;
            try{ body = await res.json() as HealthzResponse; }catch{ /* non-JSON body */ }

            if(body?.status !== 'ok'){
                reachedServer = true; // responded, but not a VOLT /healthz
                continue;
            }

            if(!body.clientHost) return { ok: false, reason: 'no-client-host' };
            return { ok: true, serverEndpoint: origin, clientUrl: body.clientHost };
        }

        return { ok: false, reason: reachedServer ? 'not-volt' : 'unreachable' };
    }
};
