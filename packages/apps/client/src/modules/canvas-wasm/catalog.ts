import { NodeType, PluginStatus } from '@volt/contracts/modules/plugin/enums';
import { WASM_PLUGIN_BASE_URL } from './constants';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { IWorkflow, IWorkflowNode } from '@volt/contracts/modules/plugin/workflow';
import type { IComputedArgumentDefinition, IExposureComputed } from '@volt/contracts/modules/plugin/exposure';

// Written by scripts/build-wasm-plugins.sh next to the compiled plugins.
interface WasmPluginIndexEntry {
    binary: string;
    // Data files mounted under /plugin, relative to data/<binary>/.
    files: string[];
    // CLI arguments the native deployment supplies outside the manifest.
    args: string[];
}

export interface WasmPluginRuntime extends WasmPluginIndexEntry {
    plugin: Plugin;
}

export interface WasmPluginCatalog {
    plugins: Plugin[];
    runtimeById: Map<string, WasmPluginRuntime>;
}

const findDescendant = (workflow: IWorkflow, nodeId: string, type: NodeType): IWorkflowNode | undefined => {
    const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
    const visited = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const edge of workflow.edges) {
            if (edge.source !== current || visited.has(edge.target)) continue;
            const target = nodesById.get(edge.target);
            if (target?.type === type) return target;
            visited.add(edge.target);
            queue.push(edge.target);
        }
    }
    return undefined;
};

// Same projection the server applies (WorkflowProjectionService), so the canvas sees identical plugins.
const projectPlugin = (workflow: IWorkflow): Plugin => {
    const modifier = workflow.nodes.find((node) => node.type === NodeType.MODIFIER)?.data.modifier;
    const pluginId = modifier?.key;
    if (!modifier || !pluginId) {
        throw new Error('WASM plugin manifest is missing its modifier key');
    }

    const exposures: IExposureComputed[] = workflow.nodes
        .filter((node) => node.type === NodeType.EXPOSURE)
        .map((node) => {
            const exposure = node.data.exposure;
            return {
                _id: node.id,
                id: exposure?.id,
                name: exposure?.name ?? '',
                icon: exposure?.icon,
                results: exposure?.results ?? '',
                hasListing: exposure?.hasListing !== false,
                properties: (exposure?.properties as IExposureComputed['properties']) ?? [],
                export: findDescendant(workflow, node.id, NodeType.EXPORT)?.data.export ?? null,
                exportWhen: exposure?.exportWhen,
                panel: exposure?.panel as IExposureComputed['panel']
            };
        });

    const now = new Date().toISOString();
    return {
        _id: pluginId,
        createdAt: now,
        updatedAt: now,
        status: PluginStatus.PUBLISHED,
        workflow,
        modifier,
        arguments: (workflow.nodes.find((node) => node.type === NodeType.ARGUMENTS)?.data.arguments?.arguments
            ?? []) as IComputedArgumentDefinition[],
        exposures,
        listingExposures: {
            pluginName: modifier.name,
            pluginId,
            exposures: exposures
                .filter((exposure) => exposure.hasListing)
                .map((exposure) => ({ exposureId: exposure._id, name: exposure.name }))
        }
    };
};

const fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${WASM_PLUGIN_BASE_URL}/${path}`);
    if (!response.ok) {
        throw new Error(`Failed to load ${WASM_PLUGIN_BASE_URL}/${path} (${response.status})`);
    }
    return response.json() as Promise<T>;
};

const fetchCatalog = async (): Promise<WasmPluginCatalog> => {
    const { plugins: entries } = await fetchJson<{ plugins: WasmPluginIndexEntry[] }>('index.json');
    const runtimes = await Promise.all(entries.map(async (entry): Promise<WasmPluginRuntime> => {
        const manifest = await fetchJson<{ workflow: IWorkflow }>(`manifests/${entry.binary}.json`);
        return { ...entry, plugin: projectPlugin(manifest.workflow) };
    }));
    return {
        plugins: runtimes.map((runtime) => runtime.plugin),
        runtimeById: new Map(runtimes.map((runtime) => [runtime.plugin._id, runtime]))
    };
};

let catalogPromise: Promise<WasmPluginCatalog> | null = null;

export const loadWasmCatalog = (): Promise<WasmPluginCatalog> => {
    catalogPromise ??= fetchCatalog().catch((error: unknown) => {
        catalogPromise = null;
        throw error;
    });
    return catalogPromise;
};

export const loadWasmPlugins = async (): Promise<Plugin[]> => (await loadWasmCatalog()).plugins;
