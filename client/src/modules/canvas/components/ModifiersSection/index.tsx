import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import ContextMenuPopover from '@/shared/presentation/primitives/ContextMenuPopover';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
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
            title={option.title}
            data-modifier-id={option.modifierId}
        >
            <Row gap='05' className='collapsible-section-trigger-content canvas-plugin-popover-title-row'>
                <Text size='sm' tone='secondary' truncate>{option.title}</Text>
            </Row>
            {hasContent && (
                <span className='canvas-plugin-popover-indicator d-flex items-center color-muted' aria-hidden='true'>
                    <ChevronLeft size={13} />
                </span>
            )}
        </button>
    );

    return (
        <Row gap='025' className='canvas-section canvas-plugin-popover-item'>
            {hasContent ? (
                <ContextMenuPopover
                    id={`plugin-config-${option.modifierId}`}
                    trigger={trigger}
                    content={() => (
                        <Stack gap='075' className='canvas-plugin-popover-content'>
                            {renderModifierConfig(option)}
                            {option.isPlugin && showAction && (
                                <Stack className='canvas-plugin-popover-footer'>
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
                                </Stack>
                            )}
                        </Stack>
                    )}
                    triggerAction='click'
                    placement='left-start'
                    ariaLabel={`${option.title} settings`}
                    className='context-menu-popover--plugin-config'
                />
            ) : trigger}
        </Row>
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
                    <div key={`mod-skel-${i}`} className="canvas-section">
                        <Row gap='05' p='05'>
                            <Skeleton variant='text' width='60%' height={12} />
                        </Row>
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
