import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import { LOCAL_DEFAULTS } from '@/services/localDefaults';
import { setTimeout as sleep } from 'node:timers/promises';
import { authRoutes } from '@volt/contracts/modules/auth/routes';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';
import { teamRoutes } from '@volt/contracts/modules/team/routes';
import { buildPath } from '@volt/contracts/shared/routing';
import type { Endpoint, HttpMethod } from '@volt/contracts/shared/routing';

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

class HttpError extends Error{
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ){
        super(message);
    }
}

interface RequestOptions{
    params?: Record<string, string>;
    body?: object;
    token?: string;
    /** Attempts for transport-level failures; the server may still be starting. */
    attempts?: number;
}

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Server code for "the stored cluster credentials cannot be decrypted with the
 * current key". Recoverable by provisioning a new cluster.
 */
const CLUSTER_CREDENTIALS_UNREADABLE = 'TeamCluster::CredentialsUnreadable';

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

/** Unwraps the `{ data }` envelope the API uses, tolerating a bare body. */
const readData = (payload: unknown): unknown => {
    if(typeof payload !== 'object' || payload === null) return payload;
    return 'data' in payload ? (payload as { data: unknown }).data : payload;
};

export default class Bootstrap{
    constructor(private readonly props: BootstrapProps){}

    async ensure(): Promise<BootstrapState>{
        const existing = await this.props.appConfig.getBootstrap();
        if(existing){
            try{
                const authToken = await this.#signIn(existing.email, existing.password);
                const next: BootstrapState = {
                    ...existing,
                    authToken
                };
                await this.props.appConfig.setBootstrap(next);
                return next;
            }catch(err){
                bus.emit('deploy:log', {
                    stream: 'stdout',
                    line: `[bootstrap] re-signIn failed (${(err as Error).message}); running full bootstrap`
                });
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

        let auth: AuthResponse;
        let reused = false;
        try{
            bus.emit('deploy:log', {
                stream: 'stdout',
                line: `[bootstrap] creating user ${email}`
            });
            auth = await this.#signUp(email, password, firstName, rest.join(' '));
        }catch(err){
            if(err instanceof HttpError && err.status === 409){                bus.emit('deploy:log', {
                    stream: 'stdout',
                    line: `[bootstrap] user ${email} exists; signing in`
                });
                const token = await this.#signIn(email, password);
                auth = {
                    token,
                    user: await this.#me(token)
                };
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
            bus.emit('deploy:log', {
                stream: 'stdout',
                line: '[bootstrap] enabling auto-join for new users'
            });
            await this.#setDefaultTeamForNewUsers(auth.token, team._id);
        }

        const clusterName = acc?.clusterName ?? LOCAL_DEFAULTS.clusterName;
        const cluster = reused
            ? await this.#findOrCreateCluster(auth.token, team._id, clusterName)
            : await this.#createCluster(auth.token, team._id, clusterName);

        bus.emit('deploy:log', {
            stream: 'stdout',
            line: '[bootstrap] revealing daemon credentials'
        });
        const { teamClusterId, daemonPassword } = await this.#resolveDaemonCredentials(
            auth.token,
            team._id,
            cluster.teamCluster._id,
            password,
            clusterName
        );

        const state: BootstrapState = {
            done: true,
            email,
            password,
            userId: auth.user._id,
            teamId: team._id,
            teamClusterId,
            authToken: auth.token,
            daemonPassword
        };

        await this.props.appConfig.setBootstrap(state);
        return state;
    }

    /**
     * Reveals the daemon password, provisioning a replacement cluster when the one
     * being reused cannot be read.
     *
     * A cluster row outlives the encryption key it was written with whenever the
     * database volume survives a regenerated `SSH_KEY`, and the cloud then cannot
     * decrypt its stored credentials. Reusing such a cluster used to fail the whole
     * deploy at "Provision workspace" with a 500; a fresh cluster is the recovery,
     * so the launch completes without the user having to do anything.
     */
    async #resolveDaemonCredentials(
        token: string,
        teamId: string,
        teamClusterId: string,
        password: string,
        clusterName: string
    ): Promise<{ teamClusterId: string; daemonPassword: string }>{
        try{
            return {
                teamClusterId,
                daemonPassword: await this.#revealDaemonPassword(token, teamId, teamClusterId, password)
            };
        }catch(err){
            if(!(err instanceof HttpError) || err.code !== CLUSTER_CREDENTIALS_UNREADABLE){
                throw err;
            }

            bus.emit('deploy:log', {
                stream: 'stderr',
                line: `[bootstrap] cluster ${teamClusterId} was encrypted with a key this stack no longer has; provisioning a replacement`
            });

            const replacement = await this.#createCluster(token, teamId, `${clusterName} (${new Date().toISOString().slice(0, 10)})`);
            const replacementId = replacement.teamCluster._id;

            return {
                teamClusterId: replacementId,
                daemonPassword: await this.#revealDaemonPassword(token, teamId, replacementId, password)
            };
        }
    }

    async #me(token: string): Promise<{ _id: string }>{
        return this.#request<{ _id: string }>(authRoutes.getMyAccount, { token });
    }

