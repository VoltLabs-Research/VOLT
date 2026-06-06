import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import Stack from '@/services/Stack';
import Bootstrap from '@/services/Bootstrap';
import ProcessRunner from '@/services/ProcessRunner';
import { assertDevPaths } from '@/services/devPaths';
import bus, { AppEvents } from '@/services/EventBus';
import pWaitFor from 'p-wait-for';

export interface DeployRepoSpec{
    repo: Repository;
    envKey: 'VOLT_SOURCE_DIR' | 'CLUSTER_DAEMON_SOURCE_DIR';
}

export interface DeployProps{
    composeFile: string;
    appConfig: AppConfig;
    repos: DeployRepoSpec[];
    downloadDir: string;
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

interface PhaseSpec{
    id: string;
    label: string;
}

// Ordered, Vercel-style step lists the renderer renders as the deploy advances.
// Labels live here so the backend stays the single source of truth for the timeline.
const START_PHASES: PhaseSpec[] = [
    { id: 'sources',   label: 'Resolve sources' },
    { id: 'build',     label: 'Build & start services' },
    { id: 'server',    label: 'Wait for API server' },
    { id: 'bootstrap', label: 'Provision workspace' },
    { id: 'daemon',    label: 'Start cluster daemon' },
    { id: 'web',       label: 'Wait for web app' }
];

const STOP_PHASES: PhaseSpec[] = [
    { id: 'down', label: 'Stop services' }
];

export default class Deploy{
    // Serializes every deploy operation: the renderer auto-starts on mount while
    // the gear menu can fire a stop()+start() at any moment, and two concurrent
    // `docker compose up/down` on the same project would race. Chaining through a
    // single promise guarantees start()/stop() never overlap.
    #queue: Promise<unknown> = Promise.resolve();

    constructor(private readonly props: DeployProps){}

    #enqueue<T>(fn: () => Promise<T>): Promise<T>{
        const run = this.#queue.then(fn, fn); // run after the prior op settles, success or failure
        this.#queue = run.catch(() => {});    // a rejection must not break the chain
        return run;
    }

    start(){
        return this.#enqueue(() => this.#runStage('starting', 'up', async () => {
            const env = await this.props.appConfig.getStackEnv();
            const serverOrigin = `http://localhost:${env.SERVER_PORT}`;
            const webProbe = `http://localhost:${env.WEB_PORT}/api/auth/emails/probe%40volt.local/availability`;

            this.#announce(START_PHASES);

            // `up --build` is idempotent: when nothing changed it's a cheap no-op, and
            // when sources changed (new release or a dev checkout edit) it rebuilds the
            // images and recreates the containers. So we always bring the stack up
            // rather than probing for a reusable live stack — same path for release and
            // dev mode.
            const sources = await this.#phase('sources', () => this.#ensureSources());
            const baseEnv = await this.#composeEnv(sources);

            await this.#phase('build', () =>
                new Stack({ composeFile: this.props.composeFile, env: baseEnv }).up());

