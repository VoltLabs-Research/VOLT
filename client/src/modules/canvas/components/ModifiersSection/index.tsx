import { Button, Row, Stack, Text, EmptyState, Skeleton } from '@voltstack/bravais';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Check, ChevronLeft, Play, X } from 'lucide-react';

import { ExecState } from '../../hooks/use-plugin-execution';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModifierOption } from '../../utilities/modifier-registry';
import type React from 'react';

const SKELETON_ROWS = 5;
const CLOSE_AFTER_RESPONSE_DELAY_MS = 250;
const CLOSE_ANIMATION_MS = 160;

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
    onAction: () => boolean | void | Promise<boolean | void>;
    onOpenConfig?: (option: ModifierOption) => void;
    renderModifierConfig: (option: ModifierOption) => React.ReactNode;
}

type ModifierConfigContentProps = Pick<
    ModifierPopoverItemProps,
    'option' | 'execState' | 'showAction' | 'isForeignTrajectory' | 'onAction' | 'renderModifierConfig'
> & {
    onClose: () => void;
    className?: string;
};

const ModifierConfigContent = ({
    option,
    execState,
    showAction,
    isForeignTrajectory,
    onAction,
    onClose,
    renderModifierConfig,
    className = ''
}: ModifierConfigContentProps) => {
    const [isClosing, setIsClosing] = useState(false);
    const closeDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pluginAction = getPluginActionCopy(execState, isForeignTrajectory);

    const clearCloseTimers = useCallback(() => {
        if (closeDelayRef.current) {
            clearTimeout(closeDelayRef.current);
            closeDelayRef.current = null;
        }
        if (closeAnimationRef.current) {
            clearTimeout(closeAnimationRef.current);
            closeAnimationRef.current = null;
        }
    }, []);

    useEffect(() => {
        return clearCloseTimers;
    }, [clearCloseTimers]);

    const handleActionAndClose = useCallback(async () => {
        if (execState === ExecState.Loading) {
            return;
        }

        clearCloseTimers();
        setIsClosing(false);

        const shouldClose = await onAction();
        if (shouldClose === false) {
            return;
        }

        closeDelayRef.current = setTimeout(() => {
            setIsClosing(true);
            closeAnimationRef.current = setTimeout(() => {
                onClose();
                setIsClosing(false);
                closeAnimationRef.current = null;
            }, CLOSE_ANIMATION_MS);
            closeDelayRef.current = null;
        }, CLOSE_AFTER_RESPONSE_DELAY_MS);
    }, [clearCloseTimers, execState, onAction, onClose]);

    return (
        <Stack gap='075' className={`canvas-plugin-popover-content ${className} ${isClosing ? 'canvas-plugin-popover-content--closing' : ''}`.trim()}>
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
                        onClick={() => { void handleActionAndClose(); }}
                    >
                        {execState === ExecState.Loading ? 'Executing...' : pluginAction.label}
                    </Button>
                </Stack>
            )}
        </Stack>
    );
};

export { ModifierConfigContent };

const ModifierPopoverItem = ({
    option,
    execState,
    showAction,
    hasContent,
    isForeignTrajectory,
    onAction,
    onOpenConfig,
    renderModifierConfig
}: ModifierPopoverItemProps) => {
    const externalConfigId = `plugin-config-${option.modifierId}-panel`;
    const opensExternalConfig = Boolean(hasContent && onOpenConfig);
    const trigger = (
        <button
            type='button'
            className='canvas-plugin-popover-trigger collapsible-section-trigger d-flex items-center gap-05 u-select-none'
            aria-label={`${option.title} settings`}
            title={option.title}
            data-modifier-id={option.modifierId}
            onClick={opensExternalConfig ? () => onOpenConfig?.(option) : undefined}
            aria-controls={opensExternalConfig ? externalConfigId : undefined}
        >
            <Row gap='05' className='collapsible-section-trigger-content canvas-plugin-popover-title-row'>
                <Text size='sm' tone='secondary' truncate>{option.title}</Text>
            </Row>
            {hasContent && (
                <Row as='span' className='canvas-plugin-popover-indicator color-muted' aria-hidden='true'>
                    <ChevronLeft size={13} />
                </Row>
            )}
        </button>
    );

    if (opensExternalConfig) {
        return (
            <Row gap='025' className='canvas-section canvas-plugin-popover-item'>
                {trigger}
            </Row>
        );
    }

    return (
        <Row gap='025' className='canvas-section canvas-plugin-popover-item'>
            {hasContent ? (
                <ContextMenuPopover
                    id={`plugin-config-${option.modifierId}`}
                    trigger={trigger}
                    content={(close) => (
                        <ModifierConfigContent
                            option={option}
                            execState={execState}
                            showAction={showAction}
                            isForeignTrajectory={isForeignTrajectory}
                            onAction={onAction}
                            onClose={close}
                            renderModifierConfig={renderModifierConfig}
                        />
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
    onAction: (option: ModifierOption) => boolean | void | Promise<boolean | void>;
    onOpenConfig?: (option: ModifierOption) => void;
    renderModifierConfig: (option: ModifierOption) => React.ReactNode;
}

const ModifiersSection = ({
    pluginLoading,
    modifiers,
    getExecState,
    showAction,
    hasContent,
    isForeignTrajectory,
    onAction,
    onOpenConfig,
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
                        onOpenConfig={onOpenConfig}
                        renderModifierConfig={renderModifierConfig}
                    />
                );
            })}
        </>
    );
};

export default ModifiersSection;
