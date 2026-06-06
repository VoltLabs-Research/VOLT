import crypto from 'node:crypto';
import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import { setTimeout as sleep } from 'node:timers/promises';

export interface BootstrapProps{
    appConfig: AppConfig;
    serverOrigin: string;
}

interface AuthResponse{
    token: string;
    user: { _id: string };
}

interface TeamResponse{
    _id: string;
}

interface TeamClusterResponse{
    teamCluster: { _id: string };
    enrollmentToken: string;
}

const log = (line: string) => bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] ${line}` });

const randomPassword = () => crypto.randomBytes(24).toString('base64url');

export default class Bootstrap{
    constructor(private readonly props: BootstrapProps){}

    async ensure(): Promise<BootstrapState>{
        const existing = await this.props.appConfig.getBootstrap();
        if(existing){
            try{
                const authToken = await this.#signIn(existing.email, existing.password);
                const enrollmentToken = await this.#tryRegenerateEnrollmentToken(authToken, existing.teamId, existing.teamClusterId);

                // Reveal lazily so configs written before daemonPassword existed self-heal
                // on the next launch instead of forcing a full re-bootstrap.
                const daemonPassword = existing.daemonPassword
                    ?? await this.#revealDaemonPassword(authToken, existing.teamId, existing.teamClusterId, existing.password);

                const next: BootstrapState = {
                    ...existing,
                    authToken,
                    enrollmentToken: enrollmentToken ?? existing.enrollmentToken,
                    daemonPassword
                };
                await this.props.appConfig.setBootstrap(next);
                return next;
            }catch(err){
                log(`re-signIn failed (${(err as Error).message}); running full bootstrap`);
                await this.props.appConfig.clearBootstrap();
            }
        }

        return this.#fullBootstrap();
    }

    async #tryRegenerateEnrollmentToken(authToken: string, teamId: string, teamClusterId: string): Promise<string | null>{
        try{
            const data = await this.#postJson<{ enrollmentToken: string }>(
                `/api/teams/${teamId}/clusters/${teamClusterId}/enrollment-token/regenerate`,
                {},
                authToken
            );
            log('regenerated enrollment token');
            return data.enrollmentToken;
        }catch(err){
            const msg = (err as Error).message;
            if(/InvalidStatusForTokenRegeneration|409/.test(msg)){
                log('cluster is connected; keeping existing enrollment token');
                return null;
            }
            throw err;
        }
    }

    async #fullBootstrap(): Promise<BootstrapState>{
        const email = `local-${crypto.randomBytes(4).toString('hex')}@volt.local`;
        const password = randomPassword();

        log(`creating local user ${email}`);
        const auth = await this.#signUp(email, password);

        log('creating local team');
        const team = await this.#createTeam(auth.token, 'Local');

        log('creating local cluster');
        const cluster = await this.#createCluster(auth.token, team._id, 'Local Cluster');

        log('revealing daemon credentials');
        const daemonPassword = await this.#revealDaemonPassword(auth.token, team._id, cluster.teamCluster._id, password);

        const state: BootstrapState = {
            done: true,
            email,
            password,
            userId: auth.user._id,
            teamId: team._id,
            teamClusterId: cluster.teamCluster._id,
            enrollmentToken: cluster.enrollmentToken,
            authToken: auth.token,
            daemonPassword
        };

        await this.props.appConfig.setBootstrap(state);
        return state;
    }

    async #signUp(email: string, password: string): Promise<AuthResponse>{
        return this.#postJson<AuthResponse>('/api/auth/users', {
            email,
            firstName: 'Local',
            lastName: '',
            password
        });
    }

    async #signIn(email: string, password: string): Promise<string>{
        const data = await this.#postJson<AuthResponse>('/api/auth/sessions', { email, password });
        return data.token;
    }

    async #createTeam(token: string, name: string): Promise<TeamResponse>{
        return this.#postJson<TeamResponse>('/api/teams', { name, description: '' }, token);
    }

    async #createCluster(token: string, teamId: string, name: string): Promise<TeamClusterResponse>{
        return this.#postJson<TeamClusterResponse>(`/api/teams/${teamId}/clusters`, { name }, token);
    }

    // Password-confirmed reveal of the cluster's decrypted service credentials. We only
    // need the daemon password — the daemon reaches the shared infra (mongo/redis/minio)
    // with the stack-level creds from compose, not the per-cluster generated ones.
    async #revealDaemonPassword(token: string, teamId: string, teamClusterId: string, password: string): Promise<string>{
        const data = await this.#postJson<{ services: { daemon: { password: string } } }>(
            `/api/teams/${teamId}/clusters/${teamClusterId}/credentials/reveal`,
            { password },
            token
        );

        const daemonPassword = data.services?.daemon?.password;
        if(!daemonPassword) throw new Error('reveal-credentials returned no daemon password');
        return daemonPassword;
    }

    async #postJson<T>(path: string, body: object, token?: string): Promise<T>{
        const url = `${this.props.serverOrigin}${path}`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if(token) headers.Authorization = `Bearer ${token}`;

        const attempts = 30;
        let lastErr: unknown;

        for(let i = 0; i < attempts; i++){
            try{
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(10_000)
                });

                const text = await res.text();
                let parsed: any = null;
                try{ parsed = text ? JSON.parse(text) : null; }catch{ /* non-json */ }

                if(!res.ok){
                    const code = parsed?.code ?? parsed?.status ?? '';
                    const msg = parsed?.message ?? text ?? `HTTP ${res.status}`;
                    throw new Error(`${path} → ${res.status} ${code} ${msg}`);
                }

                return (parsed?.data ?? parsed) as T;
            }catch(err){
                lastErr = err;
                const msg = (err as Error).message;
                if(/ECONNREFUSED|ENOTFOUND|fetch failed|timeout/i.test(msg) && i < attempts - 1){
                    await sleep(1000);
                    continue;
                }
                throw err;
            }
        }

        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
};
