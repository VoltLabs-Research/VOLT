import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './CursorTooltip.css';

interface CursorTooltipProps {
    isOpen: boolean;
    x: number;
    y: number;
    content?: React.ReactNode;
    className?: string;
    // If true, the tooltip will try to stay within viewport bounds
    autoPosition?: boolean;
    interactive?: boolean;
    offset?: number;
    disableDefaultStyles?: boolean;
}

const CursorTooltip: React.FC<CursorTooltipProps> = ({
    isOpen,
    x,
    y,
    content,
    className = '',
    autoPosition = true,
    interactive = false,
    offset = 16,
    disableDefaultStyles = false
}) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({
        top: y,
        left: x
    });

    useEffect(() => {
        if (!isOpen || !tooltipRef.current || !autoPosition) {
            if (!autoPosition) {
                setStyle({ top: y, left: x });
            }
            return;
        }

        const rect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 16;
        // const offset = 16; // Used param instead


        let left = x + offset;
        let top = y + offset;

        // Check right edge
        if (left + rect.width > vw - padding) {
            left = x - rect.width - offset;
        }

        // Check bottom edge
        if (top + rect.height > vh - padding) {
            top = y - rect.height - offset;
        }

        // Check left edge (if flipped)
        if (left < padding) left = padding;

        // Check top edge (if flipped)
        if (top < padding) top = padding;

        setStyle({
            top: `${top}px`,
            left: `${left}px`
        });
    }, [x, y, isOpen, autoPosition, content]);

    if (!isOpen) return null;

    const baseClass = disableDefaultStyles ? 'cursor-tooltip-structure' : 'cursor-tooltip visible';

    return createPortal(
        <div
            ref={tooltipRef}
            className={`${baseClass} ${interactive ? 'interactive' : ''} ${className}`}
            style={style}
        >
            {content}
        </div>,
        document.body
    );
};

export default CursorTooltip;
