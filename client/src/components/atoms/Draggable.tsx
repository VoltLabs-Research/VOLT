import React, { forwardRef, useImperativeHandle } from 'react';
import useDraggable, { type DraggableOptions, type DraggableHandle } from '@/hooks/ui/drag-drop/use-draggable';

export interface DraggableProps extends Omit<DraggableOptions, 'ondragStart' | 'onDrag' | 'onDragEnd'>{
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    onDragStart?: (pos: { x: number; y: number }) => void;
    onDrag?: (pos: { x: number; y: number }) => void;
    onDragEnd?: (pos: { x: number; y: number }) => void;
}

const Draggable = forwardRef<DraggableHandle, DraggableProps>((props, ref) => {
    const {
        className = '',
        style,
        children,
        ...opts
    } = props;

    const api = useDraggable(opts);

    useImperativeHandle(ref, () => ({
        getElement: api.getElement,
        resetPosition: api.resetPosition,
        setPosition: api.setPosition,
        getPosition: api.getPosition,
    }), [api]);

    return (
        <div
            ref={api.nodeRef}
            className={className}
            style={{
                willChange: 'transform',
                touchAction: 'none',
                ...style
            }}
        >
            {children}
        </div>
    );
});

Draggable.displayName = 'Draggable';

export default Draggable;