    async #findOrCreateTeam(token: string, name: string): Promise<TeamResponse>{
        const teams = await this.#request<TeamResponse[]>(teamRoutes.listUserTeams, { token });
        const existing = teams[0];
        if(existing){
            bus.emit('deploy:log', {
                stream: 'stdout',
                line: `[bootstrap] reusing team ${existing._id}`
            });
            return existing;
        }
        bus.emit('deploy:log', {
            stream: 'stdout',
            line: '[bootstrap] creating team'
        });
        return this.#createTeam(token, name);
    }

    async #findOrCreateCluster(token: string, teamId: string, name: string): Promise<TeamClusterResponse>{
        const clusters = await this.#request<Array<{ _id: string }>>(teamClusterRoutes.list, {
            params: { teamId },
            token
        });
        const existing = clusters[0];
        if(existing){
            bus.emit('deploy:log', {
                stream: 'stdout',
                line: `[bootstrap] reusing cluster ${existing._id}`
            });
            return { teamCluster: existing };
        }
        bus.emit('deploy:log', {
            stream: 'stdout',
            line: '[bootstrap] creating cluster'
        });
        return this.#createCluster(token, teamId, name);
    }

    async #signUp(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse>{
        return this.#request<AuthResponse>(authRoutes.signUp, {
            body: {
                email,
                firstName: firstName || 'Local',
                lastName,
                password
            }
        });
    }

    async #signIn(email: string, password: string): Promise<string>{
        const data = await this.#request<AuthResponse>(authRoutes.signIn, {
            body: {
                email,
                password
            }
        });
        return data.token;
    }

    async #createTeam(token: string, name: string): Promise<TeamResponse>{
        return this.#request<TeamResponse>(teamRoutes.create, {
            body: {
                name,
                description: ''
            },
            token
        });
    }

    async #setDefaultTeamForNewUsers(token: string, teamId: string): Promise<void>{
        await this.#request<unknown>(teamRoutes.setDefaultForNewUsers, {
            params: { teamId },
            body: { enabled: true },
            token
        });
    }

    async #createCluster(token: string, teamId: string, name: string): Promise<TeamClusterResponse>{
        return this.#request<TeamClusterResponse>(teamClusterRoutes.create, {
            params: { teamId },
            body: { name },
            token
        });
    }

    async #revealDaemonPassword(token: string, teamId: string, teamClusterId: string, password: string): Promise<string>{
        const data = await this.#request<{ services?: { daemon?: { password?: string } } }>(
            teamClusterRoutes.revealCredentials,
            {
                params: {
                    teamId,
                    teamClusterId
                },
                body: { password },
                token
            }
        );

        const daemonPassword = data.services?.daemon?.password;
        if(!daemonPassword) throw new Error('reveal-credentials returned no daemon password');
        return daemonPassword;
    }

    /**
     * Single request path for the bootstrap flow. Method and path come from
     * `@volt/contracts`, so a route change on the server surfaces here as a
     * compile error instead of a 404 at first launch.
     */
    async #request<T>(
        endpoint: Endpoint<never, unknown> | Endpoint<unknown, unknown>,
        options: RequestOptions = {}
    ): Promise<T>{
        const path = buildPath(endpoint, options.params);
        const url = `${this.props.serverOrigin}${path}`;
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
                    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
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
                // A non-JSON body is still usable as an error message below.
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
