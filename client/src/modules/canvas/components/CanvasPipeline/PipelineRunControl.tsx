import { useCanvasPipelineStore, isOrderedPipelineStage, stageTypeToPipelineKind } from '../../stores/canvas-pipeline';
import { useExecutePipelineMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utilities/plugin-team-clusters';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { usePendingPluginExecutionsStore } from '../../stores/use-pending-plugin-executions-store';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    normalizeSelectedTimesteps
} from '../../utilities/selected-timestep-analysis';
import SelectedTimestepsField from '../SelectedTimestepsField';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Button, Stack, Text } from '@voltstack/bravais';
import { sileo } from 'sileo';
import { useCallback, useMemo, useState } from 'react';
import type {
    AnalysisPluginStageConfig,
    PipelineStage,
    PipelineStageKind
} from '../../stores/canvas-pipeline';
import type { PipelineStageInputDTO } from '@/modules/plugin/api/services/plugin-service';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

interface PipelineRunControlProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    onClose: () => void;
}

const toStagePayload = (stage: PipelineStage): PipelineStageInputDTO | null => {
    const kind: PipelineStageKind | null = stageTypeToPipelineKind(stage.type);
    if (!kind) return null;

    if (stage.type === 'analysis-plugin') {
        const config = stage.config as AnalysisPluginStageConfig;
        if (!config.pluginId) return null;
        return { kind, pluginId: config.pluginId, config: config.argValues ?? {} };
    }

    return { kind, config: stage.config as unknown as Record<string, unknown> };
};

/**
 * The pipeline-wide Run control. Collects the ordered ENABLED stages and POSTs
 * them as one pipeline-execution (the client no longer fires one analysis per
 * stage). Cluster + selected-timesteps live here as per-run local state (they are
 * not persisted on any stage). On success it marks the run's stages executed and
 * registers a pending execution per returned analysisId for completion toasts.
 */
const PipelineRunControl = ({
    trajectory,
    trajectoryId,
    currentTimestep,
    canMutateCanvas,
    onClose
}: PipelineRunControlProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { modifiers } = usePluginSelectors();
    const executePipelineMutation = useExecutePipelineMutation();
    const markStagesExecuted = useCanvasPipelineStore((s) => s.markStagesExecuted);

    const stages = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined) ?? []
    );

    const { data: teamClustersResponse } = usePluginTeamClustersQuery(
        { teamId: selectedTeamId ?? '', page: 1, limit: 100 },
        { enabled: !!selectedTeamId }
    );
    const { executionTeamClusters, teamClusterOptions, hasTeamClusterOptions } =
        usePluginExecutionClusterOptions(teamClustersResponse?.data);

    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const pluginNameById = useMemo(
        () => new Map(modifiers.map((m) => [m.pluginId, m.name])),
        [modifiers]
    );

    const [selectedClusterId, setSelectedClusterId] = useState('');
    const [selectedTimesteps, setSelectedTimesteps] = useState<number[] | undefined>(() => {
        const nearest = getNearestTimestep(currentTimestep, availableTimesteps);
        if (nearest === undefined) return undefined;
        return normalizeSelectedTimesteps([nearest], availableTimesteps);
    });

    const resolvedClusterId = resolvePluginExecutionClusterId(selectedClusterId, executionTeamClusters);

    const enabledOrderedStages = useMemo(
        () => stages.filter((stage) => isOrderedPipelineStage(stage) && stage.enabled),
        [stages]
    );

    const handleSelectedTimestepsChange = useCallback((next?: number[]) => {
        setSelectedTimesteps(normalizeSelectedTimesteps(next, availableTimesteps));
    }, [availableTimesteps]);

    const canExecute = Boolean(
        canMutateCanvas
        && trajectoryId
        && enabledOrderedStages.length > 0
        && resolvedClusterId
        && !executePipelineMutation.isPending
    );

    const handleExecute = useCallback(async () => {
        if (!trajectoryId) return;

        const stagePayloads = enabledOrderedStages
            .map(toStagePayload)
            .filter((payload): payload is PipelineStageInputDTO => payload !== null);

        if (stagePayloads.length === 0) {
            sileo.warning({ title: 'Nothing to run', description: 'Enable at least one pipeline stage.' });
            return;
        }

        try {
            const { analysisIds } = await executePipelineMutation.mutateAsync({
                trajectoryId,
                teamClusterId: resolvedClusterId || undefined,
                selectedTimesteps,
                timestep: currentTimestep,
                stages: stagePayloads
            });

            markStagesExecuted(enabledOrderedStages.map((stage) => stage.id), trajectoryId);

            const pluginStageNames = enabledOrderedStages
                .filter((stage) => stage.type === 'analysis-plugin')
                .map((stage) => {
                    const pluginId = (stage.config as AnalysisPluginStageConfig).pluginId;
                    return pluginNameById.get(pluginId) ?? pluginId ?? 'Analysis';
                });

            const pendingStore = usePendingPluginExecutionsStore.getState();
            const viewTimestep = selectedTimesteps?.[0]
                ?? getNearestTimestep(currentTimestep, availableTimesteps);
            analysisIds.forEach((analysisId, index) => {
                pendingStore.register({
                    analysisId,
                    trajectoryId,
                    pluginName: pluginStageNames[index] ?? 'Analysis',
                    timestep: viewTimestep,
                    // Auto-select only the last computed result so completion toasts
                    // don't fight over which scene to focus.
                    autoSelect: index === analysisIds.length - 1
                });
            });

            sileo.success({
                title: analysisIds.length > 0 ? 'Pipeline is running' : 'Pipeline complete',
                description: analysisIds.length > 0
                    ? `${analysisIds.length} analysis stage${analysisIds.length === 1 ? '' : 's'} computing.`
                    : 'All stages were served from cache.'
            });
            onClose();
        } catch {
            sileo.error({ title: 'Failed to run pipeline', description: 'Please try again.' });
        }
    }, [
        trajectoryId, enabledOrderedStages, executePipelineMutation, resolvedClusterId,
        selectedTimesteps, currentTimestep, markStagesExecuted, pluginNameById,
        availableTimesteps, onClose
    ]);

    return (
        <Stack gap='075' className='canvas-pipeline-run'>
            <Text size='xs' tone='muted'>
                Runs the {enabledOrderedStages.length} enabled stage{enabledOrderedStages.length === 1 ? '' : 's'} as one pipeline.
            </Text>

            {hasTeamClusterOptions ? (
                <FormFieldRHF
                    label='Cluster'
                    fieldType='select'
                    variant='canvas'
                    fieldKey='pipeline-run-cluster'
                    fieldValue={resolvedClusterId}
                    options={teamClusterOptions}
                    onFieldChange={(_, value) => setSelectedClusterId(String(value))}
                />
            ) : (
                <Text as='p' size='sm' tone='muted'>
                    No compute cluster is connected to this team. Set one up to run the pipeline.
                </Text>
            )}

            <SelectedTimestepsField
                availableTimesteps={availableTimesteps}
                selectedTimesteps={selectedTimesteps}
                onChange={handleSelectedTimestepsChange}
            />

            <Button
                variant='solid'
                intent='brand'
                size='sm'
                shape='rounded'
                block
                isLoading={executePipelineMutation.isPending}
                onClick={() => { void handleExecute(); }}
                disabled={!canExecute}
            >
                Execute
            </Button>
        </Stack>
    );
};

export default PipelineRunControl;
