import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import Container from '@/shared/presentation/components/Container';
import composeRefs from '@/shared/presentation/utilities/compose-refs';
import './Popover.css';
import { useFloating, useClick, useDismiss, useRole, useInteractions, FloatingPortal, FloatingFocusManager, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { useState, useCallback, useLayoutEffect, useMemo, cloneElement, isValidElement } from 'react';
import React from 'react';
import type { Placement, VirtualElement } from '@floating-ui/react';
import type { HTMLAttributes, ReactNode, ReactElement, Ref } from 'react';

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
};

const Popover: React.FC<PopoverProps> = ({
    id,
    trigger,
    children,
    className = '',
    noPadding = false,
    triggerAction = 'click',
    onOpenChange,
    placement = 'bottom-start'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState<ContextMenuPosition | null>(null);
    const floatingRoot = useFloatingRoot();
    const onOpenChangeRef = React.useRef(onOpenChange);

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
    const dismiss = useDismiss(context);
    const role = useRole(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role
    ]);

    const close = useCallback(() => {
        handleOpenChange(false);
    }, [handleOpenChange]);

    const handleContextMenu = useCallback((event: React.MouseEvent) => {
        if (triggerAction !== 'contextmenu') return;
        event.preventDefault();
        event.stopPropagation();
        setContextMenuPosition({
            x: event.clientX,
            y: event.clientY
        });
        handleOpenChange(true);
    }, [triggerAction, handleOpenChange]);

    const renderChildren = () => {
        if (typeof children === 'function') {
            return children(close);
        }
        return children;
    };

    const triggerElement = trigger && isValidElement(trigger)
        ? cloneElement(trigger as PopoverTriggerElement, {
            ref: composeRefs(
                refs.setReference,
                (trigger as PopoverTriggerElement).props.ref
            ),
            'data-popover-trigger': id,
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
                        <Container
                            ref={refs.setFloating}
                            id={id}
                            className={`popover radius-lg d-flex column glass-bg ${noPadding ? '' : 'p-05'} ${className} color-primary`}
                            style={floatingStyles}
                            onClick={(event) => event.stopPropagation()}
                            {...getFloatingProps()}
                        >
                            {renderChildren()}
                        </Container>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </>
    );
};

export default Popover;
