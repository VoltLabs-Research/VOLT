import { useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMouseCoordinates, getPlaneIntersection, isClickNearAtoms } from '../utils/geometry';

interface AtomPosition {
    x: number;
    y: number;
    z: number;
    type: number;
}
type DragMode = 'move' | 'rotate' | 'vertical';

interface UseMouseEventsProps {
    atomPositions: AtomPosition[];
    scale: number;
    yOffset: number;
    ctrlPressed: boolean;
    shiftPressed: boolean;
    isDragging: boolean;
    dragMode: DragMode;
    dragStartPos: THREE.Vector3;
    dragStartMouse: { x: number; y: number };
    dragStartRotation: THREE.Euler;
    groupPosition: THREE.Vector3;
    groupRotation: THREE.Euler;
    startDrag: (mode: DragMode, mouseCoords: { x: number; y: number }, worldPos?: THREE.Vector3, currentRotation?: THREE.Euler) => void;
    endDrag: () => void;
    setGroupPosition: React.Dispatch<React.SetStateAction<THREE.Vector3>>;
    setGroupRotation: React.Dispatch<React.SetStateAction<THREE.Euler>>;
    setIsGroupSelected: React.Dispatch<React.SetStateAction<boolean>>;
    setAtomPositions: React.Dispatch<React.SetStateAction<AtomPosition[]>>;
    onCameraControlsEnable?: (enabled: boolean) => void;
}

const useMouseEvents = ({
    atomPositions,
    scale,
    yOffset,
    ctrlPressed,
    shiftPressed,
    isDragging,
    dragMode,
    dragStartPos,
    dragStartMouse,
    dragStartRotation,
    groupPosition,
    groupRotation,
    startDrag,
    endDrag,
    setGroupPosition,
    setGroupRotation,
    setIsGroupSelected,
    setAtomPositions,
    onCameraControlsEnable
}: UseMouseEventsProps) => {
    const { camera, raycaster, gl } = useThree();

    const handleMouseDown = useCallback((event: MouseEvent) => {
        const canvas = gl.domElement;
        if (event.target !== canvas) return;
        
        const mouseCoords = getMouseCoordinates(event, canvas);
        
        if (!isClickNearAtoms(mouseCoords, atomPositions, scale, yOffset, groupPosition, groupRotation, raycaster, camera)) {
            return;
        }
        
        event.preventDefault();
        event.stopPropagation();
        
        setIsGroupSelected(true);
        onCameraControlsEnable?.(false);
        
        const mode: DragMode = ctrlPressed ? 'rotate' : shiftPressed ? 'vertical' : 'move';
        const intersection = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset);
        
        startDrag(mode, mouseCoords, intersection || undefined, groupRotation);
    }, [gl.domElement, atomPositions, scale, yOffset, groupPosition, groupRotation, raycaster, camera, setIsGroupSelected, onCameraControlsEnable, ctrlPressed, shiftPressed, startDrag]);

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const mouseCoords = getMouseCoordinates(event, gl.domElement);
        
        if (dragMode === 'rotate') {
            const deltaX = (mouseCoords.x - dragStartMouse.x) * 2;
            const deltaY = (mouseCoords.y - dragStartMouse.y) * 2;
            
            const newRotation = new THREE.Euler(
                dragStartRotation.x + deltaY,
                dragStartRotation.y + deltaX,
                dragStartRotation.z
            );
            
            setGroupRotation(newRotation);
        } else {
            const intersection = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset);
            if (intersection) {
                const delta = intersection.clone().sub(dragStartPos);
                setGroupPosition(new THREE.Vector3(delta.x, groupPosition.y, delta.z));
            }
        }
    }, [isDragging, gl.domElement, dragMode, dragStartMouse, dragStartRotation, setGroupRotation, raycaster, camera, yOffset, dragStartPos, groupPosition.y, setGroupPosition]);

    const handleMouseUp = useCallback((event: MouseEvent) => {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        endDrag();
        onCameraControlsEnable?.(true);
        
        if (dragMode === 'move' || dragMode === 'vertical') {
            if (!groupPosition.equals(new THREE.Vector3(0, 0, 0))) {
                setAtomPositions(prev => {
                    return prev.map(atom => ({
                        ...atom,
                        x: atom.x + groupPosition.x / scale,
                        y: atom.y + groupPosition.z / scale,
                        z: atom.z + groupPosition.y / scale
                    }));
                });
                setGroupPosition(new THREE.Vector3(0, 0, 0));
            }
        }
    }, [isDragging, endDrag, onCameraControlsEnable, dragMode, groupPosition, setAtomPositions, scale, setGroupPosition]);

    useEffect(() => {
        const canvas = gl.domElement;
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [gl.domElement, handleMouseDown, handleMouseMove, handleMouseUp]);
};

export default useMouseEvents;