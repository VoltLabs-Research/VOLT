import { useEffect } from 'react';
import type { AtomPosition } from '../types';
import * as THREE from 'three';

interface UseKeyboardControlsProps {
    ctrlPressed: boolean;
    shiftPressed: boolean;
    isGroupSelected: boolean;
    setAtomPositions: React.Dispatch<React.SetStateAction<AtomPosition[]>>;
    setGroupRotation: React.Dispatch<React.SetStateAction<THREE.Euler>>;
    setIsGroupSelected: React.Dispatch<React.SetStateAction<boolean>>;
    resetTransforms: () => void;
    resetRotation: () => void;
    atomPositions: AtomPosition[];
}

const useKeyboardControls = ({
    ctrlPressed,
    shiftPressed,
    isGroupSelected,
    setAtomPositions,
    setGroupRotation,
    setIsGroupSelected,
    resetTransforms,
    resetRotation,
    atomPositions
}: UseKeyboardControlsProps) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if((ctrlPressed || shiftPressed) && 
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'q', 'Q', 'e', 'E'].includes(event.key)){
                event.preventDefault();
                
                const moveStep = 2.0;
                const rotationStep = 0.1;
                
                if(shiftPressed){
                    let deltaX = 0, deltaY = 0, deltaZ = 0;
                    
                    switch (event.key){
                        case 'ArrowUp':
                            deltaY = moveStep;
                            break;
                        case 'ArrowDown':
                            deltaY = -moveStep;
                            break;
                        case 'ArrowLeft':
                            deltaX = -moveStep;
                            break;
                        case 'ArrowRight':
                            deltaX = moveStep;
                            break;
                        case 'q':
                        case 'Q':
                            deltaZ = moveStep;
                            break;
                        case 'e':
                        case 'E':
                            deltaZ = -moveStep;
                            break;
                    }

                    setAtomPositions(prev => {
                        return prev.map(atom => ({
                            ...atom,
                            x: atom.x + deltaX,
                            y: atom.y + deltaY,
                            z: atom.z + deltaZ
                        }));
                    });
                    setIsGroupSelected(true);
                    
                }else if(ctrlPressed){
                    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)){
                        let deltaRotX = 0, deltaRotY = 0;
                        
                        switch (event.key){
                            case 'ArrowUp':
                                deltaRotX = -rotationStep;
                                break;
                            case 'ArrowDown':
                                deltaRotX = rotationStep;
                                break;
                            case 'ArrowLeft':
                                deltaRotY = -rotationStep;
                                break;
                            case 'ArrowRight':
                                deltaRotY = rotationStep;
                                break;
                        }

                        setGroupRotation(prev => new THREE.Euler(
                            prev.x + deltaRotX,
                            prev.y + deltaRotY,
                            prev.z
                        ));
                        setIsGroupSelected(true);
                    }
                }
            }

            if(event.key === 'g' || event.key === 'G'){
                setIsGroupSelected(true);
            }else if(event.key === 'Escape'){
                resetTransforms();
            }else if(event.key === 'r' || event.key === 'R'){
                resetRotation();
            }else if(event.key === 'c' || event.key === 'C'){
                const center = atomPositions.reduce((acc, atom) => {
                    acc.x += atom.x;
                    acc.y += atom.y;
                    acc.z += atom.z;
                    return acc;
                }, { x: 0, y: 0, z: 0 });
                
                center.x /= atomPositions.length;
                center.y /= atomPositions.length;
                center.z /= atomPositions.length;
                
                setAtomPositions(prev => prev.map(atom => ({
                    ...atom,
                    x: atom.x - center.x,
                    y: atom.y - center.y,
                    z: atom.z - center.z
                })));
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [ctrlPressed, shiftPressed, isGroupSelected, setAtomPositions, setGroupRotation, setIsGroupSelected, resetTransforms, resetRotation, atomPositions]);
};

export default useKeyboardControls;