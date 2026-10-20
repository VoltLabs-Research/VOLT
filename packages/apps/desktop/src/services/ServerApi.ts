import { setTimeout as sleep } from 'node:timers/promises';
import { buildPath } from '@volt/contracts/shared/routing';
import type { Endpoint, HttpMethod } from '@volt/contracts/shared/routing';

export class HttpError extends Error{
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ){
        super(message);
    }
}

export interface RequestOptions{
    params?: Record<string, string>;
    body?: object;
    token?: string;
    attempts?: number;
    timeoutMs?: number;
}

const REQUEST_TIMEOUT_MS = 10_000;

const readMessage = (payload: unknown): string | undefined => {
    if(typeof payload !== 'object' || payload === null) return undefined;
    const message = (payload as { message?: unknown }).message;
    return typeof message === 'string' ? message : undefined;
};

const readCode = (payload: unknown): string => {
    if(typeof payload !== 'object' || payload === null) return '';
    const record = payload as { code?: unknown; status?: unknown };
    if(typeof record.code === 'string') return record.code;
    if(typeof record.status === 'string') return record.status;
    return '';
};

const readData = (payload: unknown): unknown => {
    if(typeof payload !== 'object' || payload === null) return payload;
    return 'data' in payload ? (payload as { data: unknown }).data : payload;
};

export default class ServerApi{
    constructor(public readonly origin: string){}

    async request<T>(
        endpoint: Endpoint<never, unknown> | Endpoint<unknown, unknown>,
        options: RequestOptions = {}
    ): Promise<T>{
        const path = buildPath(endpoint, options.params);
        const url = `${this.origin}${path}`;
        const method: HttpMethod = endpoint.method;

        const headers: Record<string, string> = {};
        if(options.body) headers['Content-Type'] = 'application/json';
        if(options.token) headers.Authorization = `Bearer ${options.token}`;

        const attempts = options.attempts ?? (method === 'GET' ? 1 : 5);
        let lastErr: unknown;

        for(let attempt = 0; attempt < attempts; attempt++){
            let response: Response;
            let text: string;
            try{
                response = await fetch(url, {
                    method,
                    headers,
                    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
                    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS)
                });
                text = await response.text();
            }catch(err){
                lastErr = err;
                if(attempt < attempts - 1){
                    await sleep(1000);
                    continue;
                }
                throw err;
            }

            let payload: unknown = null;
            try{
                payload = text ? JSON.parse(text) : null;
            }catch{
                payload = null;
            }

            if(!response.ok){
                const message = readMessage(payload) ?? text ?? `HTTP ${response.status}`;
                const code = readCode(payload);
                throw new HttpError(
                    response.status,
                    code,
                    `${path} → ${response.status} ${code} ${message}`.replace(/\s+/g, ' ').trim()
                );
            }

            return readData(payload) as T;
        }

        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
};
