import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import Stack from '@/services/Stack';
import Bootstrap from '@/services/Bootstrap';
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

export default class Deploy{
    constructor(private readonly props: DeployProps){}

    start(){
        return this.#runStage('starting', 'up', async () => {
            const env = await this.props.appConfig.getStackEnv();
            const serverOrigin = `http://localhost:${env.SERVER_PORT}`;
            const webProbe = `http://localhost:${env.WEB_PORT}/api/auth/emails/probe%40volt.local/availability`;

            // Full stack (including the enrolled daemon) already running & healthy —
            // the app was closed without stopping it. Refresh the auth token and hand
            // off to the renderer without re-fetching sources, rebuilding images or
            // recreating containers.
            if(await this.#stackAlreadyHealthy()){
                bus.emit('deploy:log', { stream: 'stdout', line: '[deploy] stack already running, reusing containers' });
                await new Bootstrap({ appConfig: this.props.appConfig, serverOrigin }).ensure();
                return;
            }

            const sources = await this.#ensureSources();
            const baseEnv = await this.#composeEnv(sources);
            await new Stack({ composeFile: this.props.composeFile, env: baseEnv }).up();

            await waitForUrl(`${serverOrigin}/api/auth/emails/probe%40volt.local/availability`);

            const state = await new Bootstrap({ appConfig: this.props.appConfig, serverOrigin }).ensure();

            const daemonEnv = this.#withDaemonEnv(baseEnv, state);
            await new Stack({ composeFile: this.props.composeFile, env: daemonEnv }).up(['enrolled']);

            // nginx's resolver can cache a stale volt-server IP for up to 30s after a
            // recreate. Wait until the whole proxy answers 200 before signaling the
            // renderer; otherwise the SPA hits /api/auth/me, gets a 502 and bounces
            // to /auth/sign-in.
            await waitForUrl(webProbe);
        });
    }

    stop(){
        return this.#runStage('stopping', 'down', async () => {
            const sources = await this.#resolveExistingSources();
            const env = await this.#composeEnv(sources);
            const bootstrap = await this.props.appConfig.getBootstrap();
            const downEnv = bootstrap ? this.#withDaemonEnv(env, bootstrap) : env;
            await new Stack({ composeFile: this.props.composeFile, env: downEnv }).down(['enrolled']);
        });
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

    #ensureSources(): Promise<Record<string, string>>{
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

    #resolveExistingSources(): Promise<Record<string, string>>{
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

    // Authoritative readiness check: every service compose expects for the enrolled
    // profile (incl. cluster-daemon, and the health-checked mongo/redis) must be
    // running and healthy. Any partial/unhealthy state returns false so start() falls
    // through to the full bring-up, which converges whatever is missing.
    async #stackAlreadyHealthy(): Promise<boolean>{
        let env: Record<string, string>;
        try{
            // Resolve already-downloaded sources from disk — no GitHub, no rebuild.
            const sources = await this.#resolveExistingSources();
            env = await this.#composeEnv(sources);
        }catch{
            return false; // sources not downloaded yet (first run)
        }

        const stack = new Stack({ composeFile: this.props.composeFile, env });
        const expected = await stack.services(['enrolled']);
        if(!expected.length) return false;

        const status = await stack.status(['enrolled']);
        const healthy = new Set(
            status
                .filter((s) => s.state === 'running' && (s.health === '' || s.health === 'healthy'))
                .map((s) => s.service)
        );

        return expected.every((service) => healthy.has(service));
    }
};
