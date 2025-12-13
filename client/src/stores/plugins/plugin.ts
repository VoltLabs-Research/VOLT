import { create } from 'zustand';
import pluginApi, { type IPluginRecord } from '@/services/api/plugin';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { NodeType, PluginStatus } from '@/types/plugin';

interface IModifierData{
    name?: string;
    icon?: string;
    description?: string;
    version?: string;
};

interface IExposureData{
    name?: string;
    results?: string;
};

interface IVisualizersData{
    canvas?: boolean;
    raster?: boolean;
};

interface IExportData{
    exporter?: string;
    type?: string;
    options?: Record<string, any>;
};

export interface RenderableExposure{
    pluginId: string;
    pluginSlug: string;
    analysisId: string;
    exposureId: string;
    name: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: IExportData;
};

export interface ResolvedModifier{
    pluginId: string;
    pluginSlug: string;
    name: string;
    icon?: string;
    description?: string;
    version?: string;
};

export interface PluginArgument{
    argument: string;
    type: 'select' | 'number' | 'boolean' | 'string' | 'frame';
    label: string;
    default?: any;
    value?: any;
    options?: Array<{ key: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
};

type WorkflowNode = IPluginRecord['workflow']['nodes'][number];
type WorkflowEdge = IPluginRecord['workflow']['edges'][number];

type WorkflowIndex = {
    // direct lookup
    nodeById: Map<string, WorkflowNode>;
    // adjacency, sourceId -> [targetId]
    outgoing: Map<string, string[]>;
    // type -> [nodeId]
    nodesByType: Map<NodeType, string[]>;
};

export interface PluginState{
    plugins: IPluginRecord[];
    pluginsBySlug: Record<string, IPluginRecord>;
    loading: boolean;
    error: string | null;

    fetchPlugins: (opts?: { force?: boolean }) => Promise<void>;

    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];
    getRenderableExposures: (
        trajectoryId: string,
        analysisId?: string,
        context?: 'canvas' | 'raster'
    ) => Promise<RenderableExposure[]>;
};

let inFlightFetch: Promise<void> | null = null;

// TTL to avoid refetch spam
const PLUGINS_TTL_MS = 60_000;
let lastFetchAt = 0;

type IndexCacheEntry = {
    key: string;
    index: WorkflowIndex
};

const workflowIndexCache = new Map<string, IndexCacheEntry>();

// Derived list cache for modifiers
let lastModifiersKey = '';
let lastModifiers: ResolvedModifier[] = [];

// TODO: duplicated code
const getErrorMessage = (err: unknown, fallback: string) => {
    const anyErr = err as any;
    return anyErr?.response?.data?.message || anyErr?.message || fallback;
};

const buildWorkflowIndex = (plugin: IPluginRecord): WorkflowIndex => {
    const nodes = plugin.workflow.nodes as WorkflowNode[];
    const edges = plugin.workflow.edges as WorkflowEdge[];

    const nodeById = new Map<string, WorkflowNode>();
    const outgoing = new Map<string, string[]>();
    const nodesByType = new Map<NodeType, string[]>();

    for(const node of nodes){
        nodeById.set(node.id, node);
        const type = node.type as NodeType;
        const arr = nodesByType.get(type);
        if(arr) arr.push(node.id);
        else nodesByType.set(type, [node.id]);        
    }

    for(const edge of edges){
        const list = outgoing.get(edge.source);
        if(list) list.push(edge.target);
        else outgoing.set(edge.source, [edge.target]);
    }

    return { nodeById, outgoing, nodesByType };
};

const getIndexForPlugin = (plugin: IPluginRecord): WorkflowIndex => {
    const versionSignal =
        (plugin as any).updatedAt ||
        (plugin as any).workflowUpdatedAt ||
        plugin.workflow?.nodes?.length + ':' + plugin.workflow?.edges?.length;

    const cacheKey = plugin._id;
    const entryKey = `${plugin._id}:${versionSignal}`;
    
    const cached = workflowIndexCache.get(cacheKey);
    if(cached?.key === entryKey) return cached.index;

    const index = buildWorkflowIndex(plugin);
    workflowIndexCache.set(cacheKey, { key: entryKey, index });
    return index;
};

const getPluginsKeyForModifiers = (plugins: IPluginRecord[]) => {
    return plugins
        .map((p) => `${p._id}:${(p as any).updatedAt ?? ''}`)
        .join('|');
};

