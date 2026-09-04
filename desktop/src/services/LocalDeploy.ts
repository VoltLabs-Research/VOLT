import { rm } from 'node:fs/promises';
import AppConfig, { BootstrapState, DevModeState } from '@/services/AppConfig';
import Bootstrap, { ProvisionAccount } from '@/services/Bootstrap';
import bus from '@/services/EventBus';
import LocalStack from '@/services/LocalStack';
import { buildDaemonEnv, buildServerEnv, ensureStackEnvDefaults, serverOriginFor, type StackPorts } from '@/services/LocalStackEnv';
import PluginSeeder from '@/services/PluginSeeder';
import { findFreePort } from '@/services/ports';
import ServerApi from '@/services/ServerApi';
import { resolveStackRuntime, runtimeRootForCheckout, stackRuntimeHint } from '@/services/StackRuntime';
import { AppEvents, PhaseSpec } from '@/types/events';
import { isUp } from '@/shared/health';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { existsSync } from 'node:fs';
import path from 'node:path';

interface LocalDeployPaths{
    runtimeDir: string;
    stackDataDir: string;
    logsDir: string;
}

interface LocalDeployProps{
    appConfig: AppConfig;
    paths: LocalDeployPaths;
    account?: ProvisionAccount;
}

type DeployState = AppEvents['deploy:state']['state'];

interface ClusterView{
    teamCluster?: { status?: string };
    status?: string;
}

const DAEMON_CONNECT_TIMEOUT_MS = 120_000;
const DAEMON_POLL_MS = 1_000;

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

const START_PHASES: PhaseSpec[] = [
    {
        id: 'server',
        label: 'Start API server'
    },
    {
        id: 'bootstrap',
        label: 'Provision workspace'
    },
    {
        id: 'daemon',
        label: 'Start compute daemon'
    },
    {
        id: 'plugins',
        label: 'Install default plugins'
    },
    {
        id: 'web',
        label: 'Open Volt'
    }
];

const STOP_PHASES: PhaseSpec[] = [
    {
        id: 'down',
        label: 'Stop services'
    }
];

export default class LocalDeploy{
    #tail: Promise<unknown> = Promise.resolve();
    #stack: LocalStack | null = null;
    #ports: StackPorts | null = null;

    constructor(private readonly props: LocalDeployProps){}

