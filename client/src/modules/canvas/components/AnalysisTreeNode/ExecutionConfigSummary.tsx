import { Box, Row, Stack, Text } from '@voltstack/bravais';
import { ANALYSIS_EXECUTION_METADATA_KEY } from '@/modules/canvas/utilities/selected-timestep-analysis';
import { NodeType, PluginNodeExecutionMode } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type {
    IArgumentDefinition,
    IPluginNodeData,
    IPluginReferenceSelection,
    IWorkflowNode
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';

const ACRONYMS = new Set(['id', 'url', 'api', 'ui', 'sdk', 'rdf', 'rms', 'pbc', 'xyz']);

const MAX_INLINE_STRING = 40;
const MAX_INLINE_NUMBER_ARRAY = 4;
const MAX_INLINE_STRING_ARRAY = 6;

const humanizeKey = (key: string): string => {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);

    if (words.length === 0) return key;

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) return lower.toUpperCase();
            if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
};

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(3);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

interface RenderedValue {
    node: ReactNode;
    mono: boolean;
}

const MutedPlaceholder = () => <Text tone='muted'>—</Text>;

const renderValue = (value: unknown): RenderedValue => {
    if (value === null || value === undefined || value === '') {
        return { node: <MutedPlaceholder />, mono: false };
    }

    if (typeof value === 'boolean') {
        return { node: value ? 'Yes' : 'No', mono: false };
    }

    if (typeof value === 'number') {
        return { node: formatNumber(value), mono: true };
    }

    if (typeof value === 'string') {
        if (value.length <= MAX_INLINE_STRING) {
            return { node: value, mono: false };
        }
        return {
            node: <Text truncate title={value}>{value}</Text>,
            mono: false
        };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return { node: <MutedPlaceholder />, mono: false };

        if (value.every((item) => typeof item === 'number')) {
            const numbers = value as number[];
            const full = `[${numbers.map(formatNumber).join(', ')}]`;
            if (numbers.length <= MAX_INLINE_NUMBER_ARRAY) {
                return { node: full, mono: true };
            }
            const preview = numbers.slice(0, MAX_INLINE_NUMBER_ARRAY).map(formatNumber).join(', ');
            return {
                node: <span title={full}>{`[${preview}, … ${numbers.length} values]`}</span>,
                mono: true
            };
        }

        if (value.every((item) => typeof item === 'string')) {
            const strings = value as string[];
            const joined = strings.join(', ');
            if (strings.length <= MAX_INLINE_STRING_ARRAY && joined.length <= MAX_INLINE_STRING) {
                return { node: joined, mono: false };
            }
            return { node: `${strings.length} items`, mono: false };
        }

        return { node: `${value.length} items`, mono: false };
    }

    if (isPlainObject(value)) {
        const count = Object.keys(value).length;
        return { node: count === 0 ? <MutedPlaceholder /> : `${count} fields`, mono: false };
    }

    return { node: String(value), mono: false };
};

interface ConfigRow {
    label: string;
    value: ReactNode;
    mono: boolean;
}

interface ConfigColumn {
    key: string;
    title: string;
    rows: ConfigRow[];
}

const buildColumn = (title: string, source: Record<string, unknown>, key = title): ConfigColumn => {
    const rows = Object.entries(source).map(([key, value]) => {
        const rendered = renderValue(value);
        return { label: humanizeKey(key), value: rendered.node, mono: rendered.mono };
    });
    return { key, title, rows };
};

const buildScopeColumn = (metadata: unknown): ConfigColumn | undefined => {
    if (!isPlainObject(metadata)) return undefined;

    const selected = metadata.selectedTimesteps;
    if (!Array.isArray(selected) || selected.length === 0) return undefined;

    const numbers = selected.filter((item): item is number => typeof item === 'number');
    if (numbers.length === 0) return undefined;

    const sorted = [...numbers].sort((left, right) => left - right);

    return {
        key: 'scope',
        title: 'Scope',
        rows: [
            { label: 'Timesteps', value: String(sorted.length), mono: true },
            { label: 'Range', value: `${sorted[0]} - ${sorted[sorted.length - 1]}`, mono: true }
        ]
    };
};

