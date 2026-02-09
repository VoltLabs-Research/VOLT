import type React from 'react';
import Container from '@/shared/presentation/components/Container';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import type { ModifierOption } from '../../../modifiers/registry';

const SKELETON_ROWS = 5;

interface ModifierItemProps {
    option: ModifierOption;
    isOpen: boolean;
    active: boolean;
    onToggleOpen: (id: string) => void;
    renderModifierConfig: (option: ModifierOption, active: boolean) => React.ReactNode;
}

const ModifierItem = ({
    option,
    isOpen,
    active,
    onToggleOpen,
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
        bodyClassName="canvas-section-body"
        contentClassName="p-1"
        noSpacing
        arrowSize={13}
        useDefaultTitleStyles={false}
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
    renderModifierConfig: (option: ModifierOption, active: boolean) => React.ReactNode;
}

const ModifiersSection = ({
    pluginLoading,
    modifiers,
    openModifierIds,
    onToggleOpen,
    isModifierActive,
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
        return <Container className="p-075 font-size-1 color-muted">No modifiers available</Container>;
    }

    return (
        <>
            {modifiers.map((option) => (
                <ModifierItem
                    key={option.modifierId}
                    option={option}
                    isOpen={openModifierIds.has(option.modifierId)}
                    active={isModifierActive(option)}
                    onToggleOpen={onToggleOpen}
                    renderModifierConfig={renderModifierConfig}
                />
            ))}
        </>
    );
};

export default ModifiersSection;
