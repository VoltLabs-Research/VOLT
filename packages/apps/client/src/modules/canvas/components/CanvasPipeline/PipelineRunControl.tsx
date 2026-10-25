import { useCanvasPipelineStore, useStages, isOrderedPipelineStage, stageTypeToPipelineKind } from '../../store/canvas-pipeline';
import { useExecutePipelineMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utils/plugin-team-clusters';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { usePendingPluginExecutionsStore } from '../../store/use-pending-plugin-executions-store';
import { useEditorStore } from '../../store/editor';
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import { useTimelineTabRequestStore } from '../../store/use-timeline-tab-request-store';
import { TimelineTab } from '../TimelineHeader';
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
import StageEditorLayout from './StageEditorLayout';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Button } from '@heroui/react';
import { sileo } from 'sileo';
import { useMemo, useState } from 'react';
import type {
    AnalysisPluginStageConfig,
    ExpressionSelectStageConfig,
    PipelineStage
} from '../../store/canvas-pipeline';
import type { ExecutePipelineStageInput } from '@volt/contracts/modules/plugin/http';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineRunControlProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    // The pipeline's stage store key; a saved run's key holds only the stages added to it.
    pipelineKey?: string;
    // Set when the stages extend this saved run: they run on its timesteps and cluster.
    run?: PipelineRun;
    // A saved run still computing cannot take new stages yet.
    isRunBusy?: boolean;
    // Parameters changed on the saved run's stages, by index: with any, the run makes a new pipeline.
    stageEdits?: Record<number, Record<string, unknown>>;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    onClose: () => void;
}

