import { create } from 'zustand';
import pluginApi from '@/services/api/plugin/plugin';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { NodeType } from '@/types/plugin';
import type { IPluginRecord } from '@/services/api/plugin/types';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';

interface IModifierData {
    name?: string;
    icon?: string;
    description?: string;
    version?: string;
}

interface IExposureData {
    name?: string;
    icon?: string;
    results?: string;
}

interface IVisualizersData {
    canvas?: boolean;
    raster?: boolean;
}

interface IExportData {
    exporter?: string;
    type?: string;
    options?: Record<string, unknown>;
}

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
    outgoingBySource: Map<string, string[]>;
    nodeIdsByType: Map<NodeType, string[]>;
};

export interface PluginState {
    plugins: IPluginRecord[];
    pluginsBySlug: Record<string, IPluginRecord>;
    modifiers: ResolvedModifier[];
    loading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: { page: number; limit: number; total: number; hasMore: boolean };

    fetchPlugins: (opts?: {
        page?: number;
        limit?: number;
        search?: string;
        append?: boolean;
        force?: boolean;
    }) => Promise<void>;

    getModifiers: () => ResolvedModifier[];
    getPluginArguments: (pluginSlug: string) => PluginArgument[];

    getRenderableExposures: (
        trajectoryId: string,
        analysisId?: string,
        context?: 'canvas' | 'raster',
        pluginSlug?: string
    ) => Promise<RenderableExposure[]>;

    fetchPlugin: (slug: string) => Promise<void>;
    resetPlugins: () => void;
}

const PLUGINS_TTL_MS = 60_000;

let lastPluginsFetchAtMs = 0;
const workflowIndexByPluginId = new Map<string, { versionKey: string; index: WorkflowIndex }>();

function buildWorkflowIndex(plugin: IPluginRecord): WorkflowIndex {
    const nodeById = new Map<string, WorkflowNode>();
    const outgoingBySource = new Map<string, string[]>();
    const nodeIdsByType = new Map<NodeType, string[]>();

    for (const node of plugin.workflow.nodes as WorkflowNode[]) {
        nodeById.set(node.id, node);

        const nodeType = node.type as NodeType;
        const ids = nodeIdsByType.get(nodeType);
        if (ids) {
            ids.push(node.id);
        } else {
            nodeIdsByType.set(nodeType, [node.id]);
        }
    }

    for (const edge of plugin.workflow.edges as WorkflowEdge[]) {
        const targets = outgoingBySource.get(edge.source);
        if (targets) {
            targets.push(edge.target);
        } else {
            outgoingBySource.set(edge.source, [edge.target]);
        }
    }

    return { nodeById, outgoingBySource, nodeIdsByType };
}

function getWorkflowIndex(plugin: IPluginRecord): WorkflowIndex {
    const updatedAt = (plugin as any).updatedAt ?? '';
    const versionKey = `${plugin._id}:${updatedAt}:${plugin.workflow?.nodes?.length ?? 0}:${plugin.workflow?.edges?.length ?? 0}`;

    const cached = workflowIndexByPluginId.get(plugin._id);
    if (cached?.versionKey === versionKey) {
        return cached.index;
    }

    const index = buildWorkflowIndex(plugin);
    workflowIndexByPluginId.set(plugin._id, { versionKey, index });
    return index;
}

function firstNodeIdOfType(index: WorkflowIndex, type: NodeType): string | null {
    const ids = index.nodeIdsByType.get(type);
    return ids && ids.length > 0 ? ids[0] : null;
}

function readVisualizersFlags(node: WorkflowNode | undefined): { canvas: boolean; raster: boolean } {
    const visualizers = (node?.data?.visualizers ?? {}) as IVisualizersData;
    return {
        canvas: !!visualizers.canvas,
        raster: !!visualizers.raster
    };
}

