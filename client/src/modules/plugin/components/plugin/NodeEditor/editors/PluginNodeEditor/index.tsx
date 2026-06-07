import {
    ArgumentType,
    NodeType,
    PluginNodeExecutionMode,
    PluginNodeOutputPathMode,
    PluginStatus
} from '@/modules/plugin/api/entities/plugin/workflow-enums';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/ArgumentFieldsRenderer';
import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { getUserConfigurableArguments } from '@/modules/plugin/utilities/plugin/argument-values';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import FormSection from '@/shared/presentation/components/FormSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { normalizeSelectedTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
    IArgumentDefinition,
    IPluginNodeData
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { EditorProps } from '../types';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';

const EXECUTION_MODE_OPTIONS = [{
    value: PluginNodeExecutionMode.MANUAL,
    title: 'Manual'
}, {
    value: PluginNodeExecutionMode.ARGUMENT_REFERENCE,
    title: 'Run from arguments reference'
}];

const OUTPUT_PATH_MODE_OPTIONS = [{
    value: PluginNodeOutputPathMode.ISOLATED,
    title: 'Isolated output'
}, {
    value: PluginNodeOutputPathMode.PARENT,
    title: 'Parent output'
}];

interface ArgumentReferenceCandidate {
    argument: IArgumentDefinition;
    pluginReferenceDefinitions: IArgumentDefinition[];
    supportsMultipleExecutions: boolean;
}

const collectPluginReferenceDefinitions = (
    argument: IArgumentDefinition
): IArgumentDefinition[] => {
    if (argument.type === ArgumentType.PLUGIN_REFERENCE) {
        return [argument];
    }

    if (argument.type !== ArgumentType.LIST) {
        return [];
    }

    return (argument.listArguments ?? []).flatMap(collectPluginReferenceDefinitions);
};

