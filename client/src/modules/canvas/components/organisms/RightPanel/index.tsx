import { buildCanvasModifierOptions, LEGACY_MODIFIERS } from '../../../utilities/modifier-registry';
import { ArgumentField } from '../../molecules/ModifierConfig';
import PluginClusterField from '../../molecules/PluginClusterField';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import usePluginExecution from '../../../hooks/use-plugin-execution';
import { ExecState } from '../../../hooks/use-plugin-execution';
import ModifierConfig from '../../molecules/ModifierConfig';
import ModifiersSection from '../../molecules/ModifiersSection';
import CanvasRenderSections from '../CanvasRenderSections';

import { useExecutePluginMutation, usePluginTeamClustersQuery } from '@/modules/plugin/hooks/plugin/queries';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { Wrench, Monitor } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';

import type { ModifierOption } from '../../../utilities/modifier-registry';
import type { LegacyActionRef } from '../ColorCoding';
import type { ComponentType, ReactNode } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';

import './RightPanel.css';

const LEGACY_COMPONENT_MAP = new Map<string, ComponentType<any> | undefined>(
    LEGACY_MODIFIERS.map((m) => [m.id, m.component] as const)
);

interface PluginExecutionClusterConfig {
    selectedTeamClusterId?: string;
};

interface RightPanelProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
};