            await this.#phase('server', () =>
                waitForUrl(`${serverOrigin}/api/auth/emails/probe%40volt.local/availability`));

            const state = await this.#phase('bootstrap', () =>
                new Bootstrap({ appConfig: this.props.appConfig, serverOrigin }).ensure());

            const daemonEnv = this.#withDaemonEnv(baseEnv, state);
            await this.#phase('daemon', () =>
                new Stack({ composeFile: this.props.composeFile, env: daemonEnv }).up(['enrolled']));

            // nginx's resolver can cache a stale volt-server IP for up to 30s after a
            // recreate. Wait until the whole proxy answers 200 before signaling the
            // renderer; otherwise the SPA hits /api/auth/me, gets a 502 and bounces
            // to /auth/sign-in.
            await this.#phase('web', () => waitForUrl(webProbe));
        }));
    }

    stop(){
        return this.#enqueue(() => this.#runStage('stopping', 'down', async () => {
            // down() targets containers by project/service label, not build context,
            // so it works even when sources can't be resolved (first run, failed
            // fetch). Don't let a missing-source error abort an otherwise-valid teardown.
            let sources: Record<string, string> = {};
            try{ sources = await this.#resolveExistingSources(); }catch{ /* nothing on disk yet */ }

            const env = await this.#composeEnv(sources);
            const bootstrap = await this.props.appConfig.getBootstrap();
            const downEnv = bootstrap ? this.#withDaemonEnv(env, bootstrap) : env;
            await new Stack({ composeFile: this.props.composeFile, env: downEnv }).down(['enrolled']);
        }));
    }

    // The server/daemon node_modules live in named volumes that compose only seeds
    // from the image on first creation. Switching source checkouts rebuilds the
    // images but the stale volume would shadow /app/node_modules, so a checkout with
    // different deps runs against the wrong ones. Dropping the volumes forces a clean
    // reseed on the next `up`. Best-effort: they may not exist yet, and `down` must
    // have removed the containers first so nothing holds them.
    async resetDepsVolumes(){
        await new ProcessRunner().run('docker', [
            'volume', 'rm', '-f',
            'volt_volt-server-node-modules',
            'volt_cluster-daemon-node-modules'
        ]).catch(() => { /* missing volumes are fine */ });
    }

    async #runStage(startState: DeployState, endState: DeployState, fn: () => Promise<void>){
        bus.emit('deploy:state', { state: startState });
        try{
            await fn();
            bus.emit('deploy:state', { state: endState });
        }catch(err: any){
            bus.emit('deploy:state', { state: 'error', message: err?.message ?? String(err) });
            throw err;
        }
    }

    #withDaemonEnv(base: Record<string, string>, src: { teamClusterId: string; enrollmentToken: string }): Record<string, string>{
        return {
            ...base,
            TEAM_CLUSTER_ID: src.teamClusterId,
            TEAM_CLUSTER_ENROLLMENT_TOKEN: src.enrollmentToken
        };
    }

    // Dev mode points the compose build contexts at the user's local checkouts
    // instead of GitHub releases — no fetch, no extract, no tag tracking. Returns
    // null when dev mode is off so the release path below takes over.
    async #devSources(): Promise<Record<string, string> | null>{
        const dev = await this.props.appConfig.getDevMode();
        if(!dev) return null;
        return {
            VOLT_SOURCE_DIR: dev.voltPath,
            CLUSTER_DAEMON_SOURCE_DIR: dev.clusterDaemonPath
        };
    }

    async #ensureSources(): Promise<Record<string, string>>{
        const dev = await this.#devSources();
        if(dev){
            // Re-validate on every bring-up, not just at apply time — the local
            // checkout may have moved/been deleted since dev mode was enabled. Throws
            // a readable error instead of an opaque `docker compose` build failure.
            assertDevPaths(dev.VOLT_SOURCE_DIR, dev.CLUSTER_DAEMON_SOURCE_DIR);
            return dev;
        }

        return this.#mapSources(async (updater, repo) => {
            const repoId = repo.getId();
            const latest = await repo.fetchLatestRelease();
            const installed = await this.props.appConfig.checkInstalledRelease(repoId);

            if(latest.tag !== installed){
                const sourcePath = await updater.update(latest);
                await this.props.appConfig.updateRelease(repoId, latest.tag);
                return sourcePath;
            }

            return updater.resolveExtractedPath();
        });
    }

    async #resolveExistingSources(): Promise<Record<string, string>>{
        const dev = await this.#devSources();
        if(dev) return dev;

        return this.#mapSources((updater) => updater.resolveExtractedPath());
    }

    async #mapSources(resolve: (updater: SoftwareUpdater, repo: Repository) => Promise<string>): Promise<Record<string, string>>{
        const sources: Record<string, string> = {};
        for(const { repo, envKey } of this.props.repos){
            const updater = new SoftwareUpdater({ repoId: repo.getId(), downloadDir: this.props.downloadDir });
            sources[envKey] = await resolve(updater, repo);
        }
        return sources;
    }

    async #composeEnv(sources: Record<string, string>): Promise<Record<string, string>>{
        const userEnv = await this.props.appConfig.getStackEnv();
        return { ...userEnv, ...sources };
    }
};
