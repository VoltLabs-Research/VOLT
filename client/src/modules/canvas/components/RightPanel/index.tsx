import { buildCanvasModifierOptions, BUILT_IN_MODIFIERS } from '../../utilities/modifier-registry';
import usePluginExecution, { ExecState } from '../../hooks/use-plugin-execution';
import useTrajectoryCloneFlow from '../../hooks/use-trajectory-clone-flow';
import { useTrajectoryCloneFlowStore } from '../../stores/use-trajectory-clone-flow-store';
import { useCanvasFocusStore } from '../../stores/use-canvas-focus-store';
import { useCanvasAccessStore } from '../../api/access/use-canvas-access-store';
import ModifiersSection, { ModifierConfigContent } from '../ModifiersSection';
import ObjectsPanel from '../ObjectsPanel';

import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import { useExecutePluginMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { usePluginExecutionClusterOptions } from '@/modules/plugin/hooks/plugin/use-plugin-execution-cluster-options';
import { getUserConfigurableArguments } from '@/modules/plugin/utilities/plugin/argument-values';
import { resolvePluginExecutionClusterId } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import Box from '@/shared/presentation/primitives/Box';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import useMedia from '@/shared/presentation/hooks/use-media';
import { extractTrajectoryTimesteps, getNearestTimestep, normalizeSelectedTimesteps } from '../../utilities/selected-timestep-analysis';
import { ArrowLeft } from 'lucide-react';
import type { CanvasPanelActionProps } from '../canvas-panel-props';

import type { ModifierOption } from '../../utilities/modifier-registry';
import type { ComponentType, ReactNode } from 'react';
import type { SelectOption } from '@/shared/presentation/primitives/Select';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

import './RightPanel.css';

const BUILT_IN_COMPONENT_MAP = new Map<string, ComponentType<any> | undefined>(
    BUILT_IN_MODIFIERS.map((m) => [m.id, m.component] as const)
);

interface PluginExecutionClusterConfig {
    selectedTeamClusterId?: string;
}

interface RightPanelProps extends CanvasPanelActionProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    compactAnalysisOnly?: boolean;
}

const resolveTrajectoryTeamId = (trajectory?: Trajectory | null): string | undefined => {
    if (!trajectory) {
        return undefined;
    }

    if (typeof trajectory.team === 'string') {
        return trajectory.team;
    }

    if (trajectory.team && typeof trajectory.team === 'object' && '_id' in trajectory.team) {
        return trajectory.team._id;
    }

    return undefined;
};

