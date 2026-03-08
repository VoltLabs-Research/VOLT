import React, { useState, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import {
    useFloating,
    useHover,
    useFocus,
    useDismiss,
    useRole,
    useInteractions,
    FloatingPortal,
    offset,
    flip,
    shift,
    autoUpdate,
    type Placement
} from '@floating-ui/react';
import composeRefs from '@/shared/presentation/utils/compose-refs';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import './Tooltip.css';

export type TooltipPlacement = Placement;

interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    placement?: TooltipPlacement;
    delay?: number;
    disabled?: boolean;
    className?: string;
}

const Tooltip = ({
    children,
    content,
    placement = 'top',
    delay = 300,
    disabled = false,
    className = ''
}: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const floatingRoot = useFloatingRoot();

    const { refs, floatingStyles, context, placement: actualPlacement } = useFloating({
        open: isVisible,
        onOpenChange: setIsVisible,
        placement,
        middleware: [
            offset(8),
            flip({ padding: 8 }),
            shift({ padding: 8 })
        ],
        whileElementsMounted: autoUpdate
    });

    const hover = useHover(context, {
        delay: {
            open: delay,
            close: 0
        },
        enabled: !disabled
    });
    const focus = useFocus(context, {
        enabled: !disabled
    });
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'tooltip' });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        focus,
        dismiss,
        role
    ]);

    if (!content) return <>{children}</>;

    const child = React.Children.only(children);
    if (!isValidElement(child)) {
        return <>{children}</>;
    }

    const placementSide = actualPlacement.split('-')[0];
    const childProps = child.props as Record<string, unknown>;
    const originalRef = (child as ReactElement & { ref?: React.Ref<HTMLElement> }).ref;

    const clonedChild = cloneElement(child as ReactElement<Record<string, unknown>>, {
        ref: composeRefs(refs.setReference, originalRef),
        ...getReferenceProps(childProps)
    });

    return (
        <>
            {clonedChild}

            {isVisible && (
                <FloatingPortal root={floatingRoot}>
                    <div
                        ref={refs.setFloating}
                        className={`volt-tooltip volt-tooltip-${placementSide} ${className} overflow-hidden`}
                        style={floatingStyles}
                        role='tooltip'
                        {...getFloatingProps()}
                    >
                        {content}
                    </div>
                </FloatingPortal>
            )}
        </>
    );
};

export default Tooltip;