const getPluginDisplayName = (
    pluginId: string,
    pluginsById: Record<string, Plugin> | undefined
): string => {
    const plugin = pluginsById?.[pluginId];
    return plugin?.modifier?.name?.trim() || pluginId;
};

const isPluginReferenceSelection = (value: unknown): value is IPluginReferenceSelection => {
    return isPlainObject(value) && typeof value.pluginId === 'string';
};

const getPluginReferenceSelections = (value: unknown): IPluginReferenceSelection[] => {
    const rawSelections = isPlainObject(value) && Array.isArray(value.selections)
        ? value.selections
        : Array.isArray(value)
            ? value
            : isPluginReferenceSelection(value)
                ? [value]
                : [];

    return rawSelections.flatMap((selection): IPluginReferenceSelection[] => {
        if (!isPluginReferenceSelection(selection)) return [];
        const pluginId = selection.pluginId.trim();
        if (!pluginId) return [];

        return [{
            pluginId,
            config: isPlainObject(selection.config) ? selection.config : {}
        }];
    });
};

const resolvePluginNodeExecutionMode = (pluginNode: IPluginNodeData): PluginNodeExecutionMode | undefined => {
    if (pluginNode.executionMode) return pluginNode.executionMode;
    if (pluginNode.pluginId) return PluginNodeExecutionMode.MANUAL;
    if (pluginNode.argumentReference) return PluginNodeExecutionMode.ARGUMENT_REFERENCE;
    return undefined;
};

const buildArgumentsByKey = (nodes: IWorkflowNode[]): Record<string, IArgumentDefinition> => {
    const argumentsNode = nodes.find((node) => node.type === NodeType.ARGUMENTS);
    const definitions = argumentsNode?.data.arguments?.arguments ?? [];
    return Object.fromEntries(definitions.map((definition) => [definition.argument, definition]));
};

const formatTimesteps = (selectedTimesteps: number[] | undefined): string | undefined => {
    if (!selectedTimesteps?.length) return undefined;

    const sorted = Array.from(new Set(selectedTimesteps)).sort((left, right) => left - right);

    if (sorted.length === 0) return undefined;
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

    if (execution.source) {
        rows.push({ label: 'Source', value: execution.source, mono: false });
    }

    const selectedTimesteps = formatTimesteps(execution.selectedTimesteps);
    if (selectedTimesteps) {
        rows.push({ label: 'Timesteps', value: selectedTimesteps, mono: true });
    }

    if (execution.clusterId) {
        rows.push({ label: 'Cluster', value: execution.clusterId, mono: true });
    }

    Object.entries(execution.config).forEach(([key, value]) => {
        const rendered = renderValue(value);
        rows.push({ label: humanizeKey(key), value: rendered.node, mono: rendered.mono });
    });

    if (rows.length === 0) {
        rows.push({ label: 'Parameters', value: <MutedPlaceholder />, mono: false });
    }

    return {
        key: execution.key,
        title: `Plugin node: ${getPluginDisplayName(execution.pluginId, pluginsById)}`,
        rows
    };
};

