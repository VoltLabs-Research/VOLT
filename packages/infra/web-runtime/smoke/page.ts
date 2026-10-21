// Smoke page: boots the server worker, then drives a few API requests over the loopback network and
// reports each result to the harness (scripts/smoke.mjs) through console.log.
import { BackendHost } from '../src/host/BackendHost';
import type { LoopbackChannelMessage } from '../src/platform/loopback';

const SERVER_PORT = 8100;

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const host = new BackendHost();
host.onExit = (name, code) => report('exit', { name, code });

const request = (method: string, url: string, body?: unknown, token?: string): Promise<{ status: number; body: unknown }> => {
    const bytes = body === undefined ? null : new TextEncoder().encode(JSON.stringify(body));
    const channel = host.connect(SERVER_PORT, 'http', {
        method,
        url,
        headers: {
            host: `127.0.0.1:${SERVER_PORT}`,
            accept: 'application/json',
            ...(bytes ? { 'content-type': 'application/json', 'content-length': String(bytes.byteLength) } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {})
        }
    });
    return new Promise((resolve, reject) => {
        let status = 0;
        const chunks: Uint8Array[] = [];
        channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'head'){
                status = message.status;
            }else if(message.type === 'data'){
                chunks.push(message.chunk);
            }else if(message.type === 'end'){
                const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
                resolve({ status, body: text ? JSON.parse(text) : null });
            }else if(message.type === 'error'){
                reject(new Error(message.message));
            }
        };
        if(bytes){
            const chunk = bytes.slice();
            channel.postMessage({ type: 'data', chunk } satisfies LoopbackChannelMessage, [chunk.buffer]);
        }
        channel.postMessage({ type: 'end' } satisfies LoopbackChannelMessage);
    });
};

const run = async (): Promise<void> => {
    await host.start({
        name: 'server',
        scriptUrl: new URL('../server.worker.js', import.meta.url),
        port: SERVER_PORT,
        boot: {
            env: {
                NODE_ENV: 'production',
                DEPLOYMENT_MODE: 'local',
                SERVER_PORT: String(SERVER_PORT),
                SERVER_HOST: '127.0.0.1',
                SERVER_ENDPOINT: `http://127.0.0.1:${SERVER_PORT}`,
                CLIENT_HOST: `http://127.0.0.1:${SERVER_PORT}`,
                DATABASE_URL: 'sqlite:/data/server/server.sqlite',
                SERVER_DATA_DIR: '/data/server',
                SECRET_KEY: 'smoke-secret-key-0123456789abcdef0123456789abcdef',
                SSH_ENCRYPTION_KEY: 'smoke-ssh-key-0123456789abcdef0123456789abcdef'
            },
            argv: [],
            cwd: '/app/server',
            fsDirectory: 'volt-smoke-server-fs',
            sqliteDirectory: '.volt-smoke-server-sqlite'
        }
    });
    report('listening', true);
    report('healthz', await request('GET', '/healthz'));
    report('config', await request('GET', '/api/system/config'));
    const signUp = await request('POST', '/api/auth/users', { email: 'smoke@volt.local', password: 'volt-smoke-password', firstName: 'Smoke', lastName: 'Test' });
    report('signUp', { status: signUp.status });
    const signIn = await request('POST', '/api/auth/sessions', { email: 'smoke@volt.local', password: 'volt-smoke-password' });
    const token = (signIn.body as { data?: { token?: string } } | null)?.data?.token;
    report('signIn', { status: signIn.status, hasToken: Boolean(token) });
    report('me', await request('GET', '/api/auth/me', undefined, token));
    report('done', true);
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
