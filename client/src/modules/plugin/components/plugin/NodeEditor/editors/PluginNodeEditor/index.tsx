import {
    PluginNodeExecutionMode,
    PluginNodeOutputPathMode
} from '@volt/contracts/modules/plugin/enums';
import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import ArgumentReferenceConfiguration from './ArgumentReferenceConfiguration';
import {
    collectArgumentReferenceCandidates,
    resolveReferencedPluginIds
} from './argument-reference-candidates';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import useNodeReferenceAutocomplete from '@/modules/plugin/hooks/plugin/use-node-reference-autocomplete';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { getUserConfigurableArguments } from '@/modules/plugin/utils/plugin/argument-values';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import FormSection from '@/shared/ui/components/FormSection';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { SelectOption } from '@voltstack/bravais';
import { normalizeSelectedTimesteps } from '@/modules/canvas/utils/selected-timestep-analysis';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utils/plugin-team-clusters';
import { useSearchParams } from 'react-router-dom';
import type { IPluginNodeData } from '@volt/contracts/modules/plugin/workflow';
import type { EditorProps } from '@/modules/plugin/contracts/node-editors';
import type { FormFieldAutocompleteOption } from '@/shared/contracts/form-field';

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
    const {
        executionTeamClusters,
        teamClusterOptions
    } = usePluginExecutionClusterOptions(teamClustersResponse?.data);

    const pluginNodeData: IPluginNodeData = node.data.pluginNode ?? {};
    const executionMode = pluginNodeData.executionMode ?? PluginNodeExecutionMode.MANUAL;
    const outputPathMode = pluginNodeData.outputPathMode ?? PluginNodeOutputPathMode.ISOLATED;
    const config = pluginNodeData.config ?? {};
    const configByPluginId = pluginNodeData.configByPluginId ?? {};

    const availableTimesteps = frames.map((frame) => frame.timestep);
    const frameOptions: SelectOption[] = availableTimesteps.map((timestep) => ({
        value: String(timestep),
        title: `t=${timestep}`
    }));
    const autocompleteOptions: FormFieldAutocompleteOption[] = nodeReferenceOptions.map((option) => ({
        value: option.value,
        label: option.label
    }));

    const selectablePlugins = publishedPlugins.filter((plugin) => plugin._id !== currentPluginId);
    const pluginOptions: SelectOption[] = selectablePlugins.map((plugin) => ({
        value: plugin._id,
        title: plugin.modifier?.name?.trim() || plugin._id
    }));

    const selectedPluginId = pluginNodeData.pluginId ?? '';
    const selectedPlugin = selectedPluginId ? publishedPluginsById[selectedPluginId] : undefined;
    const selectedArgumentReference = pluginNodeData.argumentReference ?? '';
    const argumentReferenceCandidates = collectArgumentReferenceCandidates(nodes);
    const selectedArgumentCandidate = argumentReferenceCandidates.find((candidate) => {
        return candidate.argument.argument === selectedArgumentReference;
    });
    const referencedPluginIds = resolveReferencedPluginIds(selectedArgumentCandidate, selectablePlugins);

    const selectedTeamClusterId = resolvePluginExecutionClusterId(
        pluginNodeData.selectedTeamClusterId ?? selectedPlugin?.teamCluster,
        executionTeamClusters
    );
    const normalizedSelectedTimesteps = normalizeSelectedTimesteps(pluginNodeData.selectedTimesteps, availableTimesteps);

    const patchPluginNodeData = (overrides: Partial<IPluginNodeData>) => {
        updateNodeData(node.id, {
            pluginNode: {
                executionMode,
                outputPathMode,
                pluginId: selectedPluginId,
                argumentReference: selectedArgumentReference,
                selectedTeamClusterId,
                selectedTimesteps: normalizedSelectedTimesteps,
                config,
                configByPluginId,
                ...overrides
            }
        });
    };

    const handleSelectedTimestepsChange = (selectedTimesteps?: number[]) => {
        patchPluginNodeData({
            selectedTimesteps: normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps)
        });
    };

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
            onSelectedTeamClusterIdChange={(value) => patchPluginNodeData({ selectedTeamClusterId: String(value) })}
            frameOptions={frameOptions}
            noClustersMessage='No team clusters available for inline execution'
        />
    );

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
                    onFieldChange={(_, value) => patchPluginNodeData({
                        executionMode: value === PluginNodeExecutionMode.ARGUMENT_REFERENCE
                            ? PluginNodeExecutionMode.ARGUMENT_REFERENCE
                            : PluginNodeExecutionMode.MANUAL
                    })}
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
                            onFieldChange={(_, value) => patchPluginNodeData({
                                pluginId: String(value),
                                config: {}
                            })}
                        />
                        {selectedPlugin && (
                            <p className='text-xs text-muted'>
                                {selectedPlugin.modifier?.description?.trim() || 'Published plugin selected for inline execution.'}
                            </p>
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
                            options={argumentReferenceCandidates.map((candidate) => ({
                                value: candidate.argument.argument,
                                title: candidate.argument.label?.trim() || candidate.argument.argument
                            }))}
                            onFieldChange={(_, value) => patchPluginNodeData({
                                argumentReference: String(value)
                            })}
                        />
                        {selectedArgumentCandidate && (
                            <p className='text-xs text-muted'>
                                {selectedArgumentCandidate.supportsMultipleExecutions
                                    ? 'This argument can resolve one or more plugins at runtime.'
                                    : 'This argument resolves a single plugin at runtime.'}
                            </p>
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
                    onFieldChange={(_, value) => patchPluginNodeData({
                        outputPathMode: value === PluginNodeOutputPathMode.PARENT
                            ? PluginNodeOutputPathMode.PARENT
                            : PluginNodeOutputPathMode.ISOLATED
                    })}
                />
            </FormSection>

            <FormSection title='Runtime Configuration'>
                {executionMode === PluginNodeExecutionMode.MANUAL ? (
                    selectedPluginId ? (
                        <PluginExecutionConfigFields
                            argumentsDefinitions={getUserConfigurableArguments(getPluginArguments(selectedPluginId))}
                            configValues={config}
                            onConfigChange={(key, value) => patchPluginNodeData({
                                config: {
                                    ...config,
                                    [key]: value
                                }
                            })}
                            availableTimesteps={availableTimesteps}
                            selectedTimesteps={normalizedSelectedTimesteps}
                            onSelectedTimestepsChange={handleSelectedTimestepsChange}
                            selectedTeamClusterId={selectedTeamClusterId}
                            teamClusterOptions={teamClusterOptions}
                            onSelectedTeamClusterIdChange={(value) => patchPluginNodeData({ selectedTeamClusterId: String(value) })}
                            autocompleteOptions={autocompleteOptions}
                            frameOptions={frameOptions}
                            noClustersMessage='No team clusters available for inline execution'
                            allowTemplateReferenceMode
                        />
                    ) : (
                        <p className='text-xs text-muted'>
                            Select a published plugin to configure inline execution.
                        </p>
                    )
                ) : (
                    <ArgumentReferenceConfiguration
                        candidate={selectedArgumentCandidate}
                        referencedPluginIds={referencedPluginIds}
                        configByPluginId={configByPluginId}
                        onConfigChange={(pluginId, key, value) => patchPluginNodeData({
                            configByPluginId: {
                                ...configByPluginId,
                                [pluginId]: {
                                    ...(configByPluginId[pluginId] ?? {}),
                                    [key]: value
                                }
                            }
                        })}
                        frameOptions={frameOptions}
                        autocompleteOptions={autocompleteOptions}
                        executionFields={renderInlineExecutionFields()}
                    />
                )}
            </FormSection>
        </>
    );
};

export default PluginNodeEditor;
