import { NodeType, PluginNodeExecutionMode } from '@volt/contracts/modules/plugin/enums';
import { emptyValue, humanizeKey, monoValue, plainValue, toConfigRows } from './config-values';
import { isRecord } from '@/shared/utils/type-guards';
import {
    ANALYSIS_EXECUTION_METADATA_KEY,
    readAnalysisExecutionMetadata
} from '@/modules/canvas/utils/selected-timestep-analysis';

import type { ConfigColumn, ConfigRow } from './config-values';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type {
    IArgumentDefinition,
    IPluginReferenceSelection,
    IWorkflowNode
} from '@volt/contracts/modules/plugin/workflow';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';

const ascending = (left: number, right: number): number => left - right;

export const hasPluginWorkflowNodes = (plugin: Plugin | undefined): boolean => {
    return plugin?.workflow?.nodes?.some((node) => {
        return node.type === NodeType.PLUGIN || Boolean(node.data.pluginNode);
    }) ?? false;
};

const buildScopeColumn = (config: Analysis['config']): ConfigColumn | undefined => {
    const selectedTimesteps = readAnalysisExecutionMetadata(config)?.selectedTimesteps;
    if (!selectedTimesteps?.length) return undefined;

    const sorted = [...selectedTimesteps].sort(ascending);

    return {
        key: 'scope',
        title: 'Scope',
        rows: [
            {
                label: 'Timesteps',
                value: monoValue(String(sorted.length))
            },
            {
                label: 'Range',
                value: monoValue(`${sorted[0]} - ${sorted[sorted.length - 1]}`)
            }
        ]
    };
};

/**
 * The stored value is written by our own plugin config editor through
 * `getPluginReferenceValue`, so the declared `IPluginReferenceValue` shape is
 * taken at face value; only the `unknown` config entry needs a declaration.
 */
const readPluginReferenceSelections = (value: unknown): IPluginReferenceSelection[] => {
    if (!isRecord(value) || !Array.isArray(value.selections)) return [];
    return value.selections as IPluginReferenceSelection[];
};

const buildArgumentsByKey = (nodes: IWorkflowNode[]): Record<string, IArgumentDefinition> => {
    const argumentsNode = nodes.find((node) => node.type === NodeType.ARGUMENTS);
    const definitions = argumentsNode?.data.arguments?.arguments ?? [];
    return Object.fromEntries(definitions.map((definition) => [definition.argument, definition]));
};

const formatTimesteps = (selectedTimesteps: number[] | undefined): string | undefined => {
    if (!selectedTimesteps?.length) return undefined;

    const sorted = Array.from(new Set(selectedTimesteps)).sort(ascending);
    if (sorted.length === 1) return String(sorted[0]);

    return `${sorted.length} (${sorted[0]} - ${sorted[sorted.length - 1]})`;
};

interface PluginExecutionColumnInput {
    key: string;
    pluginId: string;
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
    source?: string;
    clusterId?: string;
}

const buildPluginExecutionColumn = (
    execution: PluginExecutionColumnInput,
    pluginsById: Record<string, Plugin> | undefined
): ConfigColumn => {
    const rows: ConfigRow[] = [];
    const selectedTimesteps = formatTimesteps(execution.selectedTimesteps);

    if (execution.source) {
        rows.push({
            label: 'Source',
            value: plainValue(execution.source)
        });
    }

    if (selectedTimesteps) {
        rows.push({
            label: 'Timesteps',
            value: monoValue(selectedTimesteps)
        });
    }

    if (execution.clusterId) {
        rows.push({
            label: 'Cluster',
            value: monoValue(execution.clusterId)
        });
    }

    rows.push(...toConfigRows(execution.config));

    if (rows.length === 0) {
        rows.push({
            label: 'Parameters',
            value: emptyValue()
        });
    }

    const pluginName = pluginsById?.[execution.pluginId]?.modifier?.name?.trim();

    return {
        key: execution.key,
        title: `Plugin node: ${pluginName || execution.pluginId}`,
        rows
    };
};

const buildPluginExecutionColumns = (
    plugin: Plugin | undefined,
    config: Analysis['config'],
    pluginsById: Record<string, Plugin> | undefined
): ConfigColumn[] => {
    const nodes = plugin?.workflow?.nodes ?? [];
    if (!nodes.length) return [];

    const argumentsByKey = buildArgumentsByKey(nodes);
    const columns: ConfigColumn[] = [];

    nodes.forEach((node) => {
        const pluginNode = node.data.pluginNode;
        if (!pluginNode) return;

        const selectedTimesteps = pluginNode.selectedTimesteps;
        const clusterId = pluginNode.selectedTeamClusterId;
        const usesArgumentReference = pluginNode.executionMode
            ? pluginNode.executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE
            : !pluginNode.pluginId && Boolean(pluginNode.argumentReference);

        if (usesArgumentReference) {
            const argumentReference = pluginNode.argumentReference?.trim();
            if (!argumentReference) return;

            const definition = argumentsByKey[argumentReference];
            const source = definition?.label?.trim() || humanizeKey(argumentReference);

            readPluginReferenceSelections(config[argumentReference]).forEach((selection, selectionIndex) => {
                columns.push(buildPluginExecutionColumn({
                    key: `${node.id}:${selection.pluginId}:${selectionIndex}`,
                    pluginId: selection.pluginId,
                    config: definition?.showPluginConfiguration
                        ? selection.config ?? {}
                        : pluginNode.configByPluginId?.[selection.pluginId] ?? pluginNode.config ?? {},
                    selectedTimesteps,
                    source,
                    clusterId
                }, pluginsById));
            });

            return;
        }

        const pluginId = pluginNode.pluginId?.trim();
        if (!pluginId) return;

        columns.push(buildPluginExecutionColumn({
            key: `${node.id}:${pluginId}`,
            pluginId,
            config: pluginNode.config ?? {},
            selectedTimesteps,
            source: 'Manual',
            clusterId
        }, pluginsById));
    });

    return columns;
};

export const buildConfigColumns = (
    config: Analysis['config'],
    plugin: Plugin | undefined,
    pluginsById: Record<string, Plugin> | undefined
): ConfigColumn[] => {
    const parameters: Record<string, unknown> = {};
    const nestedColumns: ConfigColumn[] = [];

    for (const [key, value] of Object.entries(config)) {
        if (key === ANALYSIS_EXECUTION_METADATA_KEY) continue;
        if (isRecord(value) && Object.keys(value).length > 0) {
            nestedColumns.push({
                key: `nested:${key}`,
                title: humanizeKey(key),
                rows: toConfigRows(value)
            });
            continue;
        }
        parameters[key] = value;
    }

    const columns: ConfigColumn[] = [];

    if (Object.keys(parameters).length > 0) {
        columns.push({
            key: 'parameters',
            title: 'Parameters',
            rows: toConfigRows(parameters)
        });
    }

    columns.push(...nestedColumns, ...buildPluginExecutionColumns(plugin, config, pluginsById));

    const scopeColumn = buildScopeColumn(config);
    if (scopeColumn) columns.push(scopeColumn);

    return columns;
};
