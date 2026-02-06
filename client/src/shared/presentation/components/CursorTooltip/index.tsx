import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    autoPosition = true,
    interactive = false,
    offset = 16
}) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState<React.CSSProperties>({ top: y, left: x });

    useEffect(() => {
        if(!isOpen || !tooltipRef.current || !autoPosition){
            if(!autoPosition){
                setStyle({ top: y, left: x });
            }
            return;
        }

        const rect = tooltipRef.current.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const padding = 16;

        let left = x + offset;
        let top = y + offset;

        if(left + rect.width > vw - padding){
            left = x - rect.width - offset;
        }

        if(top + rect.height > vh - padding){
            top = y - rect.height - offset;
        }

        if(left < padding) left = padding;
        if(top < padding) top = padding;

        setStyle({ top: `${top}px`, left: `${left}px` });
    }, [x, y, isOpen, autoPosition, content, offset]);

    if(!isOpen) return null;

    return createPortal(
        <div
            ref={tooltipRef}
            className={`cursor-tooltip visible ${interactive ? 'interactive' : ''} ${className}`}
            style={style}
        >
            {content}
        </div>,
        document.body
    );
};

export default CursorTooltip;
