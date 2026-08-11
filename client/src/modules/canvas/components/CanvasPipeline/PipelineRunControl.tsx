import { useCanvasPipelineStore, isOrderedPipelineStage, stageTypeToPipelineKind } from '../../store/canvas-pipeline';
import { useExecutePipelineMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utils/plugin-team-clusters';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { usePendingPluginExecutionsStore } from '../../store/use-pending-plugin-executions-store';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    normalizeSelectedTimesteps
} from '../../utils/selected-timestep-analysis';
import {
    collectRequiredPluginGroups,
    findUnsatisfiedPrerequisites,
    formatPrerequisiteNames,
    type PrerequisiteStage
} from '../../utils/pipeline-prerequisites';
import SelectedTimestepsField from '../SelectedTimestepsField';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { sileo } from 'sileo';
import { useMemo, useState } from 'react';
import type {
    AnalysisPluginStageConfig,
    ExpressionSelectStageConfig,
    PipelineStage
} from '../../store/canvas-pipeline';
import type { PipelineStageInput } from '@/modules/plugin/api/services/plugin-service';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineRunControlProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    onClose: () => void;
}

const toStagePayload = (stage: PipelineStage): PipelineStageInput | null => {
    const kind = stageTypeToPipelineKind(stage.type);
    if (!kind) return null;

    if (stage.type === 'analysis-plugin') {
        const config = stage.config as AnalysisPluginStageConfig;
        return {
            kind,
            pluginId: config.pluginId,
            config: config.argValues
        };
    }

    if (stage.type === 'expression-select') {
        const config = stage.config as ExpressionSelectStageConfig;
        const expression = config.expression.trim();
        // Only the destructive variant runs on the cluster; colouring stays client-side.
        if (!expression || config.action !== 'delete') return null;

        return {
            kind,
            config: { expression: `!(${expression})` }
        };
    }

    return {
        kind,
        config: stage.config as unknown as Record<string, unknown>
    };
};

const PipelineRunControl = ({
    trajectory,
    trajectoryId,
    currentTimestep,
    canMutateCanvas,
    onClose
}: PipelineRunControlProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { modifiers, pluginsById, getPluginArguments } = usePluginSelectors();
    const executePipelineMutation = useExecutePipelineMutation();
    const markStagesExecuted = useCanvasPipelineStore((s) => s.markStagesExecuted);

    const stages = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined) ?? []
    );

    const { data: teamClustersResponse } = usePluginTeamClustersQuery(
        {
            teamId: selectedTeamId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: !!selectedTeamId }
    );
    const { executionTeamClusters, teamClusterOptions, hasTeamClusterOptions } =
        usePluginExecutionClusterOptions(teamClustersResponse?.data);

    // Memoised because a trajectory can carry thousands of timesteps.
    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const pluginNameById = new Map(modifiers.map((m) => [m.pluginId, m.name]));
    const pluginNameByKey = new Map(modifiers
        .map((m) => [m.plugin.modifier?.key, m.name] as const)
        .filter((entry): entry is [string, string] => entry[0] !== undefined));

    const [selectedClusterId, setSelectedClusterId] = useState('');
    const [selectedTimesteps, setSelectedTimesteps] = useState<number[] | undefined>(() => {
        const nearest = getNearestTimestep(currentTimestep, availableTimesteps);
        if (nearest === undefined) return undefined;
        return normalizeSelectedTimesteps([nearest], availableTimesteps);
    });

    const resolvedClusterId = resolvePluginExecutionClusterId(selectedClusterId, executionTeamClusters);
    const enabledOrderedStages = stages.filter((stage) => isOrderedPipelineStage(stage) && stage.enabled);

    const canExecute = Boolean(
        canMutateCanvas
        && trajectoryId
        && enabledOrderedStages.length > 0
        && resolvedClusterId
        && !executePipelineMutation.isPending
    );

    const pluginStageName = (pluginId: string): string => pluginNameById.get(pluginId) ?? pluginId;

    const handleExecute = async () => {
        if (!trajectoryId) return;

        const stagePayloads = enabledOrderedStages
            .map(toStagePayload)
            .filter((payload): payload is PipelineStageInput => payload !== null);

        if (stagePayloads.length === 0) {
            sileo.warning({
                title: 'Nothing to run',
                description: 'Enable at least one pipeline stage.'
            });
            return;
        }

        const pluginStages = enabledOrderedStages.filter((stage) => stage.type === 'analysis-plugin');
        const prerequisiteStages: PrerequisiteStage[] = pluginStages.map((stage) => {
            const { pluginId } = stage.config as AnalysisPluginStageConfig;
            return {
                pluginKey: pluginsById[pluginId]?.modifier?.key ?? '',
                pluginName: pluginStageName(pluginId),
                requires: collectRequiredPluginGroups(getPluginArguments(pluginId))
            };
        });

        const unsatisfied = findUnsatisfiedPrerequisites(prerequisiteStages);
        if (unsatisfied.length > 0) {
            const first = unsatisfied[0];
            sileo.warning({
                title: `${first.pluginName} needs an earlier stage`,
                description: `Add ${formatPrerequisiteNames(first.missing, pluginNameByKey)} before it in the pipeline.`
            });
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

            const pendingStore = usePendingPluginExecutionsStore.getState();
            const viewTimestep = selectedTimesteps?.[0]
                ?? getNearestTimestep(currentTimestep, availableTimesteps);
            analysisIds.forEach((analysisId, index) => {
                const stage = pluginStages[index];
                pendingStore.register({
                    analysisId,
                    trajectoryId,
                    pluginName: stage
                        ? pluginStageName((stage.config as AnalysisPluginStageConfig).pluginId)
                        : 'Analysis',
                    timestep: viewTimestep,
                    autoSelect: true
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
            sileo.error({
                title: 'Failed to run pipeline',
                description: 'Please try again.'
            });
        }
    };

    return (
        <div className='flex flex-col gap-3 canvas-pipeline-run'>
            <span className='text-xs text-muted'>
                Runs the {enabledOrderedStages.length} enabled stage{enabledOrderedStages.length === 1 ? '' : 's'} as one pipeline.
            </span>

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
                <p className='text-xs text-muted'>
                    No compute cluster is connected to this team. Set one up to run the pipeline.
                </p>
            )}

            <SelectedTimestepsField
                availableTimesteps={availableTimesteps}
                selectedTimesteps={selectedTimesteps}
                onChange={(next) => setSelectedTimesteps(normalizeSelectedTimesteps(next, availableTimesteps))}
            />

            <Button
                variant='primary'
                size='sm'
                fullWidth
                isPending={executePipelineMutation.isPending}
                onPress={() => { void handleExecute(); }}
                isDisabled={!canExecute}
            >
                Execute
            </Button>
        </div>
    );
};

export default PipelineRunControl;