const RightPanel = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    compactAnalysisOnly = false,
    onDownloadAnalysis,
    onDownloadExposureListing,
    rasterContainerSelections,
    activeRasterContainerId,
    onSetActiveRasterContainer,
    onUpdateRasterContainerSelection
}: RightPanelProps) => {
    const storeCanMutate = useCanvasAccessStore((state) => state.canMutate);
    const canMutate = canMutateCanvas ?? storeCanMutate;
    const usePanelConfigView = useMedia('(max-width: 768px)');
    const selectedTeamId = useSelectedTeamId();
    const executePluginMutation = useExecutePluginMutation();
    const { cloneAndRun } = useTrajectoryCloneFlow();
    const { modifiers, getPluginArguments, isLoading: pluginLoading } = usePluginSelectors();
    const { data: teamClustersResponse } = usePluginTeamClustersQuery({
        teamId: selectedTeamId ?? '',
        page: 1,
        limit: 100
    }, {
        enabled: !!selectedTeamId
    });
    useEnsurePluginCatalogLoaded();
    const focusedModifierId = useCanvasFocusStore((s) => s.focusedModifierId);
    const clearFocusedModifier = useCanvasFocusStore((s) => s.clearFocusedModifier);

    useEffect(() => {
        if (!focusedModifierId) return;

        // Why: wait for layout so the modifier trigger we are targeting is
        // mounted before scrolling it into view. Two RAFs give React a chance
        // to paint the tree.
        const raf1 = window.requestAnimationFrame(() => {
            const raf2 = window.requestAnimationFrame(() => {
                const trigger = document.querySelector<HTMLButtonElement>(
                    `[data-modifier-id="${CSS.escape(focusedModifierId)}"]`
                );
                if (trigger) {
                    trigger.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    trigger.click();
                }
                clearFocusedModifier();
            });
            return () => window.cancelAnimationFrame(raf2);
        });

        return () => window.cancelAnimationFrame(raf1);
    }, [focusedModifierId, clearFocusedModifier]);
    const [pluginConfigs, setPluginConfigs] = useState<Record<string, Record<string, unknown>>>({});
    const [pluginExecutionClusters, setPluginExecutionClusters] = useState<Record<string, PluginExecutionClusterConfig>>({});
    const [pluginSelectedTimesteps, setPluginSelectedTimesteps] = useState<Record<string, number[] | undefined>>({});
    const [activeModifierId, setActiveModifierId] = useState<string | null>(null);

    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const {
        executionTeamClusters,
        teamClusterOptions,
        hasTeamClusterOptions
    } = usePluginExecutionClusterOptions(teamClustersResponse?.data);
    const trajectoryTeamId = resolveTrajectoryTeamId(trajectory);
    const isForeignTrajectory = Boolean(
        selectedTeamId
        && trajectoryTeamId
        && trajectoryTeamId !== selectedTeamId
    );

    const consumeCloneIntent = useTrajectoryCloneFlowStore((state) => state.consumeIntent);
    const removeCloneEntry = useTrajectoryCloneFlowStore((state) => state.removeEntry);

    useEffect(() => {
        if (!trajectoryId || !trajectory || isForeignTrajectory) {
            return;
        }

        const intent = consumeCloneIntent(trajectoryId);
        if (!intent) {
            return;
        }

        executePluginMutation.mutateAsync({
            pluginId: intent.pluginId,
            trajectoryId,
            teamClusterId: intent.targetClusterId,
            config: intent.config,
            selectedTimesteps: intent.selectedTimesteps,
            timestep: intent.timestep
        }).catch(() => {
            removeCloneEntry(trajectoryId);
        }).finally(() => {
            removeCloneEntry(trajectoryId);
        });
    }, [trajectoryId, trajectory, isForeignTrajectory, consumeCloneIntent, executePluginMutation, removeCloneEntry]);

    const handlePluginConfigChange = useCallback((pluginId: string, key: string, value: unknown) => {
        setPluginConfigs((prev) => ({
            ...prev,
            [pluginId]: {
                ...(prev[pluginId] || {}),
                [key]: value
            }
        }));
    }, []);

    const handlePluginSelectedTimestepsChange = useCallback((pluginId: string, selectedTimesteps?: number[]) => {
        const normalizedTimesteps = normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps);

        setPluginSelectedTimesteps((prev) => ({
            ...prev,
            [pluginId]: normalizedTimesteps
        }));
    }, [availableTimesteps]);

    const handlePluginClusterChange = useCallback((pluginId: string, value: string | number | boolean) => {
        setPluginExecutionClusters((prev) => ({
            ...prev,
            [pluginId]: {
                selectedTeamClusterId: typeof value === 'string' ? value : String(value)
            }
        }));
    }, []);

    const getSelectedClusterId = useCallback((pluginId: string, pluginTeamClusterId?: string | null): string => {
        const selectedClusterId = pluginExecutionClusters[pluginId]?.selectedTeamClusterId;
        return resolvePluginExecutionClusterId(
            selectedClusterId ?? pluginTeamClusterId,
            executionTeamClusters
        );
    }, [executionTeamClusters, pluginExecutionClusters]);

    const getSelectedTimesteps = useCallback((pluginId: string): number[] | undefined => {
        if (!(pluginId in pluginSelectedTimesteps)) {
            const nearest = getNearestTimestep(currentTimestep, availableTimesteps);
            if (nearest === undefined) {
                return undefined;
            }
            return normalizeSelectedTimesteps([nearest], availableTimesteps);
        }
        return normalizeSelectedTimesteps(pluginSelectedTimesteps[pluginId], availableTimesteps);
    }, [availableTimesteps, currentTimestep, pluginSelectedTimesteps]);

    useEffect(() => {
        setPluginSelectedTimesteps((prev) => {
            const nextState: Record<string, number[] | undefined> = {};
            let hasChanges = false;

            Object.entries(prev).forEach(([pluginId, selectedTimesteps]) => {
                const normalizedTimesteps = normalizeSelectedTimesteps(selectedTimesteps, availableTimesteps);
                nextState[pluginId] = normalizedTimesteps;

                const previousKey = JSON.stringify(selectedTimesteps ?? []);
                const nextKey = JSON.stringify(normalizedTimesteps ?? []);
                if (previousKey !== nextKey) {
                    hasChanges = true;
                }
            });

            if (!hasChanges) {
                return prev;
            }

            return nextState;
        });
    }, [availableTimesteps]);
    const { execStates, handleExecutePlugin } = usePluginExecution({
        trajectoryId,
        currentTimestep,
        getPluginArguments,
        getSelectedTeamClusterId: (option) => {
            if (!option.pluginModifierId) {
                return '';
            }

            return getSelectedClusterId(option.pluginModifierId, option.plugin?.teamCluster);
        },
        executePlugin: executePluginMutation.mutateAsync,
        pluginConfigs,
        getSelectedTimesteps,
        beforeExecute: async (option) => {
            if (!isForeignTrajectory || !trajectoryId || !option.pluginModifierId) {
                return { proceed: true };
            }

            const selectedClusterId = getSelectedClusterId(
                option.pluginModifierId,
                option.plugin?.teamCluster
            );
            if (!selectedClusterId) {
                throw new Error('Missing team cluster selection');
            }

            await cloneAndRun({
                sourceTrajectoryId: trajectoryId,
                targetClusterId: selectedClusterId,
                intent: {
                    pluginId: option.pluginModifierId,
                    config: pluginConfigs[option.pluginModifierId] ?? {},
                    selectedTimesteps: getSelectedTimesteps(option.pluginModifierId),
                    timestep: currentTimestep,
                    targetClusterId: selectedClusterId
                }
            });

            return { proceed: false };
        }
    });

    const allModifiers = useMemo<ModifierOption[]>(() => buildCanvasModifierOptions(modifiers), [modifiers]);
    const activeModifier = useMemo(() => {
        if (!activeModifierId) {
            return null;
        }

        return allModifiers.find((option) => option.modifierId === activeModifierId) ?? null;
    }, [activeModifierId, allModifiers]);

    useEffect(() => {
        if (!usePanelConfigView && activeModifierId) {
            setActiveModifierId(null);
            return;
        }

        if (activeModifierId && !activeModifier) {
            setActiveModifierId(null);
        }
    }, [activeModifier, activeModifierId, usePanelConfigView]);

    const getExecState = useCallback((option: ModifierOption): ExecState => {
        return execStates.get(option.modifierId) ?? ExecState.Idle;
    }, [execStates]);

    const shouldShowAction = useCallback((option: ModifierOption): boolean => {
        if (option.isPlugin && !hasTeamClusterOptions) {
            return false;
        }

        return option.modifierId !== 'slice-plane';
    }, [hasTeamClusterOptions]);

    const modifierHasContent = useCallback((option: ModifierOption): boolean => {
        if (option.isPlugin && option.pluginModifierId) {
            return true;
        }
        return BUILT_IN_COMPONENT_MAP.has(option.modifierId);
    }, []);

    const handleAction = useCallback((option: ModifierOption) => {
        if (!option.isPlugin) {
            return false;
        }
        return handleExecutePlugin(option);
    }, [handleExecutePlugin]);

    const handleOpenModifierConfig = useCallback((option: ModifierOption) => {
        setActiveModifierId(option.modifierId);
    }, []);

    const handleCloseModifierConfig = useCallback(() => {
        setActiveModifierId(null);
    }, []);

    const renderModifierConfig = useCallback((option: ModifierOption) => {
        let content: ReactNode = null;
        if(option.isPlugin && option.pluginModifierId){
            const args = getUserConfigurableArguments(getPluginArguments(option.pluginModifierId));
            const selectedClusterId = getSelectedClusterId(option.pluginModifierId, option.plugin?.teamCluster);
            const frameOptions: SelectOption[] = availableTimesteps.map((timestep) => ({
                value: String(timestep),
                title: `t=${timestep}`
            }));
            content = (
                <PluginExecutionConfigFields
                    argumentsDefinitions={args}
                    configValues={pluginConfigs[option.pluginModifierId!] ?? {}}
                    onConfigChange={(key, value) => handlePluginConfigChange(option.pluginModifierId!, key, value)}
                    availableTimesteps={availableTimesteps}
                    selectedTimesteps={getSelectedTimesteps(option.pluginModifierId)}
                    onSelectedTimestepsChange={(selectedTimesteps) => handlePluginSelectedTimestepsChange(option.pluginModifierId!, selectedTimesteps)}
                    selectedTeamClusterId={selectedClusterId}
                    teamClusterOptions={teamClusterOptions}
                    onSelectedTeamClusterIdChange={(value) => handlePluginClusterChange(option.pluginModifierId!, value)}
                    frameOptions={frameOptions}
                />
            );
        }else{
            const BuiltInComponent = BUILT_IN_COMPONENT_MAP.get(option.modifierId);
            if(BuiltInComponent){
                content = (
                    <BuiltInComponent
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                    />
                );
            }
        }

        return (
            <Stack gap='05'>
                {content}
            </Stack>
        );
    }, [
        availableTimesteps,
        getPluginArguments,
        getSelectedClusterId,
        getSelectedTimesteps,
        hasTeamClusterOptions,
        trajectoryId,
        analysisId,
        currentTimestep,
        pluginConfigs,
        handlePluginClusterChange,
        handlePluginConfigChange,
        handlePluginSelectedTimestepsChange,
        teamClusterOptions
    ]);

    const pluginsContent = canMutate ? (
        <ModifiersSection
            pluginLoading={pluginLoading}
            modifiers={allModifiers}
            getExecState={getExecState}
            showAction={shouldShowAction}
            hasContent={modifierHasContent}
            isForeignTrajectory={isForeignTrajectory}
            onAction={handleAction}
            onOpenConfig={usePanelConfigView ? handleOpenModifierConfig : undefined}
            renderModifierConfig={renderModifierConfig}
        />
    ) : undefined;

    const activeModifierConfigView = usePanelConfigView && activeModifier ? (
        <Stack
            id={`plugin-config-${activeModifier.modifierId}-panel`}
            height='max'
            minH='0'
            overflow='hidden'
            className='canvas-plugin-config-view'
        >
            <Row shrink='0' className='canvas-plugin-config-view__header'>
                <IconButton
                    variant='ghost'
                    size='sm'
                    className='canvas-plugin-config-view__back'
                    aria-label='Back to canvas panel'
                    title='Back to canvas panel'
                    onClick={handleCloseModifierConfig}
                >
                    <ArrowLeft size={14} aria-hidden='true' />
                </IconButton>
                <Text as='span' size='sm' tone='secondary' truncate className='canvas-plugin-config-view__title'>
                    {activeModifier.title}
                </Text>
            </Row>
            <div className='canvas-plugin-config-view__body'>
                <ModifierConfigContent
                    option={activeModifier}
                    execState={getExecState(activeModifier)}
                    showAction={shouldShowAction(activeModifier)}
                    isForeignTrajectory={isForeignTrajectory}
                    onAction={() => handleAction(activeModifier)}
                    onClose={handleCloseModifierConfig}
                    renderModifierConfig={renderModifierConfig}
                    className='canvas-plugin-panel-config'
                />
            </div>
        </Stack>
    ) : null;

    return (
        <Row height='max' overflow='hidden'>
            <Box width='max' height='max' overflow='hidden'>
                {activeModifierConfigView ?? (
                    <ObjectsPanel
                        trajectory={trajectory}
                        onDownloadAnalysis={onDownloadAnalysis}
                        onDownloadExposureListing={onDownloadExposureListing}
                        rasterContainerSelections={rasterContainerSelections}
                        activeRasterContainerId={activeRasterContainerId}
                        onSetActiveRasterContainer={onSetActiveRasterContainer}
                        onUpdateRasterContainerSelection={onUpdateRasterContainerSelection}
                        pluginsContent={pluginsContent}
                        mode={compactAnalysisOnly ? 'analysis-compact' : 'default'}
                    />
                )}
            </Box>
        </Row>
    );
};

export default memo(RightPanel);
