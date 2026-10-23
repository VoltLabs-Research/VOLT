import type ServerApi from './server-api';
import type { BootstrapState, PluginSeedStore, ProvisioningLog } from './state';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';
import { teamClusterRoutes } from '@volt/contracts/modules/cluster/routes';

const DEFAULT_PLUGINS = [
    '@voltlabs/polyhedral-template-matching',
    '@voltlabs/adaptive-common-neighbor-analysis',
    '@voltlabs/opendxa',
    '@voltlabs/coordination-analysis',
    '@voltlabs/cluster-analysis',
    '@voltlabs/atomic-strain',
    '@voltlabs/elastic-strain',
    '@voltlabs/displacements-analysis',
    '@voltlabs/wigner-seitz-defect-analysis',
    '@voltlabs/voronoi-analysis',
    '@voltlabs/grain-segmentation',
    '@voltlabs/identify-diamond',
    '@voltlabs/ackland-jones',
    '@voltlabs/chill-plus',
    '@voltlabs/pattern-structure-matching',
    '@voltlabs/ilda',
    '@voltlabs/kmeans-clustering',
    '@voltlabs/multisom',
    '@voltlabs/line-reconstruction-dxa',
    '@voltlabs/reference-crystal-matching',
    '@voltlabs/generalized-template-matching'
] as const;

interface PluginSeederProps{
    store: PluginSeedStore;
    api: ServerApi;
    log: ProvisioningLog;
}

interface PluginPage{
    data?: unknown[];
    total?: number;
}

const INSTALL_CONCURRENCY = 3;
const INSTALL_TIMEOUT_MS = 180_000;

const mapLimited = async <T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> => {
    let cursor = 0;
    const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while(cursor < items.length){
            const item = items[cursor++];
            await work(item);
        }
    });
    await Promise.all(lanes);
};

export default class PluginSeeder{
    constructor(private readonly props: PluginSeederProps){}

    #log(stream: 'stdout' | 'stderr', line: string): void{
        this.props.log(stream, `[plugins] ${line}`);
    }

    async ensure(state: BootstrapState): Promise<void>{
        const platform = await this.#clusterPlatform(state);
        const seed = await this.props.store.getPluginSeed();
        if(seed?.done && seed.teamId === state.teamId && seed.platform === platform) return;

        const installedBefore = await this.#installedCount(state);
        if(installedBefore > 0 && !seed){
            this.#log('stdout', `workspace already has ${installedBefore} plugin(s); skipping the default set`);
            await this.props.store.setPluginSeed({
                done: true,
                teamId: state.teamId,
                installed: [],
                platform
            });
            return;
        }

        if(seed?.teamId === state.teamId && seed.platform && seed.platform !== platform){
            this.#log('stdout', `reinstalling default plugins for ${platform} (previously ${seed.platform})`);
            await this.props.store.clearPluginSeed();
        }

        const installed = new Set(seed?.teamId === state.teamId && seed.platform === platform ? seed.installed : []);
        const pending = DEFAULT_PLUGINS.filter((name) => !installed.has(name));
        const failures: string[] = [];
        let finished = 0;

        this.#log('stdout', `installing ${pending.length} default plugin(s) from the registry`);

        await mapLimited(pending, INSTALL_CONCURRENCY, async (name) => {
            try{
                await this.props.api.request(pluginRoutes.installRegistry, {
                    params: { teamId: state.teamId },
                    body: { name },
                    token: state.authToken,
                    attempts: 2,
                    timeoutMs: INSTALL_TIMEOUT_MS
                });
                installed.add(name);
                finished += 1;
                this.#log('stdout', `${name} installed (${finished}/${pending.length})`);
                await this.props.store.setPluginSeed({
                    done: false,
                    teamId: state.teamId,
                    installed: [...installed],
                    platform
                });
            }catch(err){
                failures.push(name);
                this.#log('stderr', `${name} failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        await this.props.store.setPluginSeed({
            done: failures.length === 0,
            teamId: state.teamId,
            installed: [...installed],
            platform
        });

        if(failures.length > 0){
            this.#log('stderr', `${failures.length} plugin(s) could not be installed; they will be retried next start`);
        }
    }

    async #clusterPlatform(state: BootstrapState): Promise<string>{
        const view = await this.props.api.request<{
            teamCluster?: { hostCapabilities?: { platform?: string | null } | null };
        }>(teamClusterRoutes.getById, {
            params: {
                teamId: state.teamId,
                teamClusterId: state.teamClusterId
            },
            token: state.authToken
        });
        const platform = view.teamCluster?.hostCapabilities?.platform;
        if(!platform) throw new Error('The compute daemon has not reported its host platform yet');
        return platform;
    }

    async #installedCount(state: BootstrapState): Promise<number>{
        const page = await this.props.api.request<PluginPage | unknown[]>(pluginRoutes.list, {
            params: { teamId: state.teamId },
            token: state.authToken
        });
        if(Array.isArray(page)) return page.length;
        return page.total ?? page.data?.length ?? 0;
    }
};
