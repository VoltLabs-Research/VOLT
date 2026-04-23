import FloatingRootContext, {
    FloatingOwnerIdsContext,
    appendFloatingOwnerIds,
    hasFloatingOwnerId,
    useFloatingOwnerIds,
    useFloatingRoot
} from '@/shared/presentation/contexts/FloatingRootContext';
import composeRefs from '@/shared/presentation/utilities/compose-refs';
import './Popover.css';
import { useFloating, useClick, useDismiss, useRole, useInteractions, FloatingPortal, FloatingFocusManager, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { useState, useCallback, useLayoutEffect, useMemo, cloneElement, isValidElement } from 'react';
import React from 'react';
import type { Placement, VirtualElement } from '@floating-ui/react';
import type { HTMLAttributes, ReactNode, ReactElement, Ref } from 'react';

type PopoverRole = 'dialog' | 'menu' | 'listbox' | 'tooltip';

type ContextMenuOpenPredicate = (event: React.MouseEvent<Element>) => boolean;

type PopoverTriggerProps = HTMLAttributes<HTMLElement> & {
    ref?: Ref<HTMLElement>;
    'data-popover-trigger'?: string;
};

type PopoverTriggerElement = ReactElement<PopoverTriggerProps>;

interface ContextMenuPosition {
    x: number;
    y: number;
};

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    className?: string;
    noPadding?: boolean;
    triggerAction?: 'click' | 'contextmenu';
    onOpenChange?: (isOpen: boolean) => void;
    placement?: Placement;
    role?: PopoverRole;
    triggerAriaHaspopup?: 'menu' | 'dialog';
    ariaLabel?: string;
    ariaLabelledBy?: string;
    ariaDescribedBy?: string;
    shouldOpenOnContextMenu?: ContextMenuOpenPredicate;
};

const Popover = ({
    id,
    trigger,
    children,
    className = '',
    noPadding = false,
    triggerAction = 'click',
    onOpenChange,
    placement = 'bottom-start',
    role: popoverRole = 'dialog',
    triggerAriaHaspopup,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
    shouldOpenOnContextMenu
}: PopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
    const [floatingElement, setFloatingElement] = useState<HTMLElement | null>(null);
    const floatingRoot = useFloatingRoot();
    const floatingOwnerIds = useFloatingOwnerIds();
    const onOpenChangeRef = React.useRef(onOpenChange);
    const nextFloatingOwnerIds = useMemo(() => appendFloatingOwnerIds(floatingOwnerIds, id), [floatingOwnerIds, id]);

    useLayoutEffect(() => {
        onOpenChangeRef.current = onOpenChange;
    });

    const handleOpenChange = useCallback((nextOpen: boolean) => {
        setIsOpen(nextOpen);
        if (!nextOpen) {
            setContextMenuPosition(null);
        }
        onOpenChangeRef.current?.(nextOpen);
    }, []);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: handleOpenChange,
        placement,
        middleware: [
            offset(8),
            flip({ padding: 16 }),
            shift({ padding: 16 })
        ],
        whileElementsMounted: autoUpdate
    });

    const positionReference = useMemo<VirtualElement | null>(() => {
        if (triggerAction !== 'contextmenu' || !contextMenuPosition) {
            return null;
        }

        return {
            getBoundingClientRect() {
                return {
                    width: 0,
                    height: 0,
                    x: contextMenuPosition.x,
                    y: contextMenuPosition.y,
                    top: contextMenuPosition.y,
                    right: contextMenuPosition.x,
                    bottom: contextMenuPosition.y,
                    left: contextMenuPosition.x
                };
            }
        };
    }, [contextMenuPosition, triggerAction]);

    useLayoutEffect(() => {
        if (positionReference) {
            refs.setPositionReference(positionReference);
            return;
        }

        const referenceElement = refs.domReference.current;

        if (referenceElement) {
            refs.setPositionReference(referenceElement);
        }
    }, [positionReference, refs]);

    const click = useClick(context, {
        enabled: triggerAction === 'click'
    });
    const dismiss = useDismiss(context, {
        outsidePress: (event) => {
            return !hasFloatingOwnerId(event.target instanceof Element ? event.target : null, id);
        }
    });
    const role = useRole(context, { role: popoverRole });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role
    ]);

    const close = useCallback(() => {
        handleOpenChange(false);
    }, [handleOpenChange]);

    const handleFloatingRef = useCallback((node: HTMLElement | null) => {
        refs.setFloating(node);
        setFloatingElement(node);
    }, [refs]);

    const handleContextMenu = useCallback((event: React.MouseEvent) => {
        if (triggerAction !== 'contextmenu') return;
        if (event.defaultPrevented) return;
        if (shouldOpenOnContextMenu && !shouldOpenOnContextMenu(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setContextMenuPosition({
            x: event.clientX,
            y: event.clientY
        });
        handleOpenChange(true);
    }, [triggerAction, handleOpenChange, shouldOpenOnContextMenu]);

    const renderChildren = () => {
        if (typeof children === 'function') {
            return children(close);
        }
        return children;
    };

    const triggerElement = trigger && isValidElement(trigger)
        ? cloneElement(trigger as PopoverTriggerElement, {
            ...(triggerAction === 'contextmenu'
                ? {}
                : {
                    ref: composeRefs(
                        refs.setReference,
                        (trigger as PopoverTriggerElement).props.ref
                    )
                }),
            'data-popover-trigger': id,
            'aria-controls': isOpen ? id : undefined,
            'aria-expanded': triggerAction === 'click' ? isOpen : undefined,
            'aria-haspopup': triggerAriaHaspopup ?? (popoverRole === 'menu' ? 'menu' : 'dialog'),
            ...getReferenceProps({
                onContextMenu: handleContextMenu
            })
        })
        : null;

    return (
        <>
            {triggerElement}

            {isOpen && (
                <FloatingPortal root={floatingRoot}>
                    <FloatingFocusManager context={context} modal={false}>
                        <div ref={handleFloatingRef} id={id} className={`popover ${noPadding ? 'popover--no-padding' : ''} radius-lg d-flex column glass-bg ${className} color-primary`} style={floatingStyles} onClick={(event) => event.stopPropagation()} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} aria-describedby={ariaDescribedBy} tabIndex={-1} {...getFloatingProps()}>
                            <FloatingOwnerIdsContext.Provider value={nextFloatingOwnerIds}>
                                <FloatingRootContext.Provider value={floatingElement ?? floatingRoot}>
                                    {renderChildren()}
                                </FloatingRootContext.Provider>
                            </FloatingOwnerIdsContext.Provider>
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
};

export default Popover;
