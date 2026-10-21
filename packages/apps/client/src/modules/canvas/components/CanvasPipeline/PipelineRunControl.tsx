import { useCanvasPipelineStore, isOrderedPipelineStage, stageTypeToPipelineKind } from '../../store/canvas-pipeline';
import { useExecutePipelineMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utils/plugin-team-clusters';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useIsWasmCanvas } from '@/modules/canvas-wasm/use-is-wasm-canvas';
import { useWasmCanvasStore } from '@/modules/canvas-wasm/store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useEditorStore } from '../../store/editor';
import { usePendingPluginExecutionsStore } from '../../store/use-pending-plugin-executions-store';
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
import useCanvasUrlState from '../../hooks/use-canvas-url-state';
import type {
    AnalysisPluginStageConfig,
    ExpressionSelectStageConfig,
    PipelineStage
} from '../../store/canvas-pipeline';
import type { ExecutePipelineStageInput } from '@volt/contracts/modules/plugin/http';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineRunControlProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
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
    currentTimestep,
    canMutateCanvas,
    onClose
}: PipelineRunControlProps) => {
    const selectedTeamId = useSelectedTeamId();
    const isWasmCanvas = useIsWasmCanvas();
    const { modifiers, pluginsById, getPluginArguments } = usePluginSelectors();
    const executePipelineMutation = useExecutePipelineMutation();
    const markStagesExecuted = useCanvasPipelineStore((s) => s.markStagesExecuted);
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const wasmRunning = useWasmCanvasStore((state) => state.isRunning);
    const { setAnalysisId } = useCanvasUrlState();
    // Every run brings the timeline's Log tab forward so each plugin's output can be followed live.
    const requestTimelineTab = useTimelineTabRequestStore((state) => state.requestTab);

    const stages = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined) ?? []
    );

    const { data: teamClustersResponse } = usePluginTeamClustersQuery(
        {
            teamId: selectedTeamId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: !!selectedTeamId && !isWasmCanvas }
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

    const canExecute = Boolean(
        canMutateCanvas
        && trajectoryId
        && enabledOrderedStages.length > 0
        && (isWasmCanvas || resolvedClusterId)
        && !executePipelineMutation.isPending
        && !wasmRunning
    );

    const pluginStageName = (pluginId: string): string => pluginNameById.get(pluginId) ?? pluginId;

    // /canvas/wasm: the same stages run one after another in this tab (see canvas-wasm/run-pipeline.ts).
    const executeInBrowser = async (pluginStages: PipelineStage[]) => {
        if (!trajectoryId) return;
        const stagesToRun = pluginStages.map((stage) => {
            const { pluginId, argValues } = stage.config as AnalysisPluginStageConfig;
            return { plugin: pluginsById[pluginId], config: argValues };
        }).filter((stage): stage is { plugin: NonNullable<typeof stage.plugin>; config: Record<string, unknown> } => (
            Boolean(stage.plugin)
        ));
        const timesteps = selectedTimesteps ?? availableTimesteps;

        const { analyses, failures, firstFailure, cancelled } = await useWasmCanvasStore.getState().runPipeline({
            stages: stagesToRun,
            timesteps,
            selectedTimesteps,
            onStarted: (started) => {
                // The last stage stays selected; while earlier stages run, the Log follows whichever
                // plugin and frame is executing (useCanvasAnalysisStatus.getLiveLogTarget).
                markStagesExecuted(enabledOrderedStages.map((stage) => stage.id), trajectoryId);
                if (currentTimestep === undefined || !timesteps.includes(currentTimestep)) {
                    setCurrentTimestep(timesteps[0]);
                }
                setAnalysisId(started[started.length - 1]?._id, { replace: true });
                requestTimelineTab(TimelineTab.Log);
                onClose();
            }
        });

        // Another trajectory was opened meanwhile; there is nothing of this run left to show.
        if (cancelled) return;
        if (firstFailure) {
            // Leave the Log on the plugin that failed, not on a later stage that was only skipped.
            setAnalysisId(firstFailure.analysisId, { replace: true });
            setCurrentTimestep(firstFailure.timestep);
        }
        if (failures.length > 0) {
            sileo.error({
                title: `${failures.length} plugin run${failures.length === 1 ? '' : 's'} failed`,
                description: failures[0]
            });
            return;
        }
        sileo.success({
            title: 'Pipeline complete',
            description: `${analyses.length} analysis stage${analyses.length === 1 ? '' : 's'} on ${timesteps.length} frame${timesteps.length === 1 ? '' : 's'} ran in this tab.`
        });
    };

    const handleExecute = async () => {
        if (!trajectoryId) return;

        const stagePayloads = enabledOrderedStages
            .map(toStagePayload)
            .filter((payload): payload is ExecutePipelineStageInput => payload !== null);

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
            if (isWasmCanvas) {
                await executeInBrowser(pluginStages);
                return;
            }

            const { stages } = await executePipelineMutation.mutateAsync({
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

            const computedStages = stages.filter((stage) => stage.analysisId !== undefined);
            computedStages.forEach((stage) => {
                pendingStore.register({
                    analysisId: stage.analysisId as string,
                    trajectoryId,
                    pluginName: stage.pluginDisplayName
                        ?? (stage.pluginId ? pluginStageName(stage.pluginId) : 'Analysis'),
                    timestep: viewTimestep,
                    autoSelect: true
                });
            });
            if (computedStages.length > 0) {
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
                    isPending={executePipelineMutation.isPending || wasmRunning}
                    onPress={() => { void handleExecute(); }}
                    isDisabled={!canExecute}
                >
                    Execute
                </Button>
            )}
        >
            <span className='text-xs text-muted'>
                Runs the {enabledOrderedStages.length} enabled stage{enabledOrderedStages.length === 1 ? '' : 's'} as one pipeline.
            </span>

            {isWasmCanvas ? (
                <p className='text-xs text-muted'>
                    Runs the selected WASM plugins in this tab. No compute cluster is used.
                </p>
            ) : hasTeamClusterOptions ? (
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
        </StageEditorLayout>
    );
};

export default PipelineRunControl;
