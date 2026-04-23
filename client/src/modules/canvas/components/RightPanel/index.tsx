import { buildCanvasModifierOptions, BUILT_IN_MODIFIERS } from '../../utilities/modifier-registry';
import useTip from '@/shared/tips/use-tip';
import usePluginExecution from '../../hooks/use-plugin-execution';
import { ExecState } from '../../hooks/use-plugin-execution';
import useTrajectoryCloneFlow from '../../hooks/use-trajectory-clone-flow';
import { useTrajectoryCloneFlowStore } from '../../stores/use-trajectory-clone-flow-store';
import { useCanvasFocusStore } from '../../stores/use-canvas-focus-store';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import ModifierConfig from '../ModifierConfig';
import ModifiersSection from '../ModifiersSection';
import ObjectsPanel from '../ObjectsPanel';

import PluginExecutionConfigFields from '@/modules/plugin/components/plugin/PluginExecutionConfigFields';
import { useExecutePluginMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { getUserConfigurableArguments } from '@/modules/plugin/utilities/plugin/argument-values';
import { resolvePluginExecutionClusterId, supportsPluginExecutionCluster } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { Wrench } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { CollapsibleSection } from '@/shared/presentation/primitives';
import { Box, Row } from '@/shared/presentation/primitives';
import { extractTrajectoryTimesteps, normalizeSelectedTimesteps } from '../../utilities/selected-timestep-analysis';

import type { ModifierOption } from '../../utilities/modifier-registry';
import type { ComponentType, ReactNode } from 'react';
import type { SelectOption } from '@/shared/presentation/primitives';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/entities/plugin/team-cluster';
import type { RasterContainerId, RasterContainerSelection } from '@/modules/raster/types/container-selection';

import './RightPanel.css';

const BUILT_IN_COMPONENT_MAP = new Map<string, ComponentType<any> | undefined>(
    BUILT_IN_MODIFIERS.map((m) => [m.id, m.component] as const)
);

interface PluginExecutionClusterConfig {
    selectedTeamClusterId?: string;
};

interface RightPanelProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    onDownloadAnalysis?: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    rasterContainerSelections?: RasterContainerSelection[];
    activeRasterContainerId?: RasterContainerId;
    onSetActiveRasterContainer?: (containerId: RasterContainerId) => void;
    onUpdateRasterContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
};

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
    onDownloadAnalysis,
    onDownloadExposureListing,
    rasterContainerSelections,
    activeRasterContainerId,
    onSetActiveRasterContainer,
    onUpdateRasterContainerSelection
}: RightPanelProps) => {
    useTip('canvas-render-settings');

    const currentUser = useCurrentUser();
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
    const [modifiersOpen, setModifiersOpen] = useState(true);
    const focusedModifierId = useCanvasFocusStore((s) => s.focusedModifierId);
    const clearFocusedModifier = useCanvasFocusStore((s) => s.clearFocusedModifier);

    useEffect(() => {
        if (!focusedModifierId) return;
        setModifiersOpen(true);

        // Why: wait for the CollapsibleSection to render its body before
        // querying the DOM. Two RAFs give React + transition a chance to mount
        // the trigger we're targeting.
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

    const availableTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const executionTeamClusters = useMemo<PluginTeamClusterOption[]>(() => {
        return (teamClustersResponse?.data ?? []).filter(supportsPluginExecutionCluster);
    }, [teamClustersResponse?.data]);

    const teamClusterOptions = useMemo<SelectOption[]>(() => {
        return executionTeamClusters.map((teamCluster) => ({
            value: teamCluster._id,
            title: teamCluster.name
        }));
    }, [executionTeamClusters]);

    const hasTeamClusterOptions = teamClusterOptions.length > 0;
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
        return normalizeSelectedTimesteps(pluginSelectedTimesteps[pluginId], availableTimesteps);
    }, [availableTimesteps, pluginSelectedTimesteps]);

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
            return;
        }
        handleExecutePlugin(option);
    }, [handleExecutePlugin]);

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
            <ModifierConfig>
                {content}
            </ModifierConfig>
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

    if (!currentUser) {
        return null;
    }

    const pluginsSection = (
        <CollapsibleSection
            title="Plugins"
            icon={<Wrench size={13} />}
            expanded={modifiersOpen}
            onExpandedChange={setModifiersOpen}
            className="canvas-right-dropdown"
            headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
            titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
            iconClassName="canvas-right-dropdown-icon"
            bodyClassName="canvas-right-dropdown-body"
            contentClassName="d-flex column"
            noSpacing
            arrowSize={13}
            useDefaultHeaderStyles={false}
            useDefaultTitleStyles={false}
        >
            <ModifiersSection
                pluginLoading={pluginLoading}
                modifiers={allModifiers}
                getExecState={getExecState}
                showAction={shouldShowAction}
                hasContent={modifierHasContent}
                isForeignTrajectory={isForeignTrajectory}
                onAction={handleAction}
                renderModifierConfig={renderModifierConfig}
            />
        </CollapsibleSection>
    );

    return (
        <Row height='max' overflow='hidden'>
            <Box width='max' height='max' overflow='auto'>
                <ObjectsPanel
                    trajectory={trajectory}
                    onDownloadAnalysis={onDownloadAnalysis}
                    onDownloadExposureListing={onDownloadExposureListing}
                    rasterContainerSelections={rasterContainerSelections}
                    activeRasterContainerId={activeRasterContainerId}
                    onSetActiveRasterContainer={onSetActiveRasterContainer}
                    onUpdateRasterContainerSelection={onUpdateRasterContainerSelection}
                    afterSceneCollection={pluginsSection}
                />
            </Box>
        </Row>
    );
};

export default memo(RightPanel);
