import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import { setTimeout as sleep } from 'node:timers/promises';

// Local desktop is single-tenant — one fixed user, nobody else connects. These
// deterministic defaults make the account stable across restarts: even if the DB
// is reset or app-config.json is lost, the next bootstrap re-creates (or signs
// back into) the SAME user/team/cluster instead of minting a fresh random one.
const LOCAL_DEFAULTS = {
    fullName: 'Local',
    email: 'local@volt.local',
    password: 'volt-local-desktop', // ≥8 chars (server password policy)
    teamName: 'Local',
    clusterName: 'Local Cluster'
} as const;

export interface ProvisionAccount{
    fullName: string;
    email: string;
    password: string;
    teamName: string;
    clusterName: string;
    autoJoinNewUsers?: boolean;
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

// HTTP error that preserves the status code so callers can branch on it (e.g.
// treat a 409 "email already registered" as "fall back to sign-in").
class HttpError extends Error{
    constructor(public readonly status: number, message: string){
        super(message);
    }
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
        const email = acc?.email ?? LOCAL_DEFAULTS.email;
        const password = acc?.password ?? LOCAL_DEFAULTS.password;
        const [firstName, ...rest] = (acc?.fullName ?? LOCAL_DEFAULTS.fullName).trim().split(/\s+/);

        // Idempotent: the user may already exist (DB kept but app-config.json was
        // lost). Try to create it; on 409 (email already registered) sign in and
        // reuse the existing team/cluster instead of failing or duplicating.
        let auth: AuthResponse;
        let reused = false;
        try{
            bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] creating user ${email}` });
            auth = await this.#signUp(email, password, firstName, rest.join(' '));
        }catch(err){
            if(err instanceof HttpError && err.status === 409){
                bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] user ${email} exists; signing in` });
                const token = await this.#signIn(email, password);
                auth = { token, user: await this.#me(token) };
                reused = true;
            }else{
                throw err;
            }
        }

        const teamName = acc?.teamName ?? LOCAL_DEFAULTS.teamName;
        const team = reused
            ? await this.#findOrCreateTeam(auth.token, teamName)
            : await this.#createTeam(auth.token, teamName);

        if(acc?.autoJoinNewUsers){
            bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] enabling auto-join for new users' });
            await this.#setDefaultTeamForNewUsers(auth.token, team._id);
        }

        const clusterName = acc?.clusterName ?? LOCAL_DEFAULTS.clusterName;
        const cluster = reused
            ? await this.#findOrCreateCluster(auth.token, team._id, clusterName)
            : await this.#createCluster(auth.token, team._id, clusterName);

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

    async #me(token: string): Promise<{ _id: string }>{
        return this.#getJson<{ _id: string }>('/api/auth/me', token);
    }

    async #findOrCreateTeam(token: string, name: string): Promise<TeamResponse>{
        const teams = await this.#getJson<TeamResponse[]>('/api/teams', token);
        const existing = teams?.find((team) => team?._id);
        if(existing){
            bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] reusing team ${existing._id}` });
            return existing;
        }
        bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] creating team' });
        return this.#createTeam(token, name);
    }

    async #findOrCreateCluster(token: string, teamId: string, name: string): Promise<TeamClusterResponse>{
        const clusters = await this.#getJson<Array<{ _id: string }>>(`/api/teams/${teamId}/clusters`, token);
        const existing = clusters?.find((cluster) => cluster?._id);
        if(existing){
            bus.emit('deploy:log', { stream: 'stdout', line: `[bootstrap] reusing cluster ${existing._id}` });
            return { teamCluster: existing };
        }
        bus.emit('deploy:log', { stream: 'stdout', line: '[bootstrap] creating cluster' });
        return this.#createCluster(token, teamId, name);
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

    async #setDefaultTeamForNewUsers(token: string, teamId: string): Promise<void>{
        await this.#postJson<unknown>(`/api/teams/${teamId}/default-membership`, { enabled: true }, token, 'PUT');
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

    async #postJson<T>(path: string, body: object, token?: string, method: string = 'POST'): Promise<T>{
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
                    method,
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
                throw new HttpError(res.status, `${path} → ${res.status} ${code} ${msg}`);
            }

            return (parsed?.data ?? parsed) as T;
        }

        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }

    async #getJson<T>(path: string, token: string): Promise<T>{
        const res = await fetch(`${this.props.serverOrigin}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000)
        });
        const text = await res.text();
        let parsed: any;
        try{ parsed = text ? JSON.parse(text) : null; }catch{ parsed = null; }
        if(!res.ok){
            const msg = parsed?.message ?? text ?? `HTTP ${res.status}`;
            throw new HttpError(res.status, `${path} → ${res.status} ${msg}`);
        }
        return (parsed?.data ?? parsed) as T;
    }
};
