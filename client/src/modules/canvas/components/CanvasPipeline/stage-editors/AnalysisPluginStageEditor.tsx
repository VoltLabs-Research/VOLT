import { useCanvasPipelineStore } from '../../../stores/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useExecutePluginMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { getUserConfigurableArguments } from '@/modules/plugin/utilities/plugin/argument-values';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { extractTrajectoryTimesteps, getNearestTimestep, normalizeSelectedTimesteps } from '../../../utilities/selected-timestep-analysis';
import useTrajectoryCloneFlow from '../../../hooks/use-trajectory-clone-flow';
import usePluginExecution from '../../../hooks/use-plugin-execution';
import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import { Button, Row, Stack, Text } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useCallback, useMemo } from 'react';
import type { PluginExecutionPreflight } from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { AnalysisPluginStageConfig } from '../../../stores/canvas-pipeline';

interface AnalysisPluginStageEditorProps {
    stageId: string;
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const resolveTrajectoryTeamId = (trajectory?: Trajectory | null): string | undefined => {
    if (!trajectory) return undefined;
    if (typeof trajectory.team === 'string') return trajectory.team;
    if (trajectory.team && typeof trajectory.team === 'object' && '_id' in trajectory.team) {
        return (trajectory.team as { _id: string })._id;
    }
    return undefined;
};

/**
 * Editor body for an analysis-plugin pipeline stage. Hosts the plugin argument
 * form + cluster/frame selectors + an explicit Run button. Unlike the client View
 * stages, this dispatches a heavy async cluster job (reusing use-plugin-execution),
 * which bakes an immutable result into the Scene Collection. Run status + the last
 * analysisId are written back onto the stage config. Lifted from the former
 * AnalyzeLauncher modal's config column, scoped to a single stage's pluginId.
 */
const AnalysisPluginStageEditor = ({
    stageId,
    trajectory,
    trajectoryId,
    currentTimestep,
    canMutateCanvas
}: AnalysisPluginStageEditorProps) => {
    const stage = useCanvasPipelineStore((s) =>
        (trajectoryId ? s.byTrajectory[trajectoryId] : undefined)?.find((entry) => entry.id === stageId)
    );
    const updateStageConfig = useCanvasPipelineStore((s) => s.updateStageConfig);

    const config = stage?.config as AnalysisPluginStageConfig | undefined;
    const pluginId = config?.pluginId;

    const { modifiers, getPluginArguments } = usePluginSelectors();
    const selectedTeamId = useSelectedTeamId();
    const executePluginMutation = useExecutePluginMutation();
    const { cloneAndRun } = useTrajectoryCloneFlow();

    const { data: teamClustersResponse } = usePluginTeamClustersQuery(
        { teamId: selectedTeamId ?? '', page: 1, limit: 100 },
        { enabled: !!selectedTeamId }
    );

    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);

    const { executionTeamClusters, teamClusterOptions, hasTeamClusterOptions } =
        usePluginExecutionClusterOptions(teamClustersResponse?.data);

    const trajectoryTeamId = resolveTrajectoryTeamId(trajectory);
    const isForeignTrajectory = Boolean(selectedTeamId && trajectoryTeamId && trajectoryTeamId !== selectedTeamId);

    const selectedModifier = useMemo(() => {
        if (!pluginId) return null;
        return modifiers.find((m) => m.pluginId === pluginId) ?? null;
    }, [pluginId, modifiers]);

    const argValues = useMemo(() => config?.argValues ?? {}, [config?.argValues]);

    const handleConfigChange = useCallback((key: string, value: unknown) => {
        if (!pluginId) return;
        updateStageConfig(
            stageId,
            { argValues: { ...argValues, [key]: value } } as Partial<AnalysisPluginStageConfig>,
            trajectoryId
        );
    }, [argValues, pluginId, stageId, trajectoryId, updateStageConfig]);

    const handleClusterChange = useCallback((value: string | number | boolean) => {
        updateStageConfig(
            stageId,
            { selectedTeamClusterId: typeof value === 'string' ? value : String(value) } as Partial<AnalysisPluginStageConfig>,
            trajectoryId
        );
    }, [stageId, trajectoryId, updateStageConfig]);