const toStagePayload = (stage: PipelineStage): ExecutePipelineStageInput | null => {
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
    pipelineKey = trajectoryId,
    run,
    isRunBusy = false,
    stageEdits,
    currentTimestep,
    canMutateCanvas,
    onClose
}: PipelineRunControlProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { modifiers, pluginsById, getPluginArguments } = usePluginSelectors();
    const executePipelineMutation = useExecutePipelineMutation();
    const markStagesExecuted = useCanvasPipelineStore((s) => s.markStagesExecuted);
    const clearStages = useCanvasPipelineStore((s) => s.clearStages);
    const clearStageEdits = useCanvasPipelineStore((s) => s.clearStageEdits);
    // Every run brings the timeline's Log tab forward so each plugin's output can be followed live.
    const requestTimelineTab = useTimelineTabRequestStore((state) => state.requestTab);
    const { setAnalysisId } = useCanvasUrlState();
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);

    const stages = useStages(pipelineKey);

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

    // A saved run with changed parameters runs again as a new pipeline, on its own timesteps so the
    // stages left as they were are served from cache; without changes, new stages extend it in place.
    const editedCount = Object.keys(stageEdits ?? {}).length;
    const isFork = Boolean(run) && editedCount > 0;
    const savedStagePayloads: ExecutePipelineStageInput[] = isFork && run
        ? [...run.stages]
            .sort((left, right) => left.index - right.index)
            .map((stage) => ({
                kind: stage.kind,
                ...(stage.pluginId ? { pluginId: stage.pluginId } : {}),
                config: stageEdits?.[stage.index] ?? stage.config
            }))
        : [];

    const canExecute = Boolean(
        canMutateCanvas
        && trajectoryId
        && (enabledOrderedStages.length > 0 || isFork)
        && (run ? isFork || !isRunBusy : resolvedClusterId)
        && !executePipelineMutation.isPending
    );

    const pluginStageName = (pluginId: string): string => pluginNameById.get(pluginId) ?? pluginId;

    const handleExecute = async () => {
        if (!trajectoryId) return;

        const stagePayloads = enabledOrderedStages
            .map(toStagePayload)
            .filter((payload): payload is ExecutePipelineStageInput => payload !== null);

        if (stagePayloads.length === 0 && !isFork) {
            sileo.warning({
                title: 'Nothing to run',
                description: 'Enable at least one pipeline stage.'
            });
            return;
        }

        const pluginStages = enabledOrderedStages.filter((stage) => stage.type === 'analysis-plugin');
        const toPrerequisiteStage = (pluginId: string): PrerequisiteStage => ({
            pluginKey: pluginsById[pluginId]?.modifier?.key ?? '',
            pluginName: pluginStageName(pluginId),
            requires: collectRequiredPluginGroups(getPluginArguments(pluginId))
        });
        // A saved run's own plugins come first, so they satisfy what the new stages need.
        const savedPluginIds = [...(run?.stages ?? [])]
            .sort((left, right) => left.index - right.index)
            .flatMap((stage) => stage.kind === 'plugin' && stage.pluginId ? [stage.pluginId] : []);
        const prerequisiteStages: PrerequisiteStage[] = [
            ...savedPluginIds.map(toPrerequisiteStage),
            ...pluginStages.map((stage) => toPrerequisiteStage((stage.config as AnalysisPluginStageConfig).pluginId))
        ];

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
            const { runId, stages } = await executePipelineMutation.mutateAsync(isFork && run
                ? {
                    trajectoryId,
                    teamClusterId: run.computeClusterId ?? undefined,
                    selectedTimesteps: run.selectedTimesteps,
                    timestep: currentTimestep,
                    stages: [...savedStagePayloads, ...stagePayloads]
                }
                : run ? {
                    trajectoryId,
                    pipelineRunId: run._id,
                    timestep: currentTimestep,
                    stages: stagePayloads
                }
                : {
                    trajectoryId,
                    teamClusterId: resolvedClusterId || undefined,
                    selectedTimesteps,
                    timestep: currentTimestep,
                    stages: stagePayloads
                });

            // The added stages, and any changes, now belong to the run that ran them, which lists them itself.
            if (run && pipelineKey) {
                clearStages(pipelineKey);
                clearStageEdits(pipelineKey);
            } else markStagesExecuted(enabledOrderedStages.map((stage) => stage.id), trajectoryId);

            const pendingStore = usePendingPluginExecutionsStore.getState();
            const runTimesteps = run?.selectedTimesteps ?? selectedTimesteps;
            const viewTimestep = (runTimesteps?.includes(currentTimestep ?? Number.NaN) ? currentTimestep : runTimesteps?.[0])
                ?? getNearestTimestep(currentTimestep, availableTimesteps);

            const computedStages = stages.filter((stage) => stage.analysisId !== undefined);
            computedStages.forEach((stage) => {
                pendingStore.register({
                    analysisId: stage.analysisId as string,
                    trajectoryId,
                    runId,
                    pluginName: stage.pluginDisplayName
                        ?? (stage.pluginId ? pluginStageName(stage.pluginId) : 'Analysis'),
                    timestep: viewTimestep,
                    autoSelect: true
                });
            });
            if (computedStages.length > 0) {
                // The run's first stage is selected here rather than on its 'running' event, which can
                // arrive before this response, before the stage is registered, and then selects nothing.
                if (viewTimestep !== undefined) {
                    setCurrentTimestep(viewTimestep);
                }
                setAnalysisId(computedStages[0].analysisId, { replace: true });
                requestTimelineTab(TimelineTab.Log);
            }

            sileo.success({
                title: computedStages.length > 0 ? 'Pipeline is running' : 'Pipeline complete',
                description: computedStages.length > 0
                    ? `${computedStages.length} analysis stage${computedStages.length === 1 ? '' : 's'} computing.`
                    : 'All stages were served from cache.'
            });
            onClose();
        } catch (error) {
            console.error('[PipelineRunControl] Pipeline execution failed', error);
            sileo.error({
                title: 'Failed to run pipeline',
                description: error instanceof Error && error.message ? error.message : 'Please try again.'
            });
        }
    };

    return (
        <StageEditorLayout
            footer={(
                <Button
                    variant='primary'
                    size='sm'
                    fullWidth
                    className='text-xs'
                    isPending={executePipelineMutation.isPending}
                    onPress={() => { void handleExecute(); }}
                    isDisabled={!canExecute}
                >
                    Execute
                </Button>
            )}
        >
            <span className='text-xs text-muted'>
                {isFork
                    ? `Runs as a new pipeline with ${editedCount === 1 ? 'the changed stage' : `${editedCount} changed stages`}. This one stays as it ran, and unchanged stages reuse their results.`
                    : run
                    ? isRunBusy
                        ? 'Wait for this pipeline to finish before running new stages on it.'
                        : `Runs the ${enabledOrderedStages.length} new stage${enabledOrderedStages.length === 1 ? '' : 's'}. The others reuse their saved results.`
                    : `Runs the ${enabledOrderedStages.length} enabled stage${enabledOrderedStages.length === 1 ? '' : 's'} as one pipeline.`}
            </span>

            {!run && !hasTeamClusterOptions && (
                <p className='text-xs text-muted'>
                    No compute cluster is connected to this team. Set one up to run the pipeline.
                </p>
            )}

            {/* A lone cluster is the one the pipeline runs on, so there is nothing to choose. */}
            {!run && teamClusterOptions.length > 1 && (
                <FormFieldRHF
                    label='Cluster'
                    fieldType='select'
                    variant='canvas'
                    fieldKey='pipeline-run-cluster'
                    fieldValue={resolvedClusterId}
                    options={teamClusterOptions}
                    onFieldChange={(_, value) => setSelectedClusterId(String(value))}
                />
            )}

            {!run && (
                <SelectedTimestepsField
                    availableTimesteps={availableTimesteps}
                    selectedTimesteps={selectedTimesteps}
                    onChange={(next) => setSelectedTimesteps(normalizeSelectedTimesteps(next, availableTimesteps))}
                />
            )}
        </StageEditorLayout>
    );
};

export default PipelineRunControl;
