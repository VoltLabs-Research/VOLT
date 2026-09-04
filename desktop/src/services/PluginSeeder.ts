import AppConfig, { BootstrapState } from '@/services/AppConfig';
import bus from '@/services/EventBus';
import type ServerApi from '@/services/ServerApi';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';

export const DEFAULT_PLUGINS = [
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
    '@voltlabs/multisom'
] as const;

interface PluginSeederProps{
    appConfig: AppConfig;
    api: ServerApi;
}

interface PluginPage{
    data?: unknown[];
    total?: number;
}

const INSTALL_CONCURRENCY = 3;
const INSTALL_TIMEOUT_MS = 180_000;

const log = (stream: 'stdout' | 'stderr', line: string) => bus.emit('deploy:log', {
    stream,
    line: `[plugins] ${line}`
});

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

    async ensure(state: BootstrapState): Promise<void>{
        const seed = await this.props.appConfig.getPluginSeed();
        if(seed?.done && seed.teamId === state.teamId) return;

        const installedBefore = await this.#installedCount(state);
        if(installedBefore > 0 && !seed){
            log('stdout', `workspace already has ${installedBefore} plugin(s); skipping the default set`);
            await this.props.appConfig.setPluginSeed({
                done: true,
                teamId: state.teamId,
                installed: []
            });
            return;
        }

        const installed = new Set(seed?.teamId === state.teamId ? seed.installed : []);
        const pending = DEFAULT_PLUGINS.filter((name) => !installed.has(name));
        const failures: string[] = [];
        let finished = 0;

        log('stdout', `installing ${pending.length} default plugin(s) from the registry`);

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
                log('stdout', `${name} installed (${finished}/${pending.length})`);
                await this.props.appConfig.setPluginSeed({
                    done: false,
                    teamId: state.teamId,
                    installed: [...installed]
                });
            }catch(err){
                failures.push(name);
                log('stderr', `${name} failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        });

        await this.props.appConfig.setPluginSeed({
            done: failures.length === 0,
            teamId: state.teamId,
            installed: [...installed]
        });

        if(failures.length > 0){
            log('stderr', `${failures.length} plugin(s) could not be installed; they will be retried next start`);
        }
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