function resolveModifiersFromPlugins(plugins: IPluginRecord[]): ResolvedModifier[] {
    return plugins.map((plugin) => {
        const workflowIndex = getWorkflowIndex(plugin);
        const modifierNodeId = firstNodeIdOfType(workflowIndex, NodeType.MODIFIER);
        const modifierNode = modifierNodeId ? workflowIndex.nodeById.get(modifierNodeId) : undefined;
        const modifierData = (modifierNode?.data?.modifier ?? {}) as IModifierData;

        return {
            plugin,
            name: modifierData.name || plugin.slug,
            icon: modifierData.icon
        };
    });
}

export const usePluginStore = create<PluginState>((set, get) => ({
    plugins: [],
    pluginsBySlug: {},
    modifiers: [],
    loading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta,



    resetPlugins: () => {
        set({
            plugins: [],
            pluginsBySlug: {},
            modifiers: [],
            listingMeta: initialListingMeta,
            loading: false,
            error: null
        });
        lastPluginsFetchAtMs = 0;
    },

    async fetchPlugins(options = {}) {
        const {
            page = 1,
            limit = 20,
            search = '',
            append = false,
            force = false
        } = options;

        const state = get();
        const nowMs = Date.now();

        const canUseCache =
            !force &&
            !append &&
            page === 1 &&
            state.plugins.length > 0 &&
            nowMs - lastPluginsFetchAtMs < PLUGINS_TTL_MS;

        if (canUseCache) {
            return;
        }

        if (append && state.isFetchingMore) {
            return;
        }

        if (!append && state.loading) {
            return;
        }

        const loadingKey = append ? 'isFetchingMore' : 'loading';

        const request = () => pluginApi.getPlugins({ page, limit, search });

        await runRequest(set, get, request, {
            loadingKey,
            errorFallback: 'Failed to load plugins',
            onSuccess: (apiResponse) => {
                const incomingPlugins = apiResponse.data;
                const totalFromApi = apiResponse.results?.total;

                const pagination = calculatePaginationState({
                    newData: incomingPlugins,
                    currentData: state.plugins,
                    page,
                    limit,
                    append,
                    totalFromApi,
                    previousTotal: state.listingMeta.total
                });

                const nextPluginsBySlug = { ...state.pluginsBySlug };
                for (const plugin of incomingPlugins) {
                    console.log('plugin.slug =', plugin.slug, plugin)
                    nextPluginsBySlug[plugin.slug] = plugin;
                }

                const nextModifiers = resolveModifiersFromPlugins(pagination.data);
                console.log(nextModifiers);
                set({
                    plugins: pagination.data,
                    pluginsBySlug: nextPluginsBySlug,
                    modifiers: nextModifiers,
                    listingMeta: pagination.listingMeta,
                    error: null
                });

                if (!append && page === 1) {
                    lastPluginsFetchAtMs = nowMs;
                }
            }
        });
    },

    async fetchPlugin(slug: string) {
        const state = get();
        if (state.pluginsBySlug[slug]) return;

        set({ loading: true });
        try {
            const plugin = await pluginApi.getPlugin(slug);
            const nextPluginsBySlug = { ...get().pluginsBySlug };
            nextPluginsBySlug[plugin.slug] = plugin;

            // Also update modifiers if this plugin isn't there
            const modifiers = get().modifiers;
            const existingModifier = modifiers.find(m => m.plugin.slug === plugin.slug);
            let nextModifiers = modifiers;

            if (!existingModifier) {
                const newModifiers = resolveModifiersFromPlugins([plugin]);
                if (newModifiers.length > 0) {
                    nextModifiers = [...modifiers, newModifiers[0]];
                }
            }

            set({
                pluginsBySlug: nextPluginsBySlug,
                modifiers: nextModifiers,
                loading: false
            });
        } catch (error) {
            console.error(`Failed to fetch plugin ${slug}:`, error);
            set({ loading: false });
        }
    },

    getModifiers() {
        return get().modifiers;
    },

    getPluginArguments(pluginSlug) {
        const plugin = get().pluginsBySlug[pluginSlug];
        if (!plugin) {
            return [];
        }

        const workflowIndex = getWorkflowIndex(plugin);
        const argumentsNodeId = firstNodeIdOfType(workflowIndex, NodeType.ARGUMENTS);
        if (!argumentsNodeId) {
            return [];
        }

        const node = workflowIndex.nodeById.get(argumentsNodeId);
        const args = (node?.data?.arguments as any)?.arguments;
        return Array.isArray(args) ? (args as PluginArgument[]) : [];
    },

    async getRenderableExposures(trajectoryId, analysisId, context = 'canvas', pluginSlug) {
        const { analysisConfig } = useAnalysisConfigStore.getState();

        const resolvedAnalysisId = analysisId ?? analysisConfig?._id;
        const resolvedPluginSlug = pluginSlug ?? analysisConfig?.plugin;

        if (!resolvedAnalysisId || !resolvedPluginSlug) {
            return [];
        }

        await get().fetchPlugins({ force: true });

        const plugin = get().pluginsBySlug[resolvedPluginSlug];
        console.log('getRenderableExposures:', plugin, resolvedPluginSlug);
        if (!plugin) {
            return [];
        }

        const workflowIndex = getWorkflowIndex(plugin);
        const exposureNodeIds = workflowIndex.nodeIdsByType.get(NodeType.EXPOSURE) ?? [];

        const renderables: RenderableExposure[] = [];

        for (const exposureNodeId of exposureNodeIds) {
            const exposureNode = workflowIndex.nodeById.get(exposureNodeId);
            if (!exposureNode) {
                continue;
            }

            const exposureData = (exposureNode.data?.exposure ?? {}) as IExposureData;

            let supportsCanvas = false;
            let supportsRaster = false;
            let hasPerAtomProperties = false;
            let exportConfig: IExportData | undefined;

            const stack = [...(workflowIndex.outgoingBySource.get(exposureNodeId) ?? [])];

            while (stack.length > 0) {
                const targetNodeId = stack.pop() as string;
                const targetNode = workflowIndex.nodeById.get(targetNodeId);
                if (!targetNode) {
                    continue;
                }

                if (targetNode.type === NodeType.VISUALIZERS) {
                    const flags = readVisualizersFlags(targetNode);
                    supportsCanvas = supportsCanvas || flags.canvas;
                    supportsRaster = supportsRaster || flags.raster;

                    // Check for perAtomProperties
                    const perAtom = targetNode.data?.visualizers?.perAtomProperties;
                    if (Array.isArray(perAtom) && perAtom.length > 0) {
                        hasPerAtomProperties = true;
                    }
                    continue;
                }

                if (targetNode.type === NodeType.EXPORT) {
                    exportConfig = targetNode.data?.export as IExportData;
                    continue;
                }

                const downstream = workflowIndex.outgoingBySource.get(targetNodeId);
                if (downstream && downstream.length > 0) {
                    stack.push(...downstream);
                }
            }

            const matchesContext = context === 'canvas' ? supportsCanvas : supportsRaster;
            console.log('matches context:', matchesContext, exposureData.name, renderables)
            const exportsGlb = exportConfig?.type === 'glb';
            const exportsChart = exportConfig?.type === 'chart-png';

            if (!matchesContext) {
                continue;
            }
            // Include exposure if it matches context and exports GLB or chart, OR if it has perAtomProperties
            if (!matchesContext && !hasPerAtomProperties) {
                continue;
            }

            if (!exportsGlb && !exportsChart && !hasPerAtomProperties) {
                continue;
            }

            renderables.push({
                pluginId: plugin._id,
                pluginSlug: plugin.slug,
                analysisId: resolvedAnalysisId,
                exposureId: exposureNodeId,
                modifierId: plugin.slug,
                name: exposureData.name || exposureNodeId,
                icon: exposureData.icon,
                results: exposureData.results || '',
                canvas: supportsCanvas,
                raster: supportsRaster,
                export: exportConfig
            });
        }

        return renderables;
    }
}));
