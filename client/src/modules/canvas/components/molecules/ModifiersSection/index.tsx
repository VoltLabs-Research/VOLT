import ModifierAction from '../../atoms/ModifierAction';

import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';

import type { ExecState } from '../../../hooks/use-plugin-execution';
import type { ModifierOption } from '../../../utilities/modifier-registry';
import type React from 'react';

const SKELETON_ROWS = 5;

interface ModifierItemProps {
    option: ModifierOption;
    isOpen: boolean;
    active: boolean;
    execState: ExecState;
    showAction: boolean;
    hasContent: boolean;
    onToggleOpen: (id: string) => void;
    onAction: () => void;
    renderModifierConfig: (option: ModifierOption, active: boolean) => React.ReactNode;
};

const ModifierItem = ({
    option,
    isOpen,
    active,
    execState,
    showAction,
    hasContent,
    onToggleOpen,
    onAction,
    renderModifierConfig
}: ModifierItemProps) => (
    <CollapsibleSection
        key={option.modifierId}
        title={option.title}
        icon={<option.Icon size={14} />}
        expanded={isOpen}
        onExpandedChange={() => onToggleOpen(option.modifierId)}
        className="canvas-section"
        headerClassName="d-flex items-center gap-05 p-05"
        titleClassName="font-size-1 color-secondary"
        iconClassName="color-muted"
        bodyClassName=""
        contentClassName="canvas-render-subsection-body"
        noSpacing
        arrowSize={13}
        useDefaultTitleStyles={false}
        collapsible={hasContent}
        headerAction={showAction ? (
            <ModifierAction
                execState={execState}
                isLegacy={!option.isPlugin}
                active={active}
                forceVisible={!hasContent}
                onAction={onAction}
            />
        ) : undefined}
    >
        {renderModifierConfig(option, active)}
    </CollapsibleSection>
);

interface ModifiersSectionProps {
    pluginLoading: boolean;
    modifiers: ModifierOption[];
    openModifierIds: Set<string>;
    onToggleOpen: (id: string) => void;
    isModifierActive: (option: ModifierOption) => boolean;
    getExecState: (option: ModifierOption) => ExecState;
    showAction: (option: ModifierOption) => boolean;
    hasContent: (option: ModifierOption) => boolean;
    onAction: (option: ModifierOption) => void;
    renderModifierConfig: (option: ModifierOption, active: boolean) => React.ReactNode;
};

const ModifiersSection = ({
    pluginLoading,
    modifiers,
    openModifierIds,
    onToggleOpen,
    isModifierActive,
    getExecState,
    showAction,
    hasContent,
    onAction,
    renderModifierConfig
}: ModifiersSectionProps) => {
    if (pluginLoading && modifiers.length === 0) {
        return (
            <>
                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <Container key={`mod-skel-${i}`} className="canvas-section">
                        <Container className="d-flex items-center gap-05 p-05">
                            <span className="canvas-modifier-skeleton-icon" />
                            <span className="canvas-modifier-skeleton-title" />
                        </Container>
                    </Container>
                ))}
            </>
        );
    }

    if (!pluginLoading && modifiers.length === 0) {
        return <EmptyState title='No modifiers available' description='' />;
    }

    return (
        <>
            {modifiers.map((option) => {
                const active = isModifierActive(option);
                return (
                    <ModifierItem
                        key={option.modifierId}
                        option={option}
                        isOpen={openModifierIds.has(option.modifierId)}
                        active={active}
                        execState={getExecState(option)}
                        showAction={showAction(option)}
                        hasContent={hasContent(option)}
                        onToggleOpen={onToggleOpen}
                        onAction={() => onAction(option)}
                        renderModifierConfig={renderModifierConfig}
                    />
                );
            })}
        </>
    );
};

export default ModifiersSection;
