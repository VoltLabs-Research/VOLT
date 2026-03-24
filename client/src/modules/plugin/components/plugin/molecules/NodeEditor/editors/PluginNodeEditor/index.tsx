import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
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
import type { IPluginNodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/entities/plugin/team-cluster';
import type { EditorProps } from '../types';
import type { FormFieldAutocompleteOption } from '@/shared/presentation/components/FormFieldRHF';
import type { SelectOption } from '@/shared/presentation/components/Select';

const PluginNodeEditor = ({ node }: EditorProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { searchParams } = useSearchParamsState();
    const currentPluginId = searchParams.get('id') ?? '';
    const updateNodeData = usePluginBuilderStore((state) => state.updateNodeData);
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

    const selectedPluginId = pluginNodeData.pluginId ?? '';
    const selectedPlugin = selectedPluginId ? publishedPluginsById[selectedPluginId] : undefined;
    const argumentsDefinitions = useMemo(() => {
        if (!selectedPluginId) {
            return [];
        }

        return getPluginArguments(selectedPluginId).filter((argument) => argument.value === undefined);
    }, [getPluginArguments, selectedPluginId]);

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

    const updatePluginNodeData = useCallback((nextData: IPluginNodeData) => {
        updateNodeData(node.id, {
            pluginNode: nextData
        });
    }, [node.id, updateNodeData]);

    const handlePluginChange = useCallback((_: string, value: string | number | boolean) => {
        const nextPluginId = typeof value === 'string' ? value : String(value);
        updatePluginNodeData({
            pluginId: nextPluginId,
            selectedTeamClusterId,
            selectedTimesteps: normalizedSelectedTimesteps,
            config: {}
        });
    }, [normalizedSelectedTimesteps, selectedTeamClusterId, updatePluginNodeData]);

    const handleConfigChange = useCallback((key: string, value: unknown) => {
        updatePluginNodeData({
            ...pluginNodeData,
            pluginId: selectedPluginId,
            selectedTeamClusterId,
            config: {
                ...(pluginNodeData.config ?? {}),
                [key]: value
            }
        });
    }, [pluginNodeData, selectedPluginId, selectedTeamClusterId, updatePluginNodeData]);

    const handleSelectedTimestepsChange = useCallback((selectedTimesteps?: number[]) => {
        updatePluginNodeData({
            ...pluginNodeData,
            pluginId: selectedPluginId,
            selectedTeamClusterId,
            selectedTimesteps: normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps),
            config: pluginNodeData.config ?? {}
        });
    }, [availableTimesteps, pluginNodeData, selectedPluginId, selectedTeamClusterId, updatePluginNodeData]);

    const handleSelectedClusterIdChange = useCallback((value: string | number | boolean) => {
        updatePluginNodeData({
            ...pluginNodeData,
            pluginId: selectedPluginId,
            selectedTeamClusterId: typeof value === 'string' ? value : String(value),
            selectedTimesteps: normalizedSelectedTimesteps,
            config: pluginNodeData.config ?? {}
        });
    }, [normalizedSelectedTimesteps, pluginNodeData, selectedPluginId, updatePluginNodeData]);

    return (
        <>
            <CollapsibleSection title='Plugin Reference' defaultExpanded>
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
            </CollapsibleSection>

            <CollapsibleSection title='Runtime Configuration' defaultExpanded>
                {selectedPluginId ? (
                    <PluginExecutionConfigFields
                        argumentsDefinitions={argumentsDefinitions}
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
                    />
                ) : (
                    <Container>
                        <Paragraph className='font-size-1 color-muted'>
                            Select a published plugin to configure inline execution.
                        </Paragraph>
                    </Container>
                )}
            </CollapsibleSection>
        </>
    );
};

export default PluginNodeEditor;
