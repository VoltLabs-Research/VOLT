import { create } from 'zustand';
import pluginApi, { type IPluginRecord } from '@/services/api/plugin/plugin';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { NodeType } from '@/types/plugin';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';


interface IModifierData { name?: string; icon?: string; description?: string; version?: string }
interface IExposureData { name?: string; icon?: string; results?: string }
interface IVisualizersData { canvas?: boolean; raster?: boolean }
interface IExportData { exporter?: string; type?: string; options?: Record<string, unknown> }

export interface RenderableExposure {
    pluginId: string;
    pluginSlug: string;
    analysisId: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: IExportData;
}

export interface ResolvedModifier {
    plugin: IPluginRecord;
    name: string;
    icon?: string;
}

export interface PluginArgument {
    argument: string;
    type: 'select' | 'number' | 'boolean' | 'string' | 'frame';
    label: string;
    default?: unknown;
    value?: unknown;
    options?: Array<{ key: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
}

type WorkflowNode = IPluginRecord['workflow']['nodes'][number];
type WorkflowEdge = IPluginRecord['workflow']['edges'][number];
type WorkflowIndex = {
    nodeById: Map<string, WorkflowNode>;
    outgoing: Map<string, string[]>;
    nodesByType: Map<NodeType, string[]>;
};

export interface PluginState {
    plugins: IPluginRecord[];
    pluginsBySlug: Record<string, IPluginRecord>;
    modifiers: ResolvedModifier[];
    loading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: { page: number; limit: number; total: number; hasMore: boolean };
    fetchPlugins: (opts?: { page?: number; limit?: number; search?: string; append?: boolean; force?: boolean }) => Promise<void>;
    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];
    getRenderableExposures: (trajectoryId: string, analysisId?: string, context?: 'canvas' | 'raster', pluginSlug?: string) => Promise<RenderableExposure[]>;
}

const PLUGINS_TTL_MS = 60_000;
let lastFetchAt = 0;
const workflowIndexCache = new Map<string, { key: string; index: WorkflowIndex }>();
let modifiersCache = { key: '', data: [] as ResolvedModifier[] };

function buildWorkflowIndex(plugin: IPluginRecord): WorkflowIndex {
    const nodeById = new Map<string, WorkflowNode>();
    const outgoing = new Map<string, string[]>();
    const nodesByType = new Map<NodeType, string[]>();

    for (const node of plugin.workflow.nodes as WorkflowNode[]) {
        nodeById.set(node.id, node);
        const arr = nodesByType.get(node.type as NodeType);
        if (arr) arr.push(node.id);
        else nodesByType.set(node.type as NodeType, [node.id]);
    }

    for (const edge of plugin.workflow.edges as WorkflowEdge[]) {
        const list = outgoing.get(edge.source);
        if (list) list.push(edge.target);
        else outgoing.set(edge.source, [edge.target]);
    }

    return { nodeById, outgoing, nodesByType };
}

function getWorkflowIndex(plugin: IPluginRecord): WorkflowIndex {
    const versionKey = `${plugin._id}:${(plugin as any).updatedAt || plugin.workflow?.nodes?.length}`;
    const cached = workflowIndexCache.get(plugin._id);
    if (cached?.key === versionKey) return cached.index;

    const index = buildWorkflowIndex(plugin);
    workflowIndexCache.set(plugin._id, { key: versionKey, index });
    return index;
}

function extractVisualizerFlags(node: WorkflowNode | undefined): { canvas: boolean; raster: boolean } {
    const viz = (node?.data?.visualizers || {}) as IVisualizersData;
    return { canvas: !!viz.canvas, raster: !!viz.raster };
}