const buildPluginExecutionColumns = (
    plugin: Plugin | undefined,
    config: Record<string, unknown>,
    pluginsById: Record<string, Plugin> | undefined
): ConfigColumn[] => {
    const nodes = plugin?.workflow?.nodes ?? [];
    if (!nodes.length) return [];

    const argumentsByKey = buildArgumentsByKey(nodes);
    const executions: PluginExecutionColumnInput[] = [];

    nodes.forEach((node, nodeIndex) => {
        if (node.type !== NodeType.PLUGIN && !node.data.pluginNode) return;

        const pluginNode = node.data.pluginNode;
        if (!pluginNode) return;

        const executionMode = resolvePluginNodeExecutionMode(pluginNode);
        const selectedTimesteps = pluginNode.selectedTimesteps;
        const clusterId = pluginNode.selectedTeamClusterId;

        if (executionMode === PluginNodeExecutionMode.ARGUMENT_REFERENCE) {
            const argumentReference = pluginNode.argumentReference?.trim();
            if (!argumentReference) return;

            const selections = getPluginReferenceSelections(config[argumentReference]);
            if (!selections.length) return;

            const definition = argumentsByKey[argumentReference];
            const shouldUseSelectionConfig = definition?.showPluginConfiguration === true;
            const source = definition?.label?.trim() || humanizeKey(argumentReference);

            selections.forEach((selection, selectionIndex) => {
                const fallbackConfig = isPlainObject(pluginNode.configByPluginId?.[selection.pluginId])
                    ? pluginNode.configByPluginId?.[selection.pluginId] ?? {}
                    : isPlainObject(pluginNode.config)
                        ? pluginNode.config
                        : {};
                const selectionConfig = isPlainObject(selection.config) ? selection.config : {};

                executions.push({
                    key: `${node.id || nodeIndex}:${selection.pluginId}:${selectionIndex}`,
                    pluginId: selection.pluginId,
                    config: shouldUseSelectionConfig ? selectionConfig : fallbackConfig,
                    selectedTimesteps,
                    source,
                    clusterId
                });
            });

            return;
        }

        const pluginId = pluginNode.pluginId?.trim();
        if (!pluginId) return;

        executions.push({
            key: `${node.id || nodeIndex}:${pluginId}`,
            pluginId,
            config: isPlainObject(pluginNode.config) ? pluginNode.config : {},
            selectedTimesteps,
            source: 'Manual',
            clusterId
        });
    });

    return executions.map((execution) => buildPluginExecutionColumn(execution, pluginsById));
};

interface ExecutionConfigSummaryProps {
    config: Record<string, unknown>;
    plugin?: Plugin;
    pluginsById?: Record<string, Plugin>;
}

const ExecutionConfigSummary = ({ config, plugin, pluginsById }: ExecutionConfigSummaryProps) => {
    const columns = useMemo<ConfigColumn[]>(() => {
        const parameters: Record<string, unknown> = {};
        const nestedObjectEntries: [string, Record<string, unknown>][] = [];
        let metadata: unknown;

        for (const [key, value] of Object.entries(config)) {
            if (key === ANALYSIS_EXECUTION_METADATA_KEY) {
                metadata = value;
                continue;
            }
            if (isPlainObject(value) && Object.keys(value).length > 0) {
                nestedObjectEntries.push([key, value]);
                continue;
            }
            parameters[key] = value;
        }

        const result: ConfigColumn[] = [];

        if (Object.keys(parameters).length > 0) {
            result.push(buildColumn('Parameters', parameters, 'parameters'));
        }

        nestedObjectEntries.forEach(([key, value], index) => {
            result.push(buildColumn(humanizeKey(key), value, `nested:${key}:${index}`));
        });

        const pluginExecutionColumns = buildPluginExecutionColumns(plugin, config, pluginsById);
        for (const column of pluginExecutionColumns) {
            result.push(column);
        }

        const scopeColumn = buildScopeColumn(metadata);
        if (scopeColumn) result.push(scopeColumn);

        return result;
    }, [config, plugin, pluginsById]);

    if (columns.length === 0) {
        return (
            <Box p='1'>
                <Text size='sm' tone='muted'>No parameters configured.</Text>
            </Box>
        );
    }

    return (
        <Box p='1'>
            <Row align='start' gap='1-5' wrap>
                {columns.map((column) => (
                    <Stack key={column.key} gap='05' style={{ minWidth: 140 }}>
                        <Text size='xs' tone='muted'>{column.title}</Text>
                        {column.rows.map((row, rowIndex) => (
                            <Row key={`${row.label}:${rowIndex}`} justify='between' gap='1' className='font-size-1 color-secondary'>
                                <Text tone='muted'>{row.label}</Text>
                                <span className={row.mono ? 'font-mono tabular-nums' : undefined}>
                                    {row.value}
                                </span>
                            </Row>
                        ))}
                    </Stack>
                ))}
            </Row>
        </Box>
    );
};

export default ExecutionConfigSummary;
