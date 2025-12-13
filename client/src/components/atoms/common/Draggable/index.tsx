import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import useDraggable, { type DraggableOptions, type DraggableHandle } from '@/hooks/ui/drag-drop/use-draggable';
import './Draggable.css';

export interface DraggableProps extends Omit<DraggableOptions, 'ondragStart' | 'onDrag' | 'onDragEnd'>{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onDragStart?: (pos: { x: number; y: number }) => void;
    onDrag?: (pos: { x: number; y: number }) => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
    resizable?: boolean;
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
}

const Draggable = forwardRef<DraggableHandle, DraggableProps>((props, ref) => {
    const {
        className = '',
        style,
        children,
        resizable = false,
        minWidth = 300,
        minHeight = 200,
        maxWidth,
        maxHeight,
            ...opts
    } = props;

    const api = useDraggable(opts);
    const resizeRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        if(!resizable || !api.nodeRef.current) return;

        const element = api.nodeRef.current;
        const rect = element.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
    }, [resizable, api.nodeRef]);

    useEffect(() => {
        if(!resizable || !resizeRef.current) return;

        const resizeHandle = resizeRef.current;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        const onResizeStart = (e: PointerEvent) => {
            e.stopPropagation();
            e.preventDefault();

            setIsResizing(true);
            startX = e.clientX;
            startY = e.clientY;
            startWidth = size.width;
            startHeight = size.height;

            document.body.style.cursor = 'nwse-resize';
            resizeHandle.setPointerCapture(e.pointerId);
        };

        const onResizeMove = (e: PointerEvent) => {
            if(!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newWidth = startWidth + deltaX;
            let newHeight = startHeight + deltaY;

            // Apply constraints
            newWidth = Math.max(minWidth, newWidth);
            newHeight = Math.max(minHeight, newHeight);

            if(maxWidth) newWidth = Math.min(maxWidth, newWidth);
            if(maxHeight) newHeight = Math.min(maxHeight, newHeight);

            setSize({ width: newWidth, height: newHeight });
        };

        const onResizeEnd = (e: PointerEvent) => {
            if(!isResizing) return;

            setIsResizing(false);
            document.body.style.cursor = '';

            try{
                resizeHandle.releasePointerCapture(e.pointerId);
            } catch {}
        };

        resizeHandle.addEventListener('pointerdown', onResizeStart);
        window.addEventListener('pointermove', onResizeMove);
        window.addEventListener('pointerup', onResizeEnd);

        return() => {
            resizeHandle.removeEventListener('pointerdown', onResizeStart);
            window.removeEventListener('pointermove', onResizeMove);
            window.removeEventListener('pointerup', onResizeEnd);
        };
    }, [resizable, size, isResizing, minWidth, minHeight, maxWidth, maxHeight]);

    useImperativeHandle(ref, () => ({
        getElement: api.getElement,
        resetPosition: api.resetPosition,
        setPosition: api.setPosition,
        getPosition: api.getPosition,
    }), [api]);

    const containerStyle: React.CSSProperties = {
        willChange: 'transform',
        touchAction: 'none',
            ...style,
            ...(resizable && size.width > 0 ? {
            width: `${size.width}px`,
            height: `${size.height}px`,
            position: 'relative'
        } : {})
    };

    return(
        <div
            ref={api.nodeRef}
            className={className}
            style={containerStyle}
        >
                {children}
                {resizable && (
                    <div
                        ref={resizeRef}
                        style={{
                            position: 'absolute',
                            right: 0,
                            bottom: 0,
                            width: '20px',
                            height: '20px',
                            cursor: 'nwse-resize',
                            zIndex: 10,
                            background: 'transparent'
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            position: 'absolute',
                            right: '2px',
                            bottom: '2px',
                            width: '12px',
                            height: '12px',
                            borderRight: '2px solid rgba(255, 255, 255, 0.3)',
                            borderBottom: '2px solid rgba(255, 255, 255, 0.3)',
                        }} />
                    </div>
                )}
            </div>
    );
});

Draggable.displayName = 'Draggable';

export default Draggable;
