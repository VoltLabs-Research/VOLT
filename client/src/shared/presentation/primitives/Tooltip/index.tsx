import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import composeRefs from '@/shared/presentation/utilities/compose-refs';
import './Tooltip.css';
import { useFloating, useHover, useFocus, useDismiss, useRole, useInteractions, FloatingPortal, offset, flip, shift, autoUpdate } from '@floating-ui/react';
import { useId, useState, cloneElement, isValidElement } from 'react';
import React from 'react';
import type { Placement } from '@floating-ui/react';
import type { HTMLAttributes, ReactNode, ReactElement, Ref } from 'react';

export type TooltipPlacement = Placement;

type TooltipTriggerElement = ReactElement<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>;

interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    placement?: TooltipPlacement;
    delay?: number;
    disabled?: boolean;
    className?: string;
};

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
    const tooltipId = useId();

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

    const triggerElement = child as TooltipTriggerElement;
    const placementSide = actualPlacement.split('-')[0];
    const childProps = triggerElement.props;
    const originalRef = childProps.ref;
    const childDescribedBy = typeof childProps['aria-describedby'] === 'string'
        ? childProps['aria-describedby']
        : undefined;
    const describedBy = [childDescribedBy, tooltipId].filter(Boolean).join(' ') || undefined;

    const clonedChild = cloneElement(triggerElement, {
        ref: composeRefs(refs.setReference, originalRef),
        'aria-describedby': describedBy,
        ...getReferenceProps(childProps)
    });

    return (
        <>
            {clonedChild}

            {isVisible && (
                <FloatingPortal root={floatingRoot}>
                    <div
                        ref={refs.setFloating}
                        id={tooltipId}
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
