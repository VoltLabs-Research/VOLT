import React, { forwardRef, useImperativeHandle } from 'react';
import useEditorUIStore from '@/stores/ui/editor';
import Draggable from '@/components/atoms/common/Draggable';
import './EditorWidget.css';

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
    const isSceneInteracting = useEditorUIStore((s) => s.isSceneInteracting);
    const innerRef = React.useRef<any | null>(null);

    useImperativeHandle(ref, () => ({
        getElement: () => innerRef.current?.getElement() ?? null,
        resetPosition: () => innerRef.current?.resetPosition(),
        setPosition: (x: number, y: number) =>   innerRef.current?.setPosition(x, y),
        getPosition: () => innerRef.current?.getPosition() ?? { x: 0, y: 0 },
    }), []);

    return(
        <Draggable
            ref={innerRef}
            enabled={draggable}
            doubleClickToDrag
            axis="both"
            scaleWhileDragging={0.95}
            bounds="parent"
            grid={undefined}
            className={`editor-floating-container ${isSceneInteracting ? 'dimmed' : ''} ${className}`}
            style={style}
        >
            {children}
        </Draggable>
    );
});

EditorWidget.displayName = 'EditorWidget';
export default EditorWidget;
