import {
    ArgumentType,
    NodeType,
    PluginNodeExecutionMode,
    PluginStatus
} from '@/modules/plugin/api/entities/plugin/workflow-enums';
import ArgumentFieldsRenderer from '@/modules/plugin/components/plugin/molecules/ArgumentFieldsRenderer';
import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/molecules/PluginExecutionConfigFields';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Container from '@/shared/presentation/components/Container';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Paragraph from '@/shared/presentation/components/Paragraph';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { normalizeSelectedTimesteps } from '@/modules/canvas/utilities/selected-timestep-analysis';
import { resolvePluginExecutionClusterId, supportsPluginExecutionCluster } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useCallback, useMemo } from 'react';
import type {
    IArgumentDefinition,
    IPluginNodeData
} from '@/modules/plugin/api/entities/plugin/workflow';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/entities/plugin/team-cluster';
import type { EditorProps } from '../types';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

const EXECUTION_MODE_OPTIONS = [{
    value: PluginNodeExecutionMode.MANUAL,
    title: 'Manual'
}, {
    value: PluginNodeExecutionMode.ARGUMENT_REFERENCE,
    title: 'Run from arguments reference'
}];

const PluginNodeEditor = ({ node }: EditorProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { searchParams } = useSearchParamsState();
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
    const availableTimesteps = useMemo(() => {
        return frames.map((frame) => frame.timestep);
    }, [frames]);
    const executionTeamClusters = useMemo<PluginTeamClusterOption[]>(() => {
        return (teamClustersResponse?.data ?? []).filter(supportsPluginExecutionCluster);
    }, [teamClustersResponse?.data]);

    const teamClusterOptions = useMemo<SelectOption[]>(() => {
        return executionTeamClusters.map((teamCluster) => ({
            value: teamCluster._id,
            title: teamCluster.name
        }));
    }, [executionTeamClusters]);

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

    const argumentReferenceDefinitions = useMemo<IArgumentDefinition[]>(() => {
        const argumentsNode = nodes.find((candidate) => candidate.type === NodeType.ARGUMENTS);
        const definitions = argumentsNode?.data.arguments?.arguments ?? [];

        return definitions.filter((argument) => argument.type === ArgumentType.PLUGIN_REFERENCE);
    }, [nodes]);

    const argumentReferenceOptions = useMemo<SelectOption[]>(() => {
        return argumentReferenceDefinitions
            .filter((argument) => argument.argument.trim().length > 0)
            .map((argument) => ({
                value: argument.argument,
                title: argument.label?.trim() || argument.argument
            }));
    }, [argumentReferenceDefinitions]);

    const argumentReferenceDefinitionsByKey = useMemo(() => {
        return Object.fromEntries(argumentReferenceDefinitions.map((argument) => [argument.argument, argument]));
    }, [argumentReferenceDefinitions]);

    const selectedPluginId = pluginNodeData.pluginId ?? '';
    const selectedPlugin = selectedPluginId ? publishedPluginsById[selectedPluginId] : undefined;
    const selectedArgumentReference = pluginNodeData.argumentReference ?? '';
    const selectedArgumentDefinition = selectedArgumentReference
        ? argumentReferenceDefinitionsByKey[selectedArgumentReference]
        : undefined;
    const manualArgumentsDefinitions = useMemo(() => {
        if (!selectedPluginId) {
            return [];
        }

        return getPluginArguments(selectedPluginId).filter((argument) => argument.value === undefined);
    }, [getPluginArguments, selectedPluginId]);

    const referencedCandidatePluginIds = useMemo(() => {
        if (!selectedArgumentDefinition) {
            return [];
        }

        if (selectedArgumentDefinition.pluginReferenceFilter?.length) {
            return selectedArgumentDefinition.pluginReferenceFilter;
        }

        return pluginOptions.map((option) => option.value);
    }, [pluginOptions, selectedArgumentDefinition]);

    const referencedPluginConfigDefinitions = useMemo(() => {
        return Object.fromEntries(referencedCandidatePluginIds.map((pluginId) => [
            pluginId,
            getPluginArguments(pluginId).filter((argument) => argument.value === undefined)
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

    const renderArgumentReferenceConfiguration = () => {
        if (!selectedArgumentDefinition) {
            return (
                <Container>
                    <Paragraph className='font-size-1 color-muted'>
                        Select a plugin reference argument to configure runtime execution.
                    </Paragraph>
                </Container>
            );
        }

        if (selectedArgumentDefinition.showPluginConfiguration) {
            return (
                <Container className='d-flex column gap-05'>
                    <Paragraph className='font-size-1 color-muted'>
                        Runtime execution will use the plugin configuration provided by the user through the selected argument.
                    </Paragraph>
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
                </Container>
            );
        }

        if (referencedCandidatePluginIds.length === 0) {
            return (
                <Container>
                    <Paragraph className='font-size-1 color-muted'>
                        This argument does not expose any candidate plugins for manual configuration.
                    </Paragraph>
                </Container>
            );
        }

        return (
            <Container className='d-flex column gap-05'>
                <Paragraph className='font-size-1 color-muted'>
                    Manual fallback configuration will be used for whichever referenced plugin the user selects.
                </Paragraph>
                {referencedCandidatePluginIds.map((pluginId, index) => {
                    const pluginLabel = publishedPluginsById[pluginId]?.modifier?.name?.trim() || pluginId;
                    const configDefinitions = referencedPluginConfigDefinitions[pluginId] ?? [];

                    return (
                        <CollapsibleSection
                            key={pluginId}
                            title={pluginLabel}
                            defaultExpanded={index === 0}
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
                        </CollapsibleSection>
                    );
                })}
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
            </Container>
        );
    };

    return (
        <>
            <CollapsibleSection title='Plugin Reference' defaultExpanded>
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
                            <Paragraph className='font-size-1 color-muted'>
                                {selectedPlugin.modifier?.description?.trim() || 'Published plugin selected for inline execution.'}
                            </Paragraph>
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
                        {selectedArgumentDefinition && (
                            <Paragraph className='font-size-1 color-muted'>
                                {selectedArgumentDefinition.multipleSelection
                                    ? 'This argument can resolve one or more plugins at runtime.'
                                    : 'This argument resolves a single plugin at runtime.'}
                            </Paragraph>
                        )}
                    </>
                )}
            </CollapsibleSection>

            <CollapsibleSection title='Runtime Configuration' defaultExpanded>
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
                        <Container>
                            <Paragraph className='font-size-1 color-muted'>
                                Select a published plugin to configure inline execution.
                            </Paragraph>
                        </Container>
                    )
                ) : renderArgumentReferenceConfiguration()}
            </CollapsibleSection>
        </>
    );
};

export default PluginNodeEditor;
