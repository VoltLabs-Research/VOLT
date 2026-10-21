// Smoke page: boots the server worker, then drives a few API requests over the loopback network and
// reports each result to the harness (scripts/smoke.mjs) through console.log.
import { BackendHost } from '../src/host/BackendHost';
import type { LoopbackChannelMessage } from '../src/platform/loopback';

const SERVER_PORT = 8100;

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

// Reports a step and stops the run unless it passed, so the harness exits non-zero.
const check = (step: string, value: unknown, passed: boolean): void => {
    report(step, value);
    if(!passed){
        throw new Error(`step ${step} failed`);
    }
};

const host = new BackendHost();
host.onExit = (name, code) => report('exit', { name, code });

const request = (method: string, url: string, body?: unknown, token?: string): Promise<{ status: number; body: unknown; headers: Record<string, string | string[]> }> => {
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
        let headers: Record<string, string | string[]> = {};
        const chunks: Uint8Array[] = [];
        channel.onmessage = (event: MessageEvent<LoopbackChannelMessage>) => {
            const message = event.data;
            if(message.type === 'head'){
                status = message.status;
                headers = message.headers;
            }else if(message.type === 'data'){
                chunks.push(message.chunk);
            }else if(message.type === 'end'){
                const text = new TextDecoder().decode(new Uint8Array(chunks.flatMap((chunk) => [...chunk])));
                const isJson = String(headers['content-type'] ?? '').includes('json');
                resolve({ status, headers, body: isJson && text ? JSON.parse(text) : text });
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
    const health = await request('GET', '/healthz');
    check('healthz', health, health.status === 200);
    const config = await request('GET', '/api/system/config');
    check('config', config.body, (config.body as { data?: { mode?: string } }).data?.mode === 'local');
    const signUp = await request('POST', '/api/auth/users', { email: 'smoke@volt.local', password: 'volt-smoke-password', firstName: 'Smoke', lastName: 'Test' });
    check('signUp', { status: signUp.status }, signUp.status === 201);
    const signIn = await request('POST', '/api/auth/sessions', { email: 'smoke@volt.local', password: 'volt-smoke-password' });
    const token = (signIn.body as { data?: { token?: string } } | null)?.data?.token;
    check('signIn', { status: signIn.status, hasToken: Boolean(token) }, Boolean(token));
    const me = await request('GET', '/api/auth/me', undefined, token);
    const avatar = (me.body as { data?: { avatar?: string } }).data?.avatar ?? '';
    check('me', { status: me.status, avatar }, me.status === 200 && avatar.length > 0);
    const avatarFile = await request('GET', new URL(avatar).pathname, undefined, token);
    const isSvg = String(avatarFile.body).startsWith('<svg');
    check('avatar', { status: avatarFile.status, contentType: avatarFile.headers['content-type'], isSvg }, avatarFile.status === 200 && isSvg);
    report('done', true);
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
