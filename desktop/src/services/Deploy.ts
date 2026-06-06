import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import Stack from '@/services/Stack';
import Bootstrap from '@/services/Bootstrap';
import bus, { AppEvents } from '@/services/EventBus';
import { sleep } from '@/utils/async';

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

const waitForUrl = async (url: string, timeoutMs = 120_000) => {
    const deadline = Date.now() + timeoutMs;
    while(Date.now() < deadline){
        try{
            const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
            if(res.ok || res.status === 404) return;
        }catch{ /* not ready yet */ }
        await sleep(500);
    }
    throw new Error(`Timeout waiting for ${url}`);
};

export default class Deploy{
    constructor(private readonly props: DeployProps){}

    start(){
        return this.#runStage('starting', 'up', async () => {
            const sources = await this.#ensureSources();
            const baseEnv = await this.#composeEnv(sources);
            const stack = new Stack({ composeFile: this.props.composeFile, env: baseEnv });

            await stack.up();

            const serverOrigin = `http://localhost:${baseEnv.SERVER_PORT}`;
            await waitForUrl(`${serverOrigin}/api/auth/emails/probe%40volt.local/availability`);

            const bootstrap = new Bootstrap({ appConfig: this.props.appConfig, serverOrigin });
            const state = await bootstrap.ensure();

            const daemonEnv = this.#withDaemonEnv(baseEnv, state);
            await new Stack({ composeFile: this.props.composeFile, env: daemonEnv }).up(['enrolled']);

            // El resolver de nginx puede cachear una IP vieja de volt-server hasta 30s
            // tras un recreate. Esperamos a que el proxy entero responda 200 antes
            // de avisar al renderer; si no, la SPA pega /api/auth/me, recibe 502
            // y nos manda a /auth/sign-in.
            await waitForUrl(`http://localhost:${baseEnv.WEB_PORT}/api/auth/emails/probe%40volt.local/availability`);
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
};
