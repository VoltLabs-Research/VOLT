import AppConfig, { DevModeState } from '@/services/AppConfig';
import SourceResolver from '@/services/SourceResolver';
import { composeDown, composePull, composeUp, type ComposeOptions } from '@/services/Stack';
import Bootstrap, { ProvisionAccount } from '@/services/Bootstrap';
import { run } from '@/services/ProcessRunner';
import { ensureDockerReady, PreflightError } from '@/services/DockerPreflight';
import { augmentedPath, dockerPath } from '@/services/DockerBinary';
import { assertDevPaths } from '@/services/devPaths';
import bus from '@/services/EventBus';
import { AppEvents, PhaseSpec } from '@/types/events';
import { isUp, PROBE_PATH, webProbeUrl } from '@/shared/health';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pWaitFor from 'p-wait-for';

/** The prebuilt-image overlay ships next to the compose file it overlays. */
const imagesOverlayFile = (composeFile: string): string =>
    join(dirname(composeFile), 'compose.images.yml');

/** The services `compose.images.yml` replaces with a published image. */
const PREBUILT_SERVICES = ['volt-server', 'volt-client', 'cluster-daemon'];

export interface DeployProps{
    composeFile: string;
    appConfig: AppConfig;
    sources: SourceResolver;
    account?: ProvisionAccount;
    withCluster?: boolean;
}

type DeployState = AppEvents['deploy:state']['state'];

const errMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const waitForUrl = (url: string, timeout = 120_000) =>
    pWaitFor(() => isUp(url), {
        interval: 500,
        timeout
    });

const START_PHASES: PhaseSpec[] = [
    {
        id: 'sources',
        label: 'Resolve sources'
    },
    {
        id: 'build',
        label: 'Build & start services'
    },
    {
        id: 'server',
        label: 'Wait for API server'
    },
    {
        id: 'bootstrap',
        label: 'Provision workspace'
    },
    {
        id: 'daemon',
        label: 'Start cluster daemon'
    },
    {
        id: 'web',
        label: 'Wait for web app'
    }
];

const STOP_PHASES: PhaseSpec[] = [
    {
        id: 'down',
        label: 'Stop services'
    }
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
        /*
         * Provisioning replaces the old "show a download link and give up": the
         * runtime is started, or installed, without leaving the app. Only a state
         * that genuinely needs the user (a reboot, a re-login, a failed install)
         * reaches `PreflightError`.
         */
        const status = await ensureDockerReady((progress) => bus.emit('deploy:preflight', progress));
        bus.emit('deploy:preflight', status);
        if(!status.ok) throw new PreflightError(status);

        const env = await this.props.appConfig.getStackEnv();
        const serverOrigin = `http://localhost:${env.SERVER_PORT ?? '8100'}`;
        const webProbe = webProbeUrl(env);

        bus.emit('deploy:phases', { phases: START_PHASES });

        /*
         * Fast path for an already-running stack — but only when the workspace was
         * actually provisioned. A web app that answers while `bootstrap` is missing
         * is a half-finished deploy: the shell would have no auth token, so it would
         * open the client unauthenticated and the user would land on a login or
         * "connect to a server" screen. Treating that as "done" is what made a failed
         * bootstrap look like a successful launch, so the stack is allowed to skip
         * ahead only if both halves are in place.
         */
        const provisioned = Boolean((await this.props.appConfig.getBootstrap())?.authToken);
        if(provisioned && await isUp(webProbe)){
            for(const phase of START_PHASES) bus.emit('deploy:phase', {
                id: phase.id,
                status: 'done'
            });
            return;
        }

        const { env: sources, changed, commit } = await this.#phase('sources', () => this.props.sources.resolve());
        const baseEnv = await this.#composeEnv(sources);
        const overlay = await this.#resolveImageOverlay(baseEnv);
        const mustBuild = overlay.length === 0 && changed;

        await this.#phase('build', async () =>
            composeUp(await this.#compose(baseEnv, overlay), [], mustBuild));

        await this.#phase('server', () =>
            waitForUrl(`${serverOrigin}${PROBE_PATH}`));

        const state = await this.#phase('bootstrap', () =>
            new Bootstrap({
                appConfig: this.props.appConfig,
                serverOrigin,
                account: this.props.account
            }).ensure());

        if(this.props.withCluster !== false){
            const daemonEnv = this.#withDaemonEnv(baseEnv, state);
            await this.#phase('daemon', async () =>
                composeUp(await this.#compose(daemonEnv, overlay), ['enrolled'], mustBuild));
        }

        await this.#phase('web', () => waitForUrl(webProbe));

        
        
        
        await commit();
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

    update(){
        return this.#serialize(async () => {
            await this.#stage('stopping', 'down', () => this.#teardown(false));
            await this.resetDepsVolumes();
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
            await composeDown(await this.#compose(downEnv), ['enrolled'], volumes);
        });
    }

    async resetDepsVolumes(){
        await run(await dockerPath() ?? 'docker', [
            'volume', 'rm', '-f',
            'volt_volt-server-node-modules',
            'volt_cluster-daemon-node-modules'
        ], { env: { PATH: augmentedPath() } }).catch(() => {});
    }

    async #compose(env: Record<string, string>, overlayFiles: string[] = []): Promise<ComposeOptions>{
        return {
            composeFile: this.props.composeFile,
            overlayFiles,
            env,
            dockerPath: await dockerPath() ?? undefined,
            augmentedPath: augmentedPath()
        };
    }

    /**
     * Decides whether this launch runs from prebuilt images or compiles locally.
     *
     * Dev mode always builds: its whole purpose is to run the developer's working
     * tree. Otherwise the published images are pulled first, and only if that
     * succeeds is the overlay used — a tag that does not exist, or an offline
     * machine, silently falls back to building from source.
     */
    async #resolveImageOverlay(env: Record<string, string>): Promise<string[]>{
        if(await this.props.appConfig.getActiveDevMode()){
            bus.emit('deploy:log', {
                stream: 'stdout',
                line: '[stack] dev mode: building from your working tree'
            });
            return [];
        }

        const overlay = [imagesOverlayFile(this.props.composeFile)];
        if(!existsSync(overlay[0])) return [];

        bus.emit('deploy:log', {
            stream: 'stdout',
            line: '[stack] pulling prebuilt images'
        });

        const pulled = await composePull(
            await this.#compose(env, overlay),
            PREBUILT_SERVICES,
            ['enrolled']
        );
        if(pulled) return overlay;

        bus.emit('deploy:log', {
            stream: 'stderr',
            line: '[stack] prebuilt images unavailable; building from source instead'
        });
        return [];
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
        if(err instanceof PreflightError) return;
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

    #withDaemonEnv(base: Record<string, string>, src: { teamClusterId: string; daemonPassword: string }): Record<string, string>{
        return {
            ...base,
            TEAM_CLUSTER_ID: src.teamClusterId,
            DAEMON_PASS: src.daemonPassword
        };
    }

    async #composeEnv(sources: Record<string, string>): Promise<Record<string, string>>{
        const userEnv = await this.props.appConfig.getStackEnv();
        return {
            ...userEnv,
            ...sources
        };
    }
};
