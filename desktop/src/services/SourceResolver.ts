import AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SoftwareUpdater from '@/services/SoftwareUpdater';
import { assertDevPaths } from '@/services/devPaths';

export interface RepoSpec{
    repo: Repository;
    envKey: 'VOLT_SOURCE_DIR' | 'CLUSTER_DAEMON_SOURCE_DIR';
}

export interface SourceResolverProps{
    repos: RepoSpec[];
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

export default class SourceResolver{
    constructor(private readonly props: SourceResolverProps){}

    #updaterFor(repo: Repository){
        return new SoftwareUpdater({
            repoId: repo.getId(),
            downloadDir: this.props.downloadDir
        });
    }

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
        for(const { repo, envKey } of this.props.repos){
            const updater = this.#updaterFor(repo);
            const repoId = repo.getId();
            const latest = await repo.fetchLatestRelease();
            const installed = await this.props.appConfig.getInstalledReleaseTag(repoId);

            if(latest.tag !== installed){
                env[envKey] = await updater.update(latest);
                pending.push([repoId, latest.tag]);
                changed = true;
            }else{
                env[envKey] = await updater.resolveExtractedPath();
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
        for(const { repo } of this.props.repos){
            const repoId = repo.getId();
            const latest = await repo.fetchLatestRelease();
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
        for(const { repo, envKey } of this.props.repos){
            sources[envKey] = await this.#updaterFor(repo).resolveExtractedPath();
        }
        return sources;
    }
};
