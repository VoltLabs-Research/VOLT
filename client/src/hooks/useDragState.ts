import { useState } from 'react';
import * as THREE from 'three';

export type DragMode = 'move' | 'rotate' | 'vertical';

export const useDragState = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<DragMode>('move');
    const [dragStartPos, setDragStartPos] = useState(new THREE.Vector3());
    const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
    const [dragStartRotation, setDragStartRotation] = useState(new THREE.Euler(0, 0, 0));

    const startDrag = (
        mode: DragMode,
        mouseCoords: { x: number, y: number },
        worldPos?: THREE.Vector3,
        currentRotation?: THREE.Euler
    ) => {
        setIsDragging(true);
        setDragMode(mode);
        setDragStartMouse(mouseCoords);

        if(worldPos) setDragStartPos(worldPos);
        if(currentRotation) setDragStartRotation(currentRotation.clone());
    };

    const endDrag = () => {
        setIsDragging(false);
        setDragMode('move');
    };

    return {
        isDragging,
        dragMode,
        dragStartPos,
        dragStartMouse,
        dragStartRotation,
        startDrag,
        endDrag,
        setDragMode
    }
};

export default useDragState;