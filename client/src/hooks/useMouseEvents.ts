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
    atoms: AtomPosition[];
    scale: number;
    yOffset: number;
    ctrlPressed: boolean;
    shiftPressed: boolean;
    isDragging: boolean;
    isGroupSelected: boolean;
    dragMode: DragMode;
    dragStartPos: THREE.Vector3;
    dragStartMouse: { x: number; y: number };
    dragStartRotation: THREE.Euler;
    groupPosition: THREE.Vector3;
    groupRotation: THREE.Euler;
    startDrag: (mode: DragMode, mouseCoords: { x: number; y: number }, worldPos?: THREE.Vector3, currentRotation?: THREE.Euler) => void;
    endDrag: () => void;
    deselectGroup: () => void;
    setGroupPosition: React.Dispatch<React.SetStateAction<THREE.Vector3>>;
    setGroupRotation: React.Dispatch<React.SetStateAction<THREE.Euler>>;
    setIsGroupSelected: React.Dispatch<React.SetStateAction<boolean>>;
    onCameraControlsEnable?: (enabled: boolean) => void;
}

const useMouseEvents = ({
    atoms,
    scale,
    yOffset,
    ctrlPressed,
    shiftPressed,
    isDragging,
    isGroupSelected,
    dragMode,
    dragStartPos,
    dragStartMouse,
    dragStartRotation,
    groupPosition,
    groupRotation,
    startDrag,
    endDrag,
    deselectGroup,
    setGroupPosition,
    setGroupRotation,
    setIsGroupSelected,
    onCameraControlsEnable
}: UseMouseEventsProps) => {
    const { camera, raycaster, gl } = useThree();

    const handleMouseDown = useCallback((event: MouseEvent) => {
        const canvas = gl.domElement;
        if (event.target !== canvas) return;
        
        const mouseCoords = getMouseCoordinates(event, canvas);
        
        if (isClickNearAtoms(mouseCoords, atoms, scale, yOffset, groupPosition, groupRotation, raycaster, camera)) {
            event.preventDefault();
            event.stopPropagation();
            
            setIsGroupSelected(true);
            onCameraControlsEnable?.(false);
            
            const mode: DragMode = ctrlPressed ? 'rotate' : shiftPressed ? 'vertical' : 'move';
            const planeIntersectionPoint = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset + groupPosition.y);
            
            if (planeIntersectionPoint) {
                const dragStartOffset = planeIntersectionPoint.clone().sub(groupPosition);
                startDrag(mode, mouseCoords, dragStartOffset, groupRotation);
            }
        } else {
            if (isGroupSelected) {
                deselectGroup();
            }
        }
    }, [
        gl.domElement, atoms, scale, yOffset, groupPosition, groupRotation, 
        raycaster, camera, setIsGroupSelected, onCameraControlsEnable, 
        ctrlPressed, shiftPressed, startDrag, isGroupSelected, deselectGroup
    ]);

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
            const intersection = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset + groupPosition.y);
            if (intersection) {
                const newPosition = intersection.clone().sub(dragStartPos);
                if (dragMode === 'vertical') {
                    setGroupPosition(new THREE.Vector3(groupPosition.x, newPosition.y, groupPosition.z));
                } else {
                    setGroupPosition(new THREE.Vector3(newPosition.x, groupPosition.y, newPosition.z));
                }
            }
        }
    }, [isDragging, gl.domElement, dragMode, dragStartMouse, dragStartRotation, groupPosition, setGroupRotation, raycaster, camera, yOffset, dragStartPos, setGroupPosition]);

    const handleMouseUp = useCallback((event: MouseEvent) => {
        if (!isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        endDrag();
        onCameraControlsEnable?.(true);
        
    }, [isDragging, endDrag, onCameraControlsEnable]);

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