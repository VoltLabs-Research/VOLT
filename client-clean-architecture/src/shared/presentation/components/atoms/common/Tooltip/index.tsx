import React, { useState, useRef, useCallback, useEffect, type ReactNode, type ReactElement, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';
import '@/shared/presentation/components/atoms/common/Tooltip/Tooltip.css';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    children: ReactNode;
    content: ReactNode;
    placement?: TooltipPlacement;
    delay?: number;
    disabled?: boolean;
    className?: string;
}

const OFFSET = 8;
const VIEWPORT_PADDING = 8;

const Tooltip = ({
    children,
    content,
    placement = 'top',
    delay = 300,
    disabled = false,
    className = ''
}: TooltipProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [actualPlacement, setActualPlacement] = useState<TooltipPlacement>(placement);

    const triggerRef = useRef<HTMLElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const calculatePosition = useCallback(() => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = 0;
        let left = 0;
        let finalPlacement = placement;

        const positions = {
            top: {
                top: triggerRect.top - tooltipRect.height - OFFSET,
                left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
            },
            bottom: {
                top: triggerRect.bottom + OFFSET,
                left: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
            },
            left: {
                top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
                left: triggerRect.left - tooltipRect.width - OFFSET
            },
            right: {
                top: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2,
                left: triggerRect.right + OFFSET
            }
        };

        const preferred = positions[placement];
        const fitsTop = preferred.top >= VIEWPORT_PADDING;
        const fitsBottom = preferred.top + tooltipRect.height <= vh - VIEWPORT_PADDING;
        const fitsLeft = preferred.left >= VIEWPORT_PADDING;
        const fitsRight = preferred.left + tooltipRect.width <= vw - VIEWPORT_PADDING;

        if (placement === 'top' && !fitsTop) {
            finalPlacement = 'bottom';
        } else if (placement === 'bottom' && !fitsBottom) {
            finalPlacement = 'top';
        } else if (placement === 'left' && !fitsLeft) {
            finalPlacement = 'right';
        } else if (placement === 'right' && !fitsRight) {
            finalPlacement = 'left';
        }

        const finalPos = positions[finalPlacement];
        top = finalPos.top;
        left = finalPos.left;

        if (left < VIEWPORT_PADDING) {
            left = VIEWPORT_PADDING;
        } else if (left + tooltipRect.width > vw - VIEWPORT_PADDING) {
            left = vw - tooltipRect.width - VIEWPORT_PADDING;
        }

        if (top < VIEWPORT_PADDING) {
            top = VIEWPORT_PADDING;
        } else if (top + tooltipRect.height > vh - VIEWPORT_PADDING) {
            top = vh - tooltipRect.height - VIEWPORT_PADDING;
        }

        setPosition({ top, left });
        setActualPlacement(finalPlacement);
    }, [placement]);

    const handleMouseEnter = useCallback((e: React.MouseEvent) => {
        if (disabled) return;

        const child = React.Children.only(children) as React.ReactElement<any>;
        if (isValidElement(child)) {
            const childProps = (child as any).props;
            if (childProps?.onMouseEnter) {
                childProps.onMouseEnter(e);
            }
        }

        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    }, [delay, disabled, children]);

    const handleMouseLeave = useCallback((e: React.MouseEvent) => {
        const child = React.Children.only(children) as React.ReactElement<any>;
        if (isValidElement(child)) {
            const childProps = (child as any).props;
            if (childProps?.onMouseLeave) {
                childProps.onMouseLeave(e);
            }
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    }, [children]);

    useEffect(() => {
        if (isVisible) {
            requestAnimationFrame(calculatePosition);
        }
    }, [isVisible, calculatePosition]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    if (!content) return <>{children}</>;

    const tooltipContent = isVisible ? createPortal(
        <div
            ref={tooltipRef}
            className={`volt-tooltip volt-tooltip-${actualPlacement} ${className} overflow-hidden`}
            style={{
                position: 'fixed',
                top: `${position.top}px`,
                left: `${position.left}px`,
                zIndex: 10000
            }}
            role="tooltip"
        >
            {content}
        </div>,
        document.body
    ) : null;

    const child = React.Children.only(children);
    if (!isValidElement(child)) {
        return <>{children}</>;
    }

    const clonedChild = cloneElement(child as ReactElement<any>, {
        ref: (node: HTMLElement) => {
            (triggerRef as React.MutableRefObject<HTMLElement | null>).current = node;
            const { ref } = child as any;
            if (typeof ref === 'function') {
                ref(node);
            } else if (ref && typeof ref === 'object') {
                (ref as React.MutableRefObject<HTMLElement | null>).current = node;
            }
        },
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave
    });

    return (
        <>
            {clonedChild}
            {tooltipContent}
        </>
    );
};

export default Tooltip;
