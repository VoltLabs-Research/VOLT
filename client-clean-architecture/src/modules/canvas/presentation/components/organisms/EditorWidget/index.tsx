import React, { forwardRef, useImperativeHandle } from 'react';
import { useUIStore } from '@/shared/presentation/stores/slices/ui';
import Draggable from '@/shared/presentation/components/atoms/common/Draggable';
import '@/modules/canvas/presentation/components/organisms/EditorWidget/EditorWidget.css';

interface EditorWidgetProps {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    draggable?: boolean;
}

export interface EditorWidgetRef {
    getElement: () => HTMLDivElement | null;
    resetPosition: () => void;
    setPosition: (x: number, y: number) => void;
    getPosition: () => { x: number; y: number };
}

const EditorWidget = forwardRef<EditorWidgetRef, EditorWidgetProps>((
    { children, className = '', style = {}, draggable = true }, ref
) => {
    const isSceneInteracting = useUIStore((s) => s.isSceneInteracting);
    const innerRef = React.useRef<any | null>(null);

    useImperativeHandle(ref, () => ({
        getElement: () => innerRef.current?.getElement() ?? null,
        resetPosition: () => innerRef.current?.resetPosition(),
        setPosition: (x: number, y: number) => innerRef.current?.setPosition(x, y),
        getPosition: () => innerRef.current?.getPosition() ?? { x: 0, y: 0 },
    }), []);

    return (
        <Draggable
            ref={innerRef}
            enabled={draggable}
            doubleClickToDrag
            axis="both"
            scaleWhileDragging={0.95}
            bounds="parent"
            grid={undefined}
            className={`d-flex gap-1 editor-floating-container ${isSceneInteracting ? 'dimmed' : ''} ${className} p-absolute p-1`}
            style={style}
        >
            {children}
        </Draggable>
    );
});

EditorWidget.displayName = 'EditorWidget';
export default EditorWidget;
