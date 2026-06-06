import path from 'path';
import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import Stack from '@/services/Stack';
import Bootstrap from '@/services/Bootstrap';
import bus from '@/services/EventBus';

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    props: DeployProps;

    constructor(props: DeployProps){
        this.props = props;
    }

    async start(){
        bus.emit('deploy:state', { state: 'starting' });
        try{
            const sources = await this.#ensureSources();
            const baseEnv = await this.#composeEnv(sources);
            const stack = new Stack({ composeFile: this.props.composeFile, env: baseEnv });

            await stack.up();

            const serverPort = baseEnv.SERVER_PORT ?? '8100';
            const serverOrigin = `http://localhost:${serverPort}`;
            await waitForUrl(`${serverOrigin}/api/auth/emails/probe%40volt.local/availability`);

            const bootstrap = new Bootstrap({ appConfig: this.props.appConfig, serverOrigin });
            const state = await bootstrap.ensure();

            const daemonEnv = {
                ...baseEnv,
                TEAM_CLUSTER_ID: state.teamClusterId,
                TEAM_CLUSTER_ENROLLMENT_TOKEN: state.enrollmentToken
            };
            await new Stack({ composeFile: this.props.composeFile, env: daemonEnv }).up(['enrolled']);

            // El resolver de nginx puede cachear una IP vieja de volt-server hasta 30s
            // tras un recreate. Esperamos a que el proxy entero responda 200 antes
            // de avisar al renderer; si no, la SPA pega /api/auth/me, recibe 502
            // y nos manda a /auth/sign-in.
            const webPort = baseEnv.WEB_PORT ?? '5273';
            await waitForUrl(`http://localhost:${webPort}/api/auth/emails/probe%40volt.local/availability`);

            bus.emit('deploy:state', { state: 'up' });
        }catch(err: any){
            bus.emit('deploy:state', { state: 'error', message: err?.message ?? String(err) });
            throw err;
        }
    }

    async stop(){
        bus.emit('deploy:state', { state: 'stopping' });
        try{
            const sources = await this.#resolveExistingSources();
            const env = await this.#composeEnv(sources);
            const bootstrap = await this.props.appConfig.getBootstrap();
            const downEnv = bootstrap ? {
                ...env,
                TEAM_CLUSTER_ID: bootstrap.teamClusterId,
                TEAM_CLUSTER_ENROLLMENT_TOKEN: bootstrap.enrollmentToken
            } : env;
            await new Stack({ composeFile: this.props.composeFile, env: downEnv }).down(['enrolled']);
            bus.emit('deploy:state', { state: 'down' });
        }catch(err: any){
            bus.emit('deploy:state', { state: 'error', message: err?.message ?? String(err) });
            throw err;
        }
    }

    async #ensureSources(): Promise<Record<string, string>>{
        const sources: Record<string, string> = {};

        for(const { repo, envKey } of this.props.repos){
            const repoId = repo.getId();
            const updater = new SoftwareUpdater({ repoId, downloadDir: this.props.downloadDir });

            const latest = await repo.fetchLatestRelease();
            const installed = await this.props.appConfig.checkInstalledRelease(repoId);

            if(latest.tag !== installed){
                sources[envKey] = await updater.update(latest);
                await this.props.appConfig.updateRelease(repoId, latest.tag);
            }else{
                sources[envKey] = await updater.resolveExtractedPath();
            }
        }

        return sources;
    }

    async #resolveExistingSources(): Promise<Record<string, string>>{
        const sources: Record<string, string> = {};
        for(const { repo, envKey } of this.props.repos){
            const updater = new SoftwareUpdater({ repoId: repo.getId(), downloadDir: this.props.downloadDir });
            sources[envKey] = await updater.resolveExtractedPath();
        }
        return sources;
    }

    async #composeEnv(sources: Record<string, string>): Promise<Record<string, string>>{
        const userEnv = await this.props.appConfig.getStackEnv();
        const resolvedSources: Record<string, string> = {};
        for(const key of Object.keys(sources)){
            resolvedSources[key] = path.resolve(sources[key]);
        }
        return { ...userEnv, ...resolvedSources };
    }
};
