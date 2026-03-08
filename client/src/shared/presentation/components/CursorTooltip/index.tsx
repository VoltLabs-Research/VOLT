import React, { useRef, useMemo } from 'react';
import {
    useFloating,
    offset,
    flip,
    shift,
    autoUpdate,
    FloatingPortal
} from '@floating-ui/react';
import { useFloatingRoot } from '@/shared/presentation/contexts/FloatingRootContext';
import './CursorTooltip.css';

interface CursorTooltipProps {
    isOpen: boolean;
    x: number;
    y: number;
    content?: React.ReactNode;
    className?: string;
    autoPosition?: boolean;
    interactive?: boolean;
    offset?: number;
};

const CursorTooltip: React.FC<CursorTooltipProps> = ({
    isOpen,
    x,
    y,
    content,
    className = '',
    interactive = false,
    offset: cursorOffset = 16
}) => {
    const arrowOffset = cursorOffset;
    const floatingRoot = useFloatingRoot();

    const virtualElementRef = useRef({
        getBoundingClientRect() {
            return {
                x,
                y,
                top: y,
                left: x,
                bottom: y,
                right: x,
                width: 0,
                height: 0
            };
        }
    });

    // Keep the virtual element in sync with current x/y
    virtualElementRef.current.getBoundingClientRect = () => ({
        x,
        y,
        top: y,
        left: x,
        bottom: y,
        right: x,
        width: 0,
        height: 0
    });

    const { refs, floatingStyles } = useFloating({
        open: isOpen,
        placement: 'right-start',
        middleware: [
            offset({ mainAxis: arrowOffset, crossAxis: arrowOffset }),
            flip({ padding: 16 }),
            shift({ padding: 16 })
        ],
        whileElementsMounted: autoUpdate
    });

    // Attach virtual element as reference
    useMemo(() => {
        refs.setReference(virtualElementRef.current as unknown as Element);
    }, [refs]);

    // Update position when x/y change
    useMemo(() => {
        refs.setReference(virtualElementRef.current as unknown as Element);
    }, [x, y, refs]);

    if (!isOpen) return null;

    return (
        <FloatingPortal root={floatingRoot}>
            <div
                ref={refs.setFloating}
                className={`cursor-tooltip visible ${interactive ? 'interactive' : ''} ${className}`}
                style={floatingStyles}
            >
                {content}
            </div>
        </FloatingPortal>
    );
};

export default CursorTooltip;
