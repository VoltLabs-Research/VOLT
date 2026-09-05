import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import { LOCAL_DEFAULTS } from '@/services/localDefaults';
import ServerApi, { HttpError } from '@/services/ServerApi';
import { authRoutes } from '@volt/contracts/modules/auth/routes';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';
import { teamRoutes } from '@volt/contracts/modules/team/routes';

export interface ProvisionAccount{
    fullName: string;
    email: string;
    password: string;
    teamName: string;
    clusterName: string;
    autoJoinNewUsers?: boolean;
}

interface BootstrapProps{
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

const CLUSTER_CREDENTIALS_UNREADABLE = 'TeamCluster::CredentialsUnreadable';

export default class Bootstrap{
    readonly #api: ServerApi;

    constructor(private readonly props: BootstrapProps){
        this.#api = new ServerApi(props.serverOrigin);
    }

    async ensure(): Promise<BootstrapState>{
        const existing = await this.props.appConfig.getBootstrap();
        if(existing){
            try{
                const session = await this.#acquireSession(existing.email, existing.password);
                const next: BootstrapState = {
                    ...existing,
                    authToken: session.token
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
                auth = await this.#acquireSession(email, password);
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

    async #acquireSession(email: string, password: string): Promise<AuthResponse>{
        if(email === LOCAL_DEFAULTS.email){
            try{
                return await this.#api.request<AuthResponse>(authRoutes.localSignIn, {});
            }catch(err){
                if(!(err instanceof HttpError) || err.status !== 404) throw err;
            }
        }

        return this.#api.request<AuthResponse>(authRoutes.signIn, {
            body: {
                email,
                password
            }
        });
    }

    async #findOrCreateTeam(token: string, name: string): Promise<TeamResponse>{
        const teams = await this.#api.request<TeamResponse[]>(teamRoutes.listUserTeams, { token });
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
        const clusters = await this.#api.request<Array<{ _id: string }>>(teamClusterRoutes.list, {
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
        return this.#api.request<AuthResponse>(authRoutes.signUp, {
            body: {
                email,
                firstName: firstName || 'Local',
                lastName,
                password
            }
        });
    }

    async #createTeam(token: string, name: string): Promise<TeamResponse>{
        return this.#api.request<TeamResponse>(teamRoutes.create, {
            body: {
                name,
                description: ''
            },
            token
        });
    }

    async #setDefaultTeamForNewUsers(token: string, teamId: string): Promise<void>{
        await this.#api.request<unknown>(teamRoutes.setDefaultForNewUsers, {
            params: { teamId },
            body: { enabled: true },
            token
        });
    }

    async #createCluster(token: string, teamId: string, name: string): Promise<TeamClusterResponse>{
        return this.#api.request<TeamClusterResponse>(teamClusterRoutes.create, {
            params: { teamId },
            body: { name },
            token
        });
    }

    async #revealDaemonPassword(token: string, teamId: string, teamClusterId: string, password: string): Promise<string>{
        const data = await this.#api.request<{ services?: { daemon?: { password?: string } } }>(
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
};
