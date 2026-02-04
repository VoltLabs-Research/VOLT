import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import useCanvasUIStore from '@/modules/canvas/presentation/stores/use-canvas-ui-store';
import Draggable from '@/shared/presentation/components/Draggable';
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

const EditorWidget = forwardRef<EditorWidgetRef, EditorWidgetProps>(
  ({ children, className = '', style = {}, draggable = true }, ref) => {
    const isSceneInteracting = useCanvasUIStore((s) => s.isSceneInteracting);
    const innerRef = useRef<any | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        getElement: () => innerRef.current?.getElement() ?? null,
        resetPosition: () => innerRef.current?.resetPosition(),
        setPosition: (x: number, y: number) => innerRef.current?.setPosition(x, y),
        getPosition: () => innerRef.current?.getPosition() ?? { x: 0, y: 0 },
      }),
      []
    );

    return (
      <Draggable
        ref={innerRef}
        enabled={draggable}
        doubleClickToDrag
        axis="both"
        scaleWhileDragging={0.95}
        bounds="parent"
        grid={undefined}
        className={`d-flex gap-1 editor-floating-container ${
          isSceneInteracting ? 'dimmed' : ''
        } ${className} p-absolute`}
        style={style}
      >
        {children}
      </Draggable>
    );
  }
);

EditorWidget.displayName = 'EditorWidget';
export default EditorWidget;
