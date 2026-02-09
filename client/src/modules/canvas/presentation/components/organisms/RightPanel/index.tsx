import type { ComponentType, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Wrench, Monitor } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import usePluginStore from '@/modules/plugin/presentation/stores/use-plugin-store';
import usePluginUseCases from '@/modules/plugin/presentation/hooks/use-plugin-use-cases';
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
    const modifiers = usePluginStore((s) => s.modifiers);
    const pluginLoading = usePluginStore((s) => s.loading || s.isFetchingMore);
    const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
    const [openModifierIds, setOpenModifierIds] = useState<Set<string>>(new Set());
    const [modifiersOpen, setModifiersOpen] = useState(true);
    const [renderOpen, setRenderOpen] = useState(false);
    const { execStates, handleExecutePlugin } = usePluginExecution({
        trajectoryId,
        currentTimestep,
        getPluginArguments,
        pluginRepository
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
        return execStates.get(option.modifierId) ?? 'idle';
    }, [execStates]);

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
            handleToggleLegacyModifier(option);
        }
    }, [handleExecutePlugin, handleToggleLegacyModifier]);

    const renderModifierConfig = useCallback((option: ModifierOption, _active: boolean) => {
        let content: ReactNode = null;
        if(option.isPlugin && option.pluginModifierId){
            const args = getPluginArguments(option.pluginModifierId).filter((a) => a.value === undefined);
            if(args.length > 0){
                content = (
                    <Container className="d-flex column gap-02">
                        {args.map((arg, i) => (
                            <ArgumentField key={`${arg.argument}-${i}`} arg={arg} index={i} />
                        ))}
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
                    />
                );
            }
        }

        return (
            <ModifierConfig>
                {content}
            </ModifierConfig>
        );
    }, [getPluginArguments, trajectoryId, analysisId, currentTimestep]);

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

export default RightPanel;
