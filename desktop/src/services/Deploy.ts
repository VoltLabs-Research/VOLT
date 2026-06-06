import AppConfig, { DevModeState } from '@/services/AppConfig';
import SourceResolver from '@/services/SourceResolver';
import Stack from '@/services/Stack';
import Bootstrap from '@/services/Bootstrap';
import ProcessRunner from '@/services/ProcessRunner';
import { assertDevPaths } from '@/services/devPaths';
import bus from '@/services/EventBus';
import { AppEvents, PhaseSpec } from '@/types/events';
import pWaitFor from 'p-wait-for';

export interface DeployProps{
    composeFile: string;
    appConfig: AppConfig;
    sources: SourceResolver;
}

type DeployState = AppEvents['deploy:state']['state'];

const isUp = async (url: string) => {
    try{
        const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
        return res.ok || res.status === 404;
    }catch{
        return false;
    }
};

const waitForUrl = (url: string, timeout = 120_000) =>
    pWaitFor(() => isUp(url), { interval: 500, timeout });

const errMessage = (err: unknown) => (err as any)?.message ?? String(err);

const START_PHASES: PhaseSpec[] = [
    { id: 'sources', label: 'Resolve sources' },
    { id: 'build', label: 'Build & start services' },
    { id: 'server', label: 'Wait for API server' },
    { id: 'bootstrap', label: 'Provision workspace' },
    { id: 'daemon', label: 'Start cluster daemon' },
    { id: 'web', label: 'Wait for web app' }
];

const STOP_PHASES: PhaseSpec[] = [
    { id: 'down', label: 'Stop services' }
];

export default class Deploy{
    #tail: Promise<unknown> = Promise.resolve();

    constructor(private readonly props: DeployProps){}

    #serialize<T>(fn: () => Promise<T>): Promise<T>{
        const result = this.#tail.then(fn, fn);
        this.#tail = result.catch(() => {});
        return result;
    }

    start(){
        return this.#serialize(() => this.#stage('starting', 'up', () => this.#startCore()));
    }

    async #startCore(){
        const env = await this.props.appConfig.getStackEnv();
        const serverOrigin = `http://localhost:${env.SERVER_PORT}`;
        const webProbe = `http://localhost:${env.WEB_PORT}/api/auth/emails/probe%40volt.local/availability`;

        bus.emit('deploy:phases', { phases: START_PHASES });

        if(await isUp(webProbe)){
            for(const phase of START_PHASES) bus.emit('deploy:phase', { id: phase.id, status: 'done' });
            return;
        }

        const { env: sources, changed } = await this.#phase('sources', () => this.props.sources.resolve());
        const baseEnv = await this.#composeEnv(sources);

        await this.#phase('build', () =>
            new Stack({ composeFile: this.props.composeFile, env: baseEnv }).up([], changed));

        await this.#phase('server', () =>
            waitForUrl(`${serverOrigin}/api/auth/emails/probe%40volt.local/availability`));

        const state = await this.#phase('bootstrap', () =>
            new Bootstrap({ appConfig: this.props.appConfig, serverOrigin }).ensure());

        const daemonEnv = this.#withDaemonEnv(baseEnv, state);
        await this.#phase('daemon', () =>
            new Stack({ composeFile: this.props.composeFile, env: daemonEnv }).up(['enrolled'], changed));

        await this.#phase('web', () => waitForUrl(webProbe));
    }

    stop(){
        return this.#serialize(() => this.#stage('stopping', 'down', () => this.#teardown(false)));
    }

    resetAndRedeploy(){
        return this.#serialize(async () => {
            await this.#stage('stopping', 'down', () => this.#teardown(true));

            try{
                await this.props.appConfig.clearBootstrap();
            }catch(err){
                this.#fail(err);
                throw err;
            }

            await this.#stage('starting', 'up', () => this.#startCore());
        });
    }

    async #teardown(volumes: boolean){
        bus.emit('deploy:phases', { phases: STOP_PHASES });
        await this.#phase('down', async () => {
            let sources: Record<string, string> = {};
            try{ sources = await this.props.sources.resolveExisting(); }catch{}

            const env = await this.#composeEnv(sources);
            const bootstrap = await this.props.appConfig.getBootstrap();
            const downEnv = bootstrap ? this.#withDaemonEnv(env, bootstrap) : env;
            await new Stack({ composeFile: this.props.composeFile, env: downEnv }).down(['enrolled'], volumes);
        });
    }

    async resetDepsVolumes(){
        await new ProcessRunner().run('docker', [
            'volume', 'rm', '-f',
            'volt_volt-server-node-modules',
            'volt_cluster-daemon-node-modules'
        ]).catch(() => {});
    }

    async applyDevMode(payload: DevModeState){
        let changed: boolean;
        try{
            if(payload.enabled) assertDevPaths(payload.voltPath, payload.clusterDaemonPath);
            changed = this.#sourcesChanged(await this.props.appConfig.getPersistedDevMode(), payload);
        }catch(err){
            this.#fail(err);
            throw err;
        }

        return this.#serialize(async () => {
            if(changed){
                await this.#stage('stopping', 'down', () => this.#teardown(false));
                await this.resetDepsVolumes();
            }

            try{
                await this.props.appConfig.setDevMode(payload);
            }catch(err){
                this.#fail(err);
                throw err;
            }

            await this.#stage('starting', 'up', () => this.#startCore());
        });
    }

    #sourcesChanged(prev: Partial<DevModeState> | undefined, next: DevModeState){
        return prev?.enabled !== next.enabled
            || prev?.voltPath !== next.voltPath
            || prev?.clusterDaemonPath !== next.clusterDaemonPath;
    }

    #fail(err: unknown){
        bus.emit('deploy:state', { state: 'error', message: errMessage(err) });
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
        bus.emit('deploy:phase', { id, status: 'running' });
        try{
            const result = await fn();
            bus.emit('deploy:phase', { id, status: 'done' });
            return result;
        }catch(err){
            bus.emit('deploy:phase', { id, status: 'error', detail: errMessage(err) });
            throw err;
        }
    }

    #withDaemonEnv(base: Record<string, string>, src: { teamClusterId: string; daemonPassword: string }): Record<string, string>{
        return {
            ...base,
            TEAM_CLUSTER_ID: src.teamClusterId,
            DAEMON_PASS: src.daemonPassword
        };
    }

    async #composeEnv(sources: Record<string, string>): Promise<Record<string, string>>{
        const userEnv = await this.props.appConfig.getStackEnv();
        return { ...userEnv, ...sources };
    }
};
