import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import './CursorTooltip.css';
import { useFloating, offset, flip, shift, autoUpdate, FloatingPortal } from '@floating-ui/react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Middleware, VirtualElement } from '@floating-ui/react';

interface CursorTooltipProps {
    isOpen: boolean;
    x: number;
    y: number;
    content?: ReactNode;
    className?: string;
    autoPosition?: boolean;
    interactive?: boolean;
    offset?: number;
    ariaLabel?: string;
};

const createVirtualCursorRect = (x: number, y: number) => ({
    x,
    y,
    top: y,
    right: x,
    bottom: y,
    left: x,
    width: 0,
    height: 0
});

const CursorTooltip = ({
    isOpen,
    x,
    y,
    content,
    className = '',
    autoPosition = true,
    interactive = false,
    offset: cursorOffset = 16,
    ariaLabel = 'Additional details'
}: CursorTooltipProps) => {
    const arrowOffset = cursorOffset;
    const floatingRoot = useFloatingRoot();
    const prefersReducedMotion = usePrefersReducedMotion();
    const reactId = useId();
    const tooltipId = `cursor-tooltip-${reactId}`;

    const virtualElementRef = useRef<VirtualElement>({
        getBoundingClientRect: () => createVirtualCursorRect(x, y)
    });

    const middleware: Middleware[] = [offset({ mainAxis: arrowOffset, crossAxis: arrowOffset })];

    if (autoPosition) {
        middleware.push(flip({ padding: 16 }));
        middleware.push(shift({ padding: 16 }));
    }

    const { refs, floatingStyles } = useFloating({
        open: isOpen,
        placement: 'right-start',
        middleware,
        whileElementsMounted: autoUpdate
    });

    useEffect(() => {
        virtualElementRef.current.getBoundingClientRect = () => createVirtualCursorRect(x, y);
        refs.setPositionReference(virtualElementRef.current);
    }, [x, y, refs]);

    if (!isOpen) return null;

    return (
        <FloatingPortal root={floatingRoot}>
            <div
                ref={refs.setFloating}
                className={`cursor-tooltip visible ${interactive ? 'interactive' : ''} ${className}`}
                style={floatingStyles}
                id={tooltipId}
                role={interactive ? 'dialog' : 'tooltip'}
                aria-label={interactive ? ariaLabel : undefined}
                aria-modal={interactive ? false : undefined}
                tabIndex={interactive ? -1 : undefined}
                data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
            >
                {content}
            </div>
        </FloatingPortal>
    );
};

export default CursorTooltip;
