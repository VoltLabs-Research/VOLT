/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React, { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

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

    const triggerRef = useRef<HTMLSpanElement>(null);
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

        // Check if preferred placement fits
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

        // Clamp horizontal position
        if (left < VIEWPORT_PADDING) {
            left = VIEWPORT_PADDING;
        } else if (left + tooltipRect.width > vw - VIEWPORT_PADDING) {
            left = vw - tooltipRect.width - VIEWPORT_PADDING;
        }

        // Clamp vertical position
        if (top < VIEWPORT_PADDING) {
            top = VIEWPORT_PADDING;
        } else if (top + tooltipRect.height > vh - VIEWPORT_PADDING) {
            top = vh - tooltipRect.height - VIEWPORT_PADDING;
        }

        setPosition({ top, left });
        setActualPlacement(finalPlacement);
    }, [placement]);

    const handleMouseEnter = useCallback(() => {
        if (disabled) return;

        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    }, [delay, disabled]);

    const handleMouseLeave = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setIsVisible(false);
    }, []);

    // Recalculate position when visible
    useEffect(() => {
        if (isVisible) {
            // Use RAF to ensure tooltip is rendered before calculating
            requestAnimationFrame(calculatePosition);
        }
    }, [isVisible, calculatePosition]);

    // Cleanup on unmount
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
            className={`volt-tooltip volt-tooltip-${actualPlacement} ${className}`}
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

    return (
        <>
            <span
                ref={triggerRef}
                className="volt-tooltip-trigger"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
            >
                {children}
            </span>
            {tooltipContent}
        </>
    );
};

export default Tooltip;
