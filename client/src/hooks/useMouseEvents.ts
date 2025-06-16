import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { DragMode } from './useDragState';
import * as THREE from 'three';
import { getMouseCoordinates, getPlaneIntersection, isClickNearAtoms } from '../utils/geometry';

interface UseMouseEventsProps {
    anys: any[];
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
    setanys: React.Dispatch<React.SetStateAction<any[]>>;
    onCameraControlsEnable?: (enabled: boolean) => void;
}

const useMouseEvents = ({
    anys,
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
    setanys,
    onCameraControlsEnable
}: UseMouseEventsProps) => {
    const { camera, raycaster, gl } = useThree();

    useEffect(() => {
        const canvas = gl.domElement;
        
        const handleMouseDown = (event: MouseEvent) => {
            if(event.target !== canvas) return;
            
            const mouseCoords = getMouseCoordinates(event, canvas);
            
            if(!isClickNearAtoms(mouseCoords, anys, scale, yOffset, groupPosition, groupRotation, raycaster, camera)){
                return;
            }
            
            event.preventDefault();
            event.stopPropagation();
            
            setIsGroupSelected(true);
            onCameraControlsEnable?.(false);
            
            const mode: DragMode = ctrlPressed ? 'rotate' : shiftPressed ? 'vertical' : 'move';
            const intersection = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset);
            
            startDrag(mode, mouseCoords, intersection || undefined, groupRotation);
        };

        const handleMouseMove = (event: MouseEvent) => {
            if (!isDragging) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            const mouseCoords = getMouseCoordinates(event, canvas);
            
            if(dragMode === 'rotate'){
                const deltaX = (mouseCoords.x - dragStartMouse.x) * 2;
                const deltaY = (mouseCoords.y - dragStartMouse.y) * 2;
                
                const newRotation = new THREE.Euler(
                    dragStartRotation.x + deltaY,
                    dragStartRotation.y + deltaX,
                    dragStartRotation.z
                );
                
                setGroupRotation(newRotation);
            }else{
                const intersection = getPlaneIntersection(mouseCoords, raycaster, camera, yOffset);
                if(intersection){
                    const delta = intersection.clone().sub(dragStartPos);
                    setGroupPosition(new THREE.Vector3(delta.x, groupPosition.y, delta.z));
                }
            }
        };

        const handleMouseUp = (event: MouseEvent) => {
            if(!isDragging) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            endDrag();
            onCameraControlsEnable?.(true);
            
            if(dragMode === 'move' || dragMode === 'vertical'){
                if(!groupPosition.equals(new THREE.Vector3(0, 0, 0))){
                    setanys(prev => {
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
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseUp);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseUp);
        };
    }, [isDragging, dragStartPos, dragStartMouse, dragStartRotation, groupPosition, groupRotation, scale, gl.domElement, camera, raycaster, onCameraControlsEnable, anys, yOffset, ctrlPressed, shiftPressed, dragMode, startDrag, endDrag, setGroupPosition, setGroupRotation, setIsGroupSelected, setanys]);
};

export default useMouseEvents;