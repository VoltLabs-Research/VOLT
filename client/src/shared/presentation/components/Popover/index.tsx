import React, { useState, useCallback, useLayoutEffect, useMemo, cloneElement, isValidElement, type ReactNode, type ReactElement, type Ref } from 'react';
import {
    useFloating,
    useClick,
    useDismiss,
    useRole,
    useInteractions,
    FloatingPortal,
    FloatingFocusManager,
    offset,
    flip,
    shift,
    autoUpdate,
    type Placement,
    type VirtualElement
} from '@floating-ui/react';
import Container from '@/shared/presentation/components/Container';
import composeRefs from '@/shared/presentation/utils/compose-refs';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import './Popover.css';

interface ContextMenuPosition {
    x: number;
    y: number;
}

interface PopoverProps {
    id: string;
    trigger: ReactNode;
    children: ReactNode | ((close: () => void) => ReactNode);
    className?: string;
    noPadding?: boolean;
    triggerAction?: 'click' | 'contextmenu';
    onOpenChange?: (isOpen: boolean) => void;
    placement?: Placement;
}

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
        ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
            ref: composeRefs(
                refs.setReference,
                (trigger as ReactElement & { ref?: Ref<HTMLElement> }).ref
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