export const usePluginStore = create<PluginState>((set, get) => ({
    plugins: [],
    pluginsBySlug: {},
    modifiers: [],
    loading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta,

    async fetchPlugins(opts = {}) {
        const { page = 1, limit = 20, search = '', append = false, force = false } = opts;
        const state = get();

        if (!force && !append && page === 1 && Date.now() - lastFetchAt < PLUGINS_TTL_MS && state.plugins.length > 0) return;
        if (state.loading || state.isFetchingMore) return;

        const loadingKey = append ? 'isFetchingMore' : 'loading';

        await runRequest(set, get, () => pluginApi.getPlugins({ page, limit, search }), {
            loadingKey,
            errorFallback: 'Failed to load plugins',
            onSuccess: (response) => {
                const newPlugins = (response.data || []) as IPluginRecord[];
                const total = (response as any).results?.total ?? 0;

                const { data, listingMeta } = calculatePaginationState({
                    newData: newPlugins,
                    currentData: state.plugins,
                    page, limit, append,
                    totalFromApi: total,
                    previousTotal: state.listingMeta.total
                });

                const pluginsBySlug = { ...state.pluginsBySlug };
                for (const p of newPlugins) pluginsBySlug[p.slug] = p;

                // Compute modifiers immediately when plugins change
                const modifiers = data.map(plugin => {
                    const idx = getWorkflowIndex(plugin);
                    const modifierId = (idx.nodesByType.get(NodeType.MODIFIER) ?? [])[0];
                    const node = modifierId ? idx.nodeById.get(modifierId) : undefined;
                    const modData = (node?.data?.modifier || {}) as IModifierData;

                    return {
                        plugin,
                        name: modData.name || plugin.slug,
                        icon: modData.icon
                    };
                });

                set({ plugins: data, pluginsBySlug, modifiers, listingMeta });
                if (!append && page === 1) lastFetchAt = Date.now();
            }
        });
    },

    getModifiers() {
        const { plugins } = get();
        const key = plugins.map(p => `${p._id}:${(p as any).updatedAt ?? ''}`).join('|');
        if (key === modifiersCache.key && modifiersCache.data.length > 0) return modifiersCache.data;
        console.log('get modifiers:', plugins)
        modifiersCache = {
            key,
            data: plugins.map(plugin => {
                const idx = getWorkflowIndex(plugin);
                const modifierId = (idx.nodesByType.get(NodeType.MODIFIER) ?? [])[0];
                const node = modifierId ? idx.nodeById.get(modifierId) : undefined;
                const data = (node?.data?.modifier || {}) as IModifierData;

                return {
                    plugin,
                    name: data.name || plugin.slug,
                    icon: data.icon
                };
            })
        };
        return modifiersCache.data;
    },

    getPluginArguments(pluginSlug) {
        const plugin = get().pluginsBySlug[pluginSlug];
        if (!plugin) return [];

        const idx = getWorkflowIndex(plugin);
        const argId = (idx.nodesByType.get(NodeType.ARGUMENTS) ?? [])[0];
        if (!argId) return [];

        const node = idx.nodeById.get(argId);
        return (node?.data?.arguments as any)?.arguments || [];
    },

    async getRenderableExposures(trajectoryId, analysisId, context = 'canvas', pluginSlug) {
        const { analysisConfig } = useAnalysisConfigStore.getState();
        const activeAnalysisId = analysisId ?? analysisConfig?._id;
        const resolvedSlug = pluginSlug ?? analysisConfig?.plugin;
        if (!activeAnalysisId || !resolvedSlug) return [];

        await get().fetchPlugins();
        const plugin = get().pluginsBySlug[resolvedSlug];
        if (!plugin) return [];

        const idx = getWorkflowIndex(plugin);
        const exposureIds = idx.nodesByType.get(NodeType.EXPOSURE) ?? [];
        const renderable: RenderableExposure[] = [];

        for (const exposureId of exposureIds) {
            const exposureNode = idx.nodeById.get(exposureId);
            if (!exposureNode) continue;

            const exposureData = (exposureNode.data?.exposure || {}) as IExposureData;
            let hasCanvas = false, hasRaster = false;
            let exportConfig: IExportData | undefined;

            for (const targetId of idx.outgoing.get(exposureId) ?? []) {
                const target = idx.nodeById.get(targetId);
                if (!target) continue;

                if (target.type === NodeType.VISUALIZERS) {
                    const flags = extractVisualizerFlags(target);
                    hasCanvas ||= flags.canvas;
                    hasRaster ||= flags.raster;
                } else if (target.type === NodeType.EXPORT) {
                    exportConfig = target.data?.export as IExportData;
                } else if (target.type === NodeType.SCHEMA) {
                    for (const schemaTargetId of idx.outgoing.get(targetId) ?? []) {
                        const schemaTarget = idx.nodeById.get(schemaTargetId);
                        if (schemaTarget?.type === NodeType.VISUALIZERS) {
                            const flags = extractVisualizerFlags(schemaTarget);
                            hasCanvas ||= flags.canvas;
                            hasRaster ||= flags.raster;
                        } else if (schemaTarget?.type === NodeType.EXPORT) {
                            exportConfig = schemaTarget.data?.export as IExportData;
                        }
                    }
                }
            }

            const isValid = context === 'canvas' ? hasCanvas : hasRaster;
            if (isValid && exportConfig?.type === 'glb') {
                renderable.push({
                    pluginId: plugin._id,
                    pluginSlug: plugin.slug,
                    analysisId: activeAnalysisId,
                    exposureId,
                    modifierId: plugin.slug,
                    name: exposureData.name || exposureId,
                    icon: exposureData.icon,
                    results: exposureData.results || '',
                    canvas: hasCanvas,
                    raster: hasRaster,
                    export: exportConfig
                });
            }
        }
        return renderable;
    }
}));