const RightPanel = ({ trajectoryId, analysisId, currentTimestep }: RightPanelProps) => {
    const { activeModifiers, toggleModifier, pluginParam } = useCanvasUrlState();
    const selectedTeamId = useSelectedTeamId();
    const executePluginMutation = useExecutePluginMutation();
    const { modifiers, getPluginArguments, isLoading: pluginLoading } = usePluginSelectors();
    const { data: teamClustersResponse } = usePluginTeamClustersQuery({
        teamId: selectedTeamId ?? '',
        page: 1,
        limit: 100
    }, {
        enabled: !!selectedTeamId
    });
    useEnsurePluginCatalogLoaded();
    const [openModifierIds, setOpenModifierIds] = useState<Set<string>>(new Set());
    const [modifiersOpen, setModifiersOpen] = useState(true);
    const [renderOpen, setRenderOpen] = useState(false);
    const [legacyExecStates, setLegacyExecStates] = useState<Map<string, ExecState>>(new Map());
    const legacyActionRef = useRef<Map<string, () => void>>(new Map());
    const [pluginConfigs, setPluginConfigs] = useState<Record<string, Record<string, unknown>>>({});
    const [pluginExecutionClusters, setPluginExecutionClusters] = useState<Record<string, PluginExecutionClusterConfig>>({});

    const teamClusterOptions = useMemo<SelectOption[]>(() => {
        return (teamClustersResponse?.data ?? []).map((teamCluster) => ({
            value: teamCluster._id,
            title: teamCluster.name
        }));
    }, [teamClustersResponse?.data]);

    const hasTeamClusterOptions = teamClusterOptions.length > 0;

    const handlePluginConfigChange = useCallback((pluginId: string, key: string, value: string | number | boolean) => {
        setPluginConfigs((prev) => ({
            ...prev,
            [pluginId]: {
                ...(prev[pluginId] || {}),
                [key]: value
            }
        }));
    }, []);

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
        if (selectedClusterId) {
            return selectedClusterId;
        }

        if (pluginTeamClusterId) {
            return pluginTeamClusterId;
        }

        return teamClusterOptions[0]?.value ?? '';
    }, [pluginExecutionClusters, teamClusterOptions]);

    const updateLegacyExecState = useCallback((id: string, state: ExecState) => {
        setLegacyExecStates((prev) => {
            if (prev.get(id) === state) return prev;
            const next = new Map(prev);
            next.set(id, state);
            return next;
        });
    }, []);

    const legacyRef = useMemo<LegacyActionRef>(() => ({
        actions: legacyActionRef,
        notifyExecState: updateLegacyExecState
    }), [updateLegacyExecState]);
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
        pluginConfigs
    });

    const allModifiers = useMemo<ModifierOption[]>(() => buildCanvasModifierOptions(modifiers), [modifiers]);

    const toggleOpen = useCallback((id: string) => {
        setOpenModifierIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const isModifierActive = useCallback((option: ModifierOption): boolean => {
        if (option.isPlugin) {
            const key = `${option.pluginId}:${option.pluginModifierId}`;
            return pluginParam === key;
        }
        return activeModifiers.includes(option.modifierId);
    }, [activeModifiers, pluginParam]);

    const handleToggleLegacyModifier = useCallback((option: ModifierOption) => {
        if (option.isPlugin) return;
        toggleModifier(option.modifierId);
    }, [toggleModifier]);

    const getExecState = useCallback((option: ModifierOption): ExecState => {
        return legacyExecStates.get(option.modifierId)
            ?? execStates.get(option.modifierId)
            ?? ExecState.Idle;
    }, [execStates, legacyExecStates]);

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
        return LEGACY_COMPONENT_MAP.has(option.modifierId);
    }, []);

    const handleAction = useCallback((option: ModifierOption) => {
        if (option.isPlugin) {
            handleExecutePlugin(option);
        } else {
            const action = legacyActionRef.current.get(option.modifierId);
            if (action) {
                action();
            } else {
                handleToggleLegacyModifier(option);
            }
        }
    }, [handleExecutePlugin, handleToggleLegacyModifier]);

    const renderModifierConfig = useCallback((option: ModifierOption, _active: boolean) => {
        let content: ReactNode = null;
        if(option.isPlugin && option.pluginModifierId){
            const args = getPluginArguments(option.pluginModifierId).filter((a) => a.value === undefined);
            const selectedClusterId = getSelectedClusterId(option.pluginModifierId, option.plugin?.teamCluster);
            const clusterField = (
                hasTeamClusterOptions
                    ? (
                        <PluginClusterField
                            fieldKey={`plugin-cluster-${option.pluginModifierId}`}
                            fieldValue={selectedClusterId}
                            options={teamClusterOptions}
                            onFieldChange={(_, value) => handlePluginClusterChange(option.pluginModifierId!, value)}
                        />
                    )
                    : (
                        <Paragraph className='font-size-1 color-muted'>No team clusters available</Paragraph>
                    )
            );

            if(args.length > 0){
                content = (
                    <Container className="d-flex column gap-05">
                        {clusterField}
                        {args.map((arg, i) => {
                            const rawValue = pluginConfigs[option.pluginModifierId!]?.[arg.argument];
                            const val = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
                                ? rawValue
                                : undefined;
                            return (
                                <ArgumentField 
                                    key={`${arg.argument}-${i}`} 
                                    arg={arg} 
                                    index={i} 
                                    value={val}
                                    onChange={(key, v) => handlePluginConfigChange(option.pluginModifierId!, key, v)}
                                />
                            );
                        })}
                    </Container>
                );
            } else {
                content = clusterField;
            }
        }else{
            const LegacyComponent = LEGACY_COMPONENT_MAP.get(option.modifierId);
            if(LegacyComponent){
                content = (
                    <LegacyComponent
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                        legacyRef={legacyRef}
                    />
                );
            }
        }

        return (
            <ModifierConfig>
                {content}
            </ModifierConfig>
        );
    }, [getPluginArguments, getSelectedClusterId, hasTeamClusterOptions, trajectoryId, analysisId, currentTimestep, legacyRef, pluginConfigs, handlePluginClusterChange, handlePluginConfigChange, teamClusterOptions]);

    return (
        <Container className="d-flex h-max overflow-hidden">
            <Container className="w-max h-max overflow-auto">
                <CollapsibleSection
                    title="Modifiers"
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
                        openModifierIds={openModifierIds}
                        onToggleOpen={toggleOpen}
                        isModifierActive={isModifierActive}
                        getExecState={getExecState}
                        showAction={shouldShowAction}
                        hasContent={modifierHasContent}
                        onAction={handleAction}
                        renderModifierConfig={renderModifierConfig}
                    />
                </CollapsibleSection>

                <CollapsibleSection
                    title="Render"
                    icon={<Monitor size={13} />}
                    expanded={renderOpen}
                    onExpandedChange={setRenderOpen}
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
                    <CanvasRenderSections />
                </CollapsibleSection>
            </Container>
        </Container>
    );
};

export default memo(RightPanel);
