import Button from '@/shared/presentation/components/Button';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { Check, ChevronLeft, Play, X } from 'lucide-react';

import { ExecState } from '../../hooks/use-plugin-execution';
import type { ModifierOption } from '../../utilities/modifier-registry';
import type React from 'react';

const SKELETON_ROWS = 5;

const getPluginActionCopy = (execState: ExecState, isForeignTrajectory = false) => {
    if (execState === ExecState.Success) {
        return {
            label: 'Executed',
            intent: 'success' as const,
            icon: <Check size={14} />
        };
    }

    if (execState === ExecState.Error) {
        return {
            label: 'Retry execution',
            intent: 'danger' as const,
            icon: <X size={14} />
        };
    }

    return {
        label: isForeignTrajectory ? 'Clone & run' : 'Execute plugin',
        intent: 'brand' as const,
        icon: <Play size={14} />
    };
};

interface ModifierPopoverItemProps {
    option: ModifierOption;
    execState: ExecState;
    showAction: boolean;
    hasContent: boolean;
    isForeignTrajectory?: boolean;
    onAction: () => void;
    renderModifierConfig: (option: ModifierOption) => React.ReactNode;
};

const ModifierPopoverItem = ({
    option,
    execState,
    showAction,
    hasContent,
    isForeignTrajectory,
    onAction,
    renderModifierConfig
}: ModifierPopoverItemProps) => {
    const pluginAction = getPluginActionCopy(execState, isForeignTrajectory);
    const trigger = (
        <button
            type='button'
            className='canvas-plugin-popover-trigger collapsible-section-trigger d-flex items-center gap-05 u-select-none'
            aria-label={`${option.title} settings`}
        >
            <div className='volt-container collapsible-section-trigger-content d-flex items-center gap-05'>
                <span className='d-flex items-center color-muted'><option.Icon size={14} /></span>
                <span className='font-size-1 color-secondary'>{option.title}</span>
            </div>
            {hasContent && (
                <span className='canvas-plugin-popover-indicator d-flex items-center color-muted' aria-hidden='true'>
                    <ChevronLeft size={13} />
                </span>
            )}
        </button>
    );

    return (
        <div className='volt-container canvas-section canvas-plugin-popover-item d-flex items-center gap-025'>
            {hasContent ? (
                <ContextMenuPopover
                    id={`plugin-config-${option.modifierId}`}
                    trigger={trigger}
                    content={() => (
                        <div className='volt-container canvas-plugin-popover-content d-flex column gap-075'>
                            {renderModifierConfig(option)}
                            {option.isPlugin && showAction && (
                                <div className='volt-container canvas-plugin-popover-footer d-flex column'>
                                    <Button
                                        variant='solid'
                                        intent={pluginAction.intent}
                                        size='sm'
                                        shape='rounded'
                                        block
                                        isLoading={execState === ExecState.Loading}
                                        leftIcon={execState === ExecState.Loading ? undefined : pluginAction.icon}
                                        onClick={onAction}
                                    >
                                        {execState === ExecState.Loading ? 'Executing...' : pluginAction.label}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    triggerAction='click'
                    placement='left-start'
                    ariaLabel={`${option.title} settings`}
                    className='context-menu-popover--plugin-config'
                />
            ) : trigger}
        </div>
    );
};

interface ModifiersSectionProps {
    pluginLoading: boolean;
    modifiers: ModifierOption[];
    getExecState: (option: ModifierOption) => ExecState;
    showAction: (option: ModifierOption) => boolean;
    hasContent: (option: ModifierOption) => boolean;
    isForeignTrajectory?: boolean;
    onAction: (option: ModifierOption) => void;
    renderModifierConfig: (option: ModifierOption) => React.ReactNode;
};

const ModifiersSection = ({
    pluginLoading,
    modifiers,
    getExecState,
    showAction,
    hasContent,
    isForeignTrajectory,
    onAction,
    renderModifierConfig
}: ModifiersSectionProps) => {
    if (pluginLoading && modifiers.length === 0) {
        return (
            <>
                {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                    <div key={`mod-skel-${i}`} className="volt-container canvas-section">
                        <div className="volt-container d-flex items-center gap-05 p-05">
                            <span className="canvas-modifier-skeleton-icon" />
                            <span className="canvas-modifier-skeleton-title" />
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (!pluginLoading && modifiers.length === 0) {
        return (
            <EmptyState
                title='No plugins available'
                description='Install or enable plugins in your team cluster to apply modifiers to this trajectory.'
            />
        );
    }

    return (
        <>
            {modifiers.map((option) => {
                return (
                    <ModifierPopoverItem
                        key={option.modifierId}
                        option={option}
                        execState={getExecState(option)}
                        showAction={showAction(option)}
                        hasContent={hasContent(option)}
                        isForeignTrajectory={isForeignTrajectory}
                        onAction={() => onAction(option)}
                        renderModifierConfig={renderModifierConfig}
                    />
                );
            })}
        </>
    );
};

export default ModifiersSection;
