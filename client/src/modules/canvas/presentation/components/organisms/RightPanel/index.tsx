import type { ComponentType, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Wrench, Monitor } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
import { usePluginCatalog } from '@/modules/plugin/presentation/hooks';
import useCanvasUrlState from '../../../hooks/use-canvas-url-state';
import {
    buildCanvasModifierOptions,
    LEGACY_MODIFIERS,
    type ModifierOption
} from '../../../modifiers/registry';
import CanvasRenderSections from '../CanvasRenderSections';
import ModifiersSection from '../../molecules/ModifiersSection';
import ModifierConfig, { ArgumentField } from '../../molecules/ModifierConfig';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import usePluginExecution, { type ExecState } from '../../../hooks/usePluginExecution';
import { sileo } from 'sileo';
import ApiError from '@/shared/errors/ApiError';
import type { LegacyActionRef } from '../ColorCoding';
import './RightPanel.css';

const LEGACY_COMPONENT_MAP = new Map<string, ComponentType<any> | undefined>(
    LEGACY_MODIFIERS.map((m) => [m.id, m.component] as const)
);

interface RightPanelProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const RightPanel = ({ trajectoryId, analysisId, currentTimestep }: RightPanelProps) => {
    const { activeModifiers, toggleModifier, pluginParam } = useCanvasUrlState();
    const { pluginRepository } = usePluginUseCases();
    const plugins = usePluginStore((s) => s.plugins);
    const { loadAllPlugins } = usePluginCatalog();
    const modifiers = useMemo(() =>
        plugins
            .filter(plugin => plugin.modifier)
            .map(plugin => ({
                plugin,
                pluginId: plugin._id,
                name: plugin.modifier?.name || plugin._id,
                icon: plugin.modifier?.icon
            })),
        [plugins]
    );
    const pluginLoading = usePluginStore((s) => s.isLoading);
    const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
    const [openModifierIds, setOpenModifierIds] = useState<Set<string>>(new Set());
    const [modifiersOpen, setModifiersOpen] = useState(true);
    const [renderOpen, setRenderOpen] = useState(false);
    const [legacyExecStates, setLegacyExecStates] = useState<Map<string, ExecState>>(new Map());
    const legacyActionRef = useRef<Map<string, () => void>>(new Map());
    const [pluginConfigs, setPluginConfigs] = useState<Record<string, Record<string, any>>>({});

    const handlePluginConfigChange = useCallback((pluginId: string, key: string, value: any) => {
        setPluginConfigs(prev => ({
            ...prev,
            [pluginId]: {
                ...(prev[pluginId] || {}),
                [key]: value
            }
        }));
    }, []);

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
        pluginRepository,
        pluginConfigs
    });

    useEffect(() => {
        if (plugins.length > 0) return;
        loadAllPlugins({ limit: 200, force: true }).catch((error: unknown) => {
            if(ApiError.isRBACError(error)){
                const msg = error instanceof ApiError ? error.getFriendlyMessage() : 'You do not have permission to perform this action.';
                sileo.error({ title: msg });
            } else {
                sileo.error({ title: 'Failed to load plugins' });
            }
        });
    }, [plugins.length, loadAllPlugins]);

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
            ?? 'idle';
    }, [execStates, legacyExecStates]);

    const shouldShowAction = useCallback((option: ModifierOption): boolean => {
        return option.modifierId !== 'slice-plane';
    }, []);

    const modifierHasContent = useCallback((option: ModifierOption): boolean => {
        if (option.isPlugin && option.pluginModifierId) {
            return getPluginArguments(option.pluginModifierId).filter((a) => a.value === undefined).length > 0;
        }
        return LEGACY_COMPONENT_MAP.has(option.modifierId);
    }, [getPluginArguments]);

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
            if(args.length > 0){
                content = (
                    <Container className="d-flex column gap-05">
                        {args.map((arg, i) => {
                            const val = pluginConfigs[option.pluginModifierId!]?.[arg.argument];
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
    }, [getPluginArguments, trajectoryId, analysisId, currentTimestep, legacyRef, pluginConfigs, handlePluginConfigChange]);

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