    const handleSelectedTimestepsChange = useCallback((selectedTimesteps?: number[]) => {
        updateStageConfig(
            stageId,
            { selectedTimesteps: normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps) } as Partial<AnalysisPluginStageConfig>,
            trajectoryId
        );
    }, [availableTimesteps, stageId, trajectoryId, updateStageConfig]);

    const getSelectedClusterId = useCallback((pluginTeamClusterId?: string | null): string => {
        return resolvePluginExecutionClusterId(
            config?.selectedTeamClusterId ?? pluginTeamClusterId,
            executionTeamClusters
        );
    }, [config?.selectedTeamClusterId, executionTeamClusters]);

    const getSelectedTimesteps = useCallback((): number[] | undefined => {
        if (config?.selectedTimesteps === undefined) {
            const nearest = getNearestTimestep(currentTimestep, availableTimesteps);
            if (nearest === undefined) return undefined;
            return normalizeSelectedTimesteps([nearest], availableTimesteps);
        }
        return normalizeSelectedTimesteps(config.selectedTimesteps, availableTimesteps);
    }, [availableTimesteps, config?.selectedTimesteps, currentTimestep]);

    // use-plugin-execution speaks in a per-pluginId config map and ModifierOption
    // shape; bridge the single-stage state into those structures.
    const pluginConfigs = useMemo(
        () => (pluginId ? { [pluginId]: argValues } : {}),
        [pluginId, argValues]
    );

    const modifierOption = useMemo(() => {
        if (!selectedModifier) return null;
        return {
            modifierId: `plugin:${selectedModifier.pluginId}`,
            title: selectedModifier.name,
            isPlugin: true,
            plugin: selectedModifier.plugin,
            pluginId: selectedModifier.plugin?._id,
            pluginModifierId: selectedModifier.pluginId
        };
    }, [selectedModifier]);

    const { execStates, handleExecutePlugin } = usePluginExecution({
        trajectoryId,
        currentTimestep,
        getPluginArguments,
        getSelectedTeamClusterId: (option) => getSelectedClusterId(option.plugin?.teamCluster),
        executePlugin: executePluginMutation.mutateAsync,
        pluginConfigs,
        getSelectedTimesteps: () => getSelectedTimesteps(),
        beforeExecute: async (option) => {
            if (!isForeignTrajectory || !trajectoryId || !option.pluginModifierId) {
                return { proceed: true };
            }
            const selectedClusterId = getSelectedClusterId(option.plugin?.teamCluster);
            if (!selectedClusterId) throw new Error('Missing team cluster selection');
            await cloneAndRun({
                sourceTrajectoryId: trajectoryId,
                targetClusterId: selectedClusterId,
                intent: {
                    pluginId: option.pluginModifierId,
                    config: argValues,
                    selectedTimesteps: getSelectedTimesteps(),
                    timestep: currentTimestep,
                    targetClusterId: selectedClusterId
                }
            });
            return { proceed: false };
        }
    });

    const getPluginPreflight = useCallback((pluginTeamClusterId?: string | null): PluginExecutionPreflight | undefined => {
        const issues: string[] = [];
        if (!trajectoryId) issues.push('No trajectory is loaded. Open this analysis from a trajectory to run it.');
        if (!hasTeamClusterOptions) {
            issues.push('No compute cluster is connected to this team. Set one up to run analyses.');
        } else if (!getSelectedClusterId(pluginTeamClusterId)) {
            issues.push('Select a compute cluster to run this analysis on.');
        }
        if (issues.length === 0) return undefined;
        return { issues };
    }, [trajectoryId, hasTeamClusterOptions, getSelectedClusterId]);

    const handleRun = useCallback(async () => {
        if (!modifierOption) return;
        updateStageConfig(stageId, { runStatus: 'loading' } as Partial<AnalysisPluginStageConfig>, trajectoryId);
        const ok = await handleExecutePlugin(modifierOption);
        updateStageConfig(stageId, { runStatus: ok ? 'success' : 'error' } as Partial<AnalysisPluginStageConfig>, trajectoryId);
    }, [modifierOption, handleExecutePlugin, stageId, trajectoryId, updateStageConfig]);

    if (!config || !pluginId) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>This analysis stage is misconfigured.</Text>
            </Row>
        );
    }

    if (!selectedModifier) {
        return (
            <Row justify='center'>
                <Text size='sm' tone='muted'>Plugin “{pluginId}” is not available in this team.</Text>
            </Row>
        );
    }

    const args = getUserConfigurableArguments(getPluginArguments(pluginId));
    const selectedClusterId = getSelectedClusterId(selectedModifier.plugin?.teamCluster);
    const frameOptions: SelectOption[] = availableTimesteps.map((t) => ({ value: String(t), title: `t=${t}` }));
    const execState = modifierOption ? (execStates.get(modifierOption.modifierId) ?? undefined) : undefined;

    return (
        <Stack gap='075'>
            <PluginExecutionConfigFields
                argumentsDefinitions={args}
                configValues={argValues}
                onConfigChange={handleConfigChange}
                availableTimesteps={availableTimesteps}
                selectedTimesteps={getSelectedTimesteps()}
                onSelectedTimestepsChange={handleSelectedTimestepsChange}
                selectedTeamClusterId={selectedClusterId}
                teamClusterOptions={teamClusterOptions}
                onSelectedTeamClusterIdChange={handleClusterChange}
                frameOptions={frameOptions}
                preflight={getPluginPreflight(selectedModifier.plugin?.teamCluster)}
            />
            <Button
                variant='solid'
                intent='brand'
                size='sm'
                shape='rounded'
                block
                isLoading={execState === 'loading'}
                onClick={() => { void handleRun(); }}
                disabled={!canMutateCanvas}
            >
                {isForeignTrajectory ? 'Clone & Run' : 'Run'}
            </Button>
        </Stack>
    );
};

export default AnalysisPluginStageEditor;