const PluginNodeEditor = ({ node }: EditorProps) => {
    const selectedTeamId = useSelectedTeamId();
    const [searchParams] = useSearchParams();
    const currentPluginId = searchParams.get('id') ?? '';
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
    const nodes = usePluginBuilderStore((state) => state.nodes);
    const nodeReferenceOptions = useNodeReferenceAutocomplete(node.id);
    const { frames } = useDebugTrajectorySelector();
    const { publishedPlugins, publishedPluginsById, getPluginArguments } = usePluginSelectors();
    const { data: teamClustersResponse } = usePluginTeamClustersQuery({
        teamId: selectedTeamId ?? '',
        page: 1,
        limit: 100
    }, {
        enabled: Boolean(selectedTeamId)
    });

    const pluginNodeData = (node.data.pluginNode ?? {}) as IPluginNodeData;
    const executionMode = pluginNodeData.executionMode ?? PluginNodeExecutionMode.MANUAL;
    const outputPathMode = pluginNodeData.outputPathMode ?? PluginNodeOutputPathMode.ISOLATED;
    const availableTimesteps = useMemo(() => {
        return frames.map((frame) => frame.timestep);
    }, [frames]);
    const {
        executionTeamClusters,
        teamClusterOptions
    } = usePluginExecutionClusterOptions(teamClustersResponse?.data);

    const pluginOptions = useMemo<SelectOption[]>(() => {
        return publishedPlugins
            .filter((plugin) => plugin._id !== currentPluginId && plugin.status === PluginStatus.PUBLISHED)
            .map((plugin) => ({
                value: plugin._id,
                title: plugin.modifier?.name?.trim() || plugin._id
            }));
    }, [currentPluginId, publishedPlugins]);

    const frameOptions = useMemo<SelectOption[]>(() => {
        return availableTimesteps.map((timestep) => ({
            value: String(timestep),
            title: `t=${timestep}`
        }));
    }, [availableTimesteps]);

    const argumentReferenceCandidates = useMemo<ArgumentReferenceCandidate[]>(() => {
        const argumentsNode = nodes.find((candidate) => candidate.type === NodeType.ARGUMENTS);
        const definitions = argumentsNode?.data.arguments?.arguments ?? [];

        return definitions.flatMap((argument) => {
            const pluginReferenceDefinitions = collectPluginReferenceDefinitions(argument);
            if (pluginReferenceDefinitions.length === 0 || !argument.argument.trim()) {
                return [];
            }

            return [{
                argument,
                pluginReferenceDefinitions,
                supportsMultipleExecutions: argument.type === ArgumentType.LIST
                    || pluginReferenceDefinitions.some((definition) => definition.multipleSelection)
            }];
        });
    }, [nodes]);

    const argumentReferenceOptions = useMemo<SelectOption[]>(() => {
        return argumentReferenceCandidates
            .map((candidate) => ({
                value: candidate.argument.argument,
                title: candidate.argument.label?.trim() || candidate.argument.argument
            }));
    }, [argumentReferenceCandidates]);

    const argumentReferenceCandidatesByKey = useMemo(() => {
        return Object.fromEntries(argumentReferenceCandidates.map((candidate) => [candidate.argument.argument, candidate]));
    }, [argumentReferenceCandidates]);

    const selectedPluginId = pluginNodeData.pluginId ?? '';
    const selectedPlugin = selectedPluginId ? publishedPluginsById[selectedPluginId] : undefined;
    const selectedArgumentReference = pluginNodeData.argumentReference ?? '';
    const selectedArgumentCandidate = selectedArgumentReference
        ? argumentReferenceCandidatesByKey[selectedArgumentReference]
        : undefined;
    const manualArgumentsDefinitions = useMemo(() => {
        if (!selectedPluginId) {
            return [];
        }

        return getUserConfigurableArguments(getPluginArguments(selectedPluginId));
    }, [getPluginArguments, selectedPluginId]);

    const referencedCandidatePluginIds = useMemo(() => {
        if (!selectedArgumentCandidate) {
            return [];
        }

        const referencedPluginIds = new Set<string>();
        for (const pluginReferenceDefinition of selectedArgumentCandidate.pluginReferenceDefinitions ?? []) {
            for (const pluginId of pluginReferenceDefinition.pluginReferenceFilter ?? []) {
                referencedPluginIds.add(pluginId);
            }

            const allowedPluginKeys = new Set(pluginReferenceDefinition.pluginReferenceFilterKeys ?? []);
            if (allowedPluginKeys.size > 0) {
                for (const plugin of publishedPlugins) {
                    const pluginKey = plugin.modifier?.key?.trim();
                    if (
                        plugin.status === PluginStatus.PUBLISHED
                        && plugin._id !== currentPluginId
                        && pluginKey
                        && allowedPluginKeys.has(pluginKey)
                    ) {
                        referencedPluginIds.add(plugin._id);
                    }
                }
            }
        }

        if (referencedPluginIds.size > 0) {
            return Array.from(referencedPluginIds);
        }

        return pluginOptions.map((option) => option.value);
    }, [currentPluginId, pluginOptions, publishedPlugins, selectedArgumentCandidate]);

    const referencedPluginConfigDefinitions = useMemo(() => {
        return Object.fromEntries(referencedCandidatePluginIds.map((pluginId) => [
            pluginId,
            getUserConfigurableArguments(getPluginArguments(pluginId))
        ]));
    }, [getPluginArguments, referencedCandidatePluginIds]);

    const selectedTeamClusterId = useMemo(() => {
        return resolvePluginExecutionClusterId(
            pluginNodeData.selectedTeamClusterId ?? selectedPlugin?.teamCluster,
            executionTeamClusters
        );
    }, [executionTeamClusters, pluginNodeData.selectedTeamClusterId, selectedPlugin?.teamCluster]);
    const normalizedSelectedTimesteps = useMemo(() => {
        return normalizeSelectedTimesteps(pluginNodeData.selectedTimesteps, availableTimesteps);
    }, [availableTimesteps, pluginNodeData.selectedTimesteps]);

    const autocompleteOptions = useMemo<FormFieldAutocompleteOption[]>(() => {
        return nodeReferenceOptions.map((option) => ({
            value: option.value,
            label: option.label
        }));
    }, [nodeReferenceOptions]);

    const buildPluginNodeData = useCallback((overrides: Partial<IPluginNodeData> = {}): IPluginNodeData => {
        return {
            executionMode,
            outputPathMode,
            pluginId: selectedPluginId,
            argumentReference: selectedArgumentReference,
            selectedTeamClusterId,
            selectedTimesteps: normalizedSelectedTimesteps,
            config: pluginNodeData.config ?? {},
            configByPluginId: pluginNodeData.configByPluginId ?? {},
            ...overrides
        };
    }, [
        executionMode,
        normalizedSelectedTimesteps,
        outputPathMode,
        pluginNodeData.config,
        pluginNodeData.configByPluginId,
        selectedArgumentReference,
        selectedPluginId,
        selectedTeamClusterId
    ]);

    const updatePluginNodeData = useCallback((nextData: IPluginNodeData) => {
        updateNodeData(node.id, {
            pluginNode: nextData
        });
    }, [node.id, updateNodeData]);

    const handleExecutionModeChange = useCallback((_: string, value: string | number | boolean) => {
        const nextExecutionMode = value === PluginNodeExecutionMode.ARGUMENT_REFERENCE
            ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
            : PluginNodeExecutionMode.MANUAL;

        updatePluginNodeData({
            ...buildPluginNodeData({
                executionMode: nextExecutionMode
            })
        });
    }, [buildPluginNodeData, updatePluginNodeData]);

    const handleOutputPathModeChange = useCallback((_: string, value: string | number | boolean) => {
        updatePluginNodeData(buildPluginNodeData({
            outputPathMode: value === PluginNodeOutputPathMode.PARENT
                ? PluginNodeOutputPathMode.PARENT
                : PluginNodeOutputPathMode.ISOLATED
        }));
    }, [buildPluginNodeData, updatePluginNodeData]);

    const handlePluginChange = useCallback((_: string, value: string | number | boolean) => {
        const nextPluginId = typeof value === 'string' ? value : String(value);
        updatePluginNodeData(buildPluginNodeData({
            pluginId: nextPluginId,
            config: {}
        }));
    }, [buildPluginNodeData, updatePluginNodeData]);

    const handleArgumentReferenceChange = useCallback((_: string, value: string | number | boolean) => {
        const nextArgumentReference = typeof value === 'string' ? value : String(value);
        updatePluginNodeData(buildPluginNodeData({
            argumentReference: nextArgumentReference
        }));
    }, [buildPluginNodeData, updatePluginNodeData]);

    const handleConfigChange = useCallback((key: string, value: unknown) => {
        updatePluginNodeData(buildPluginNodeData({
            config: {
                ...(pluginNodeData.config ?? {}),
                [key]: value
            }
        }));
    }, [buildPluginNodeData, pluginNodeData.config, updatePluginNodeData]);

    const createConfigByPluginIdChangeHandler = useCallback((pluginId: string) => {
        return (key: string, value: unknown) => {
            updatePluginNodeData(buildPluginNodeData({
                configByPluginId: {
                    ...(pluginNodeData.configByPluginId ?? {}),
                    [pluginId]: {
                        ...((pluginNodeData.configByPluginId ?? {})[pluginId] ?? {}),
                        [key]: value
                    }
                }
            }));
        };
    }, [buildPluginNodeData, pluginNodeData.configByPluginId, updatePluginNodeData]);

    const handleSelectedTimestepsChange = useCallback((selectedTimesteps?: number[]) => {
        updatePluginNodeData(buildPluginNodeData({
            selectedTimesteps: normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps)
        }));
    }, [availableTimesteps, buildPluginNodeData, updatePluginNodeData]);

    const handleSelectedClusterIdChange = useCallback((value: string | number | boolean) => {
        updatePluginNodeData(buildPluginNodeData({
            selectedTeamClusterId: typeof value === 'string' ? value : String(value)
        }));
    }, [buildPluginNodeData, updatePluginNodeData]);

    const renderInlineExecutionFields = () => (
        <PluginExecutionConfigFields
            argumentsDefinitions={[]}
            configValues={{}}
            onConfigChange={() => {}}
            availableTimesteps={availableTimesteps}
            selectedTimesteps={normalizedSelectedTimesteps}
            onSelectedTimestepsChange={handleSelectedTimestepsChange}
            selectedTeamClusterId={selectedTeamClusterId}
            teamClusterOptions={teamClusterOptions}
            onSelectedTeamClusterIdChange={handleSelectedClusterIdChange}
            frameOptions={frameOptions}
            noClustersMessage='No team clusters available for inline execution'
        />
    );

    const renderArgumentReferenceConfiguration = () => {
        if (!selectedArgumentCandidate) {
            return (
                <div >
                    <Text as='p' size='sm' tone='muted'>
                        Select a plugin reference argument to configure runtime execution.
                    </Text>
                </div>
            );
        }

        const usesSelectionConfig = selectedArgumentCandidate.pluginReferenceDefinitions.some((definition) => {
            return definition.showPluginConfiguration === true;
        });

        if (usesSelectionConfig) {
            return (
                <Stack gap='05'>
                    <Text as='p' size='sm' tone='muted'>
                        Runtime execution will use the plugin configuration provided by the user through the selected argument.
                    </Text>
                    {renderInlineExecutionFields()}
                </Stack>
            );
        }

        if (referencedCandidatePluginIds.length === 0) {
            return (
                <div >
                    <Text as='p' size='sm' tone='muted'>
                        This argument does not expose any candidate plugins for manual configuration.
                    </Text>
                </div>
            );
        }

        return (
            <Stack gap='05'>
                <Text as='p' size='sm' tone='muted'>
                    Manual fallback configuration will be used for whichever referenced plugin the user selects.
                </Text>
                {referencedCandidatePluginIds.map((pluginId) => {
                    const pluginLabel = publishedPluginsById[pluginId]?.modifier?.name?.trim() || pluginId;
                    const configDefinitions = referencedPluginConfigDefinitions[pluginId] ?? [];

                    return (
                        <FormSection
                            key={pluginId}
                            title={pluginLabel}
                        >
                            <ArgumentFieldsRenderer
                                arguments={configDefinitions}
                                values={(pluginNodeData.configByPluginId ?? {})[pluginId] ?? {}}
                                onChange={createConfigByPluginIdChangeHandler(pluginId)}
                                frameOptions={frameOptions}
                                emptyMessage='No arguments for selected plugin.'
                                autocompleteOptions={autocompleteOptions}
                                allowTemplateReferenceMode
                            />
                        </FormSection>
                    );
                })}
                {renderInlineExecutionFields()}
            </Stack>
        );
    };

    return (
        <>
            <FormSection title='Plugin Reference'>
                <FormFieldRHF
                    variant='inline'
                    label='Mode'
                    fieldType='select'
                    fieldKey={`plugin-node-mode-${node.id}`}
                    fieldValue={executionMode}
                    options={EXECUTION_MODE_OPTIONS}
                    onFieldChange={handleExecutionModeChange}
                />

                {executionMode === PluginNodeExecutionMode.MANUAL ? (
                    <>
                        <FormFieldRHF
                            variant='inline'
                            label='Published Plugin'
                            fieldType='select'
                            fieldKey={`plugin-node-plugin-${node.id}`}
                            fieldValue={selectedPluginId}
                            options={pluginOptions}
                            onFieldChange={handlePluginChange}
                        />
                        {selectedPlugin && (
                            <Text as='p' size='sm' tone='muted'>
                                {selectedPlugin.modifier?.description?.trim() || 'Published plugin selected for inline execution.'}
                            </Text>
                        )}
                    </>
                ) : (
                    <>
                        <FormFieldRHF
                            variant='inline'
                            label='Argument'
                            fieldType='select'
                            fieldKey={`plugin-node-argument-${node.id}`}
                            fieldValue={selectedArgumentReference}
                            options={argumentReferenceOptions}
                            onFieldChange={handleArgumentReferenceChange}
                        />
                        {selectedArgumentCandidate && (
                            <Text as='p' size='sm' tone='muted'>
                                {selectedArgumentCandidate.supportsMultipleExecutions
                                    ? 'This argument can resolve one or more plugins at runtime.'
                                    : 'This argument resolves a single plugin at runtime.'}
                            </Text>
                        )}
                    </>
                )}
                <FormFieldRHF
                    variant='inline'
                    label='Output'
                    fieldType='select'
                    fieldKey={`plugin-node-output-${node.id}`}
                    fieldValue={outputPathMode}
                    options={OUTPUT_PATH_MODE_OPTIONS}
                    onFieldChange={handleOutputPathModeChange}
                />
            </FormSection>

            <FormSection title='Runtime Configuration'>
                {executionMode === PluginNodeExecutionMode.MANUAL ? (
                    selectedPluginId ? (
                        <PluginExecutionConfigFields
                            argumentsDefinitions={manualArgumentsDefinitions}
                            configValues={pluginNodeData.config ?? {}}
                            onConfigChange={handleConfigChange}
                            availableTimesteps={availableTimesteps}
                            selectedTimesteps={normalizedSelectedTimesteps}
                            onSelectedTimestepsChange={handleSelectedTimestepsChange}
                            selectedTeamClusterId={selectedTeamClusterId}
                            teamClusterOptions={teamClusterOptions}
                            onSelectedTeamClusterIdChange={handleSelectedClusterIdChange}
                            autocompleteOptions={autocompleteOptions}
                            frameOptions={frameOptions}
                            noClustersMessage='No team clusters available for inline execution'
                            allowTemplateReferenceMode
                        />
                    ) : (
                        <div >
                            <Text as='p' size='sm' tone='muted'>
                                Select a published plugin to configure inline execution.
                            </Text>
                        </div>
                    )
                ) : renderArgumentReferenceConfiguration()}
            </FormSection>
        </>
    );
};

export default PluginNodeEditor;