    #serialize<T>(fn: () => Promise<T>): Promise<T>{
        const result = this.#tail.then(fn, fn);
        this.#tail = result.catch(() => {});
        return result;
    }

    serverOrigin(): string | null{
        return this.#ports && this.#stack?.serverRunning ? serverOriginFor(this.#ports.server) : null;
    }

    async clientUrl(): Promise<string | null>{
        const origin = this.serverOrigin();
        if(!origin) return null;
        const token = (await this.props.appConfig.getBootstrap())?.authToken;
        return token ? `${origin}/__bootstrap.html?token=${encodeURIComponent(token)}` : origin;
    }

    start(){
        return this.#serialize(() => this.#stage('starting', 'up', () => this.#startCore()));
    }

    stop(){
        return this.#serialize(() => this.#stage('stopping', 'down', () => this.#teardown()));
    }

    resetAndRedeploy(){
        return this.#serialize(async () => {
            await this.#stage('stopping', 'down', () => this.#teardown());

            try{
                await rm(this.props.paths.stackDataDir, {
                    recursive: true,
                    force: true
                });
                await this.props.appConfig.clearBootstrap();
                await this.props.appConfig.clearPluginSeed();
            }catch(err){
                this.#fail(err);
                throw err;
            }

            await this.#stage('starting', 'up', () => this.#startCore());
        });
    }

    async applyDevMode(payload: DevModeState){
        let changed: boolean;
        try{
            if(payload.enabled && !existsSync(path.join(runtimeRootForCheckout(payload.voltPath), 'manifest.json'))){
                throw new Error(stackRuntimeHint(runtimeRootForCheckout(payload.voltPath)));
            }
            const previous = await this.props.appConfig.getPersistedDevMode();
            changed = previous?.enabled !== payload.enabled || previous?.voltPath !== payload.voltPath;
        }catch(err){
            this.#fail(err);
            throw err;
        }

        return this.#serialize(async () => {
            if(changed) await this.#stage('stopping', 'down', () => this.#teardown());

            try{
                await this.props.appConfig.setDevMode(payload);
            }catch(err){
                this.#fail(err);
                throw err;
            }

            await this.#stage('starting', 'up', () => this.#startCore());
        });
    }

    async #runtimeRoot(): Promise<string>{
        const dev = await this.props.appConfig.getActiveDevMode();
        return dev ? runtimeRootForCheckout(dev.voltPath) : this.props.paths.runtimeDir;
    }

    async #ensureStack(): Promise<LocalStack>{
        const root = await this.#runtimeRoot();
        if(this.#stack && this.#stack.runtime.root === root) return this.#stack;

        await this.#stack?.stop();
        this.#stack = new LocalStack({
            runtime: await resolveStackRuntime(root),
            logsDir: this.props.paths.logsDir
        });
        return this.#stack;
    }

    async #ensurePorts(stackEnv: Record<string, string>, stack: LocalStack): Promise<StackPorts>{
        if(this.#ports && stack.serverRunning) return this.#ports;

        this.#ports = {
            server: await findFreePort(Number(stackEnv.SERVER_PORT)),
            daemon: await findFreePort(Number(stackEnv.DAEMON_PORT))
        };
        return this.#ports;
    }

    async #startCore(){
        bus.emit('deploy:phases', { phases: START_PHASES });

        const stack = await this.#ensureStack();
        const stackEnv = await ensureStackEnvDefaults(this.props.appConfig);
        const ports = await this.#ensurePorts(stackEnv, stack);
        const origin = serverOriginFor(ports.server);
        const api = new ServerApi(origin);

        bus.emit('deploy:log', {
            stream: 'stdout',
            line: `[stack] runtime ${stack.runtime.root} (server ${stack.runtime.manifest.server.version}, daemon ${stack.runtime.manifest.daemon.version}, node ${stack.runtime.manifest.node})`
        });

        await this.#phase('server', () => stack.startServer(buildServerEnv({
            runtime: stack.runtime,
            stackEnv,
            stackDataDir: this.props.paths.stackDataDir,
            ports
        }), origin));

        const state = await this.#phase('bootstrap', () => new Bootstrap({
            appConfig: this.props.appConfig,
            serverOrigin: origin,
            account: this.props.account
        }).ensure());

        await this.#phase('daemon', async () => {
            await stack.startDaemon(buildDaemonEnv({
                stackEnv,
                stackDataDir: this.props.paths.stackDataDir,
                ports,
                bootstrap: state
            }));
            await this.#waitForCluster(api, state, stack);
        });

        await this.#phase('plugins', () => new PluginSeeder({
            appConfig: this.props.appConfig,
            api
        }).ensure(state));

        await this.#phase('web', async () => {
            if(!await isUp(`${origin}/`)) throw new Error('The web client is not being served by the API server');
        });
    }

    async #waitForCluster(api: ServerApi, state: BootstrapState, stack: LocalStack): Promise<void>{
        const deadline = Date.now() + DAEMON_CONNECT_TIMEOUT_MS;
        let lastStatus = 'unknown';

        while(Date.now() < deadline){
            if(stack.daemonExitedEarly()) throw new Error(`The compute daemon exited during startup. See ${stack.daemonLogFile}`);

            try{
                const view = await api.request<ClusterView>(teamClusterRoutes.getById, {
                    params: {
                        teamId: state.teamId,
                        teamClusterId: state.teamClusterId
                    },
                    token: state.authToken
                });
                lastStatus = view.teamCluster?.status ?? view.status ?? lastStatus;
                if(lastStatus === TeamClusterStatus.Connected) return;
            }catch(err){
                lastStatus = `unreachable (${errMessage(err)})`;
            }

            await sleep(DAEMON_POLL_MS);
        }

        throw new Error(`The compute daemon did not connect within ${DAEMON_CONNECT_TIMEOUT_MS / 1000}s (last status: ${lastStatus}). See ${stack.daemonLogFile}`);
    }

    async #teardown(){
        bus.emit('deploy:phases', { phases: STOP_PHASES });
        await this.#phase('down', async () => {
            await this.#stack?.stop();
        });
    }

    #fail(err: unknown){
        bus.emit('deploy:state', {
            state: 'error',
            message: errMessage(err)
        });
    }

    async #stage(startState: DeployState, endState: DeployState, fn: () => Promise<void>){
        bus.emit('deploy:state', { state: startState });
        try{
            await fn();
            bus.emit('deploy:state', { state: endState });
        }catch(err){
            this.#fail(err);
            throw err;
        }
    }

    async #phase<T>(id: string, fn: () => Promise<T>): Promise<T>{
        bus.emit('deploy:phase', {
            id,
            status: 'running'
        });
        try{
            const result = await fn();
            bus.emit('deploy:phase', {
                id,
                status: 'done'
            });
            return result;
        }catch(err){
            bus.emit('deploy:phase', {
                id,
                status: 'error',
                detail: errMessage(err)
            });
            throw err;
        }
    }
};
