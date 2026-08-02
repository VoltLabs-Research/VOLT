import AppConfig from '@/services/AppConfig';
import { fetchLatestRelease } from '@/services/Repository';
import { installRelease, resolveExtractedPath } from '@/services/SoftwareUpdater';
import { assertDevPaths } from '@/services/devPaths';

export interface SourceResolverProps{
    downloadDir: string;
    appConfig: AppConfig;
}

export interface ResolvedSources{
    env: Record<string, string>;
    changed: boolean;
    
    commit: () => Promise<void>;
}

export interface RepoUpdateStatus{
    repoId: string;
    installed: string | null;
    latest: string;
    changed: boolean;
}

const REPOS = [
    {
        owner: 'voltlabs-research',
        repo: 'volt',
        envKey: 'VOLT_SOURCE_DIR'
    },
    {
        owner: 'voltlabs-research',
        repo: 'clusterdaemon',
        envKey: 'CLUSTER_DAEMON_SOURCE_DIR'
    }
] as const;

export default class SourceResolver{
    constructor(private readonly props: SourceResolverProps){}

    async #devSources(): Promise<Record<string, string> | null>{
        const dev = await this.props.appConfig.getActiveDevMode();
        if(!dev) return null;
        return {
            VOLT_SOURCE_DIR: dev.voltPath,
            CLUSTER_DAEMON_SOURCE_DIR: dev.clusterDaemonPath
        };
    }

    async resolve(): Promise<ResolvedSources>{
        const dev = await this.#devSources();
        if(dev){
            assertDevPaths(dev.VOLT_SOURCE_DIR, dev.CLUSTER_DAEMON_SOURCE_DIR);
            return {
                env: dev,
                changed: true,
                commit: async () => {}
            };
        }

        const env: Record<string, string> = {};
        const pending: Array<[string, string]> = [];
        let changed = false;
        for(const { owner, repo, envKey } of REPOS){
            const repoId = `${owner}/${repo}`;
            const latest = await fetchLatestRelease(owner, repo);
            const installed = await this.props.appConfig.getInstalledReleaseTag(repoId);

            if(latest.tag !== installed){
                env[envKey] = await installRelease(this.props.downloadDir, repoId, latest);
                pending.push([repoId, latest.tag]);
                changed = true;
            }else{
                env[envKey] = await resolveExtractedPath(this.props.downloadDir, repoId);
            }
        }

        const commit = async () => {
            for(const [repoId, tag] of pending){
                await this.props.appConfig.updateRelease(repoId, tag);
            }
        };

        return {
            env,
            changed,
            commit
        };
    }

    
    async checkForUpdates(): Promise<{ devMode: boolean; repos: RepoUpdateStatus[] }>{
        const dev = await this.#devSources();
        if(dev) return {
            devMode: true,
            repos: []
        };

        const repos: RepoUpdateStatus[] = [];
        for(const { owner, repo } of REPOS){
            const repoId = `${owner}/${repo}`;
            const latest = await fetchLatestRelease(owner, repo);
            const installed = await this.props.appConfig.getInstalledReleaseTag(repoId);
            repos.push({
                repoId,
                installed,
                latest: latest.tag,
                changed: latest.tag !== installed
            });
        }
        return {
            devMode: false,
            repos
        };
    }

    async resolveExisting(): Promise<Record<string, string>>{
        const dev = await this.#devSources();
        if(dev) return dev;

        const sources: Record<string, string> = {};
        for(const { owner, repo, envKey } of REPOS){
            sources[envKey] = await resolveExtractedPath(this.props.downloadDir, `${owner}/${repo}`);
        }
        return sources;
    }
};
