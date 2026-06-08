import crypto from 'node:crypto';
import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import { setTimeout as sleep } from 'node:timers/promises';

export interface ProvisionAccount{
    fullName: string;
    email: string;
    password: string;
    teamName: string;
    clusterName: string;
}

export interface BootstrapProps{
    appConfig: AppConfig;
    serverOrigin: string;
    account?: ProvisionAccount;
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
}

export default class Bootstrap{
    constructor(private readonly props: BootstrapProps){}

    async ensure(): Promise<BootstrapState>{
        const existing = await this.props.appConfig.getBootstrap();
        if(existing){
            try{
                const authToken = await this.#signIn(existing.email, existing.password);
                const next: BootstrapState = { ...existing, authToken };
                await this.props.appConfig.setBootstrap(next);
                return next;
            }catch(err){
                bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] re-signIn failed (${(err as Error).message}); running full bootstrap` });
                await this.props.appConfig.clearBootstrap();
            }
        }

        return this.#fullBootstrap();
    }

    async #fullBootstrap(): Promise<BootstrapState>{
        const acc = this.props.account;
        const email = acc?.email ?? `local-${crypto.randomBytes(4).toString('hex')}@volt.local`;
        const password = acc?.password ?? crypto.randomBytes(24).toString('base64url');
        const [firstName, ...rest] = (acc?.fullName ?? 'Local').trim().split(/\s+/);

        bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] creating user ${email}` });
        const auth = await this.#signUp(email, password, firstName, rest.join(' '));

        bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] creating team' });
        const team = await this.#createTeam(auth.token, acc?.teamName ?? 'Local');

        bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] creating cluster' });
        const cluster = await this.#createCluster(auth.token, team._id, acc?.clusterName ?? 'Local Cluster');

        bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] revealing daemon credentials' });
        const daemonPassword = await this.#revealDaemonPassword(auth.token, team._id, cluster.teamCluster._id, password);

        const state: BootstrapState = {
            done: true,
            email,
            password,
            userId: auth.user._id,
            teamId: team._id,
            teamClusterId: cluster.teamCluster._id,
            authToken: auth.token,
            daemonPassword
        };

        await this.props.appConfig.setBootstrap(state);
        return state;
    }

    async #signUp(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse>{
        return this.#postJson<AuthResponse>('/api/auth/users', {
            email,
            firstName: firstName || 'Local',
            lastName,
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

        const attempts = 5;
        let lastErr: unknown;

        for(let i = 0; i < attempts; i++){
            let res: Response;
            let text: string;
            try{
                res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                    signal: AbortSignal.timeout(10_000)
                });
                text = await res.text();
            }catch(err){
                lastErr = err;
                if(i < attempts - 1){
                    await sleep(1000);
                    continue;
                }
                throw err;
            }

            let parsed: any;
            try{ parsed = text ? JSON.parse(text) : null; }catch{ parsed = null; }

            if(!res.ok){
                const code = parsed?.code ?? parsed?.status ?? '';
                const msg = parsed?.message ?? text ?? `HTTP ${res.status}`;
                throw new Error(`${path} → ${res.status} ${code} ${msg}`);
            }

            return (parsed?.data ?? parsed) as T;
        }

        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
};