const usePluginStore = create<PluginState>((set, get) => ({
    plugins: [],
    pluginsBySlug: {},
    loading: false,
    error: null,

    async fetchPlugins(opts){
        const force = Boolean(opts?.force);
        const now = Date.now();

        if(!force && now - lastFetchAt < PLUGINS_TTL_MS && get().plugins.length > 0){
            return;
        }

        if(inFlightFetch) return inFlightFetch;

        inFlightFetch = (async () => {
            if(get().loading) return;
            set({ loading: true, error: null });

            try{
                const response = await pluginApi.getPlugins({ status: PluginStatus.PUBLISHED });
                const plugins = response.data as IPluginRecord[];

                const pluginsBySlug: Record<string, IPluginRecord> = {};
                for(const plugin of plugins) pluginsBySlug[plugin.slug] = plugin;

                lastFetchAt = Date.now();
                set({ plugins, pluginsBySlug, loading: false, error: null });
            }catch(err){
                set({ loading: false, error: getErrorMessage(err, 'Failed to load plugins') });
            }finally{
                inFlightFetch = null;
            }
        })();
        
        return inFlightFetch;
    },

    getModifiers(){
        const { plugins } = get();
        const key = getPluginsKeyForModifiers(plugins);
        if(key === lastModifiersKey && lastModifiers.length > 0) return lastModifiers;

        lastModifiersKey = key;
        lastModifiers = plugins.map((plugin) => {
            const idx = getIndexForPlugin(plugin);
            const modifierIds = idx.nodesByType.get(NodeType.MODIFIER) ?? [];
            const modifierNode = modifierIds.length ? idx.nodeById.get(modifierIds[0]) : undefined;
            const modifierData = (modifierNode?.data?.modifier || {}) as IModifierData;

            return {
                pluginId: plugin._id,
                pluginSlug: plugin.slug,
                name: modifierData.name || plugin.slug,
                icon: modifierData.icon,
                description: modifierData.description,
                version: modifierData.version,
            };
        });

        return lastModifiers;
    },
    
    getPluginArguments(pluginSlug: string): PluginArgument[]{
        const plugin = get().pluginsBySlug[pluginSlug];
        if(!plugin) return [];

        const idx = getIndexForPlugin(plugin);
        const argIds = idx.nodesByType.get(NodeType.ARGUMENTS) ?? [];
        if(!argIds.length) return [];

        const argsNode = idx.nodeById.get(argIds[0]);
        const argsData = (argsNode?.data?.arguments as any)?.arguments || [];
        return argsData;
    },

    async getRenderableExposures(
        trajectoryId: string,
        analysisId?: string,
        context: 'canvas' | 'raster' = 'canvas'
    ){
        const { analysisConfig } = useAnalysisConfigStore.getState();
        const activeAnalysisId = analysisId ?? analysisConfig?._id;
        if(!activeAnalysisId || !analysisConfig) return [];

        const pluginSlug = analysisConfig?.plugin;
        if(!pluginSlug) return [];

        await get().fetchPlugins();

        const plugin = get().pluginsBySlug[pluginSlug];
        if(!plugin) return [];

        const idx = getIndexForPlugin(plugin);
        const exposureIds = idx.nodesByType.get(NodeType.EXPOSURE) ?? [];
        if(!exposureIds.length) return [];

        const out = idx.outgoing;
        const renderable: RenderableExposure[] = [];

        for(const exposureId of exposureIds){
            const exposureNode = idx.nodeById.get(exposureId);
            if(!exposureNode) continue;

            const exposureData = (exposureNode.data?.exposure || {}) as IExposureData;
            let hasCanvas = false;
            let hasRaster = false;
            let exportConfig: IExportData | undefined;

            const directTargets = out.get(exposureId) ?? [];

            const processTarget = (nodeId: string) => {
                const node = idx.nodeById.get(nodeId);
                if(!node) return;

                if(node.type === NodeType.VISUALIZERS){
                    const viz = (node.data?.visualizers || {}) as IVisualizersData;
                    if(viz.canvas) hasCanvas = true;
                    if(viz.raster) hasRaster = true;
                }else if(node.type === NodeType.EXPORT){
                    exportConfig = node.data?.export as IExportData;
                }else if(node.type === NodeType.SCHEMA){
                    const schemaTargets = out.get(nodeId) ?? [];
                    for(const target of schemaTargets){
                        const targetNode = idx.nodeById.get(target);
                        if(!targetNode) continue;
                        if(targetNode === NodeType.VISUALIZERS){
                            // TODO: duplicated code
                            const viz = (targetNode.data?.visualizers || {}) as IVisualizersData;
                            if(viz.canvas) hasCanvas = true;
                            if(viz.raster) hasRaster = true;
                        }else if(targetNode.type === NodeType.EXPORT){
                            exportConfig = targetNode.data?.export as IExportData;
                        }
                    }
                }
            };

            for(const target of directTargets) processTarget(target);

            const isValidForContext = context === 'canvas' ? hasCanvas : hasRaster;
            const hasGlbExport = exportConfig?.type === 'glb';

            if(isValidForContext && hasGlbExport){
                renderable.push({
                    pluginId: plugin._id,
                    pluginSlug: plugin.slug,
                    analysisId: activeAnalysisId,
                    exposureId,
                    name: exposureData.name || exposureId,
                    results: exposureData.results || '',
                    canvas: hasCanvas,
                    raster: hasRaster,
                    export: exportConfig,
                });
            }
        }
        return renderable;
    }
}));

export default usePluginStore;