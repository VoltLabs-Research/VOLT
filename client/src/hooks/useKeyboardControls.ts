import { useEffect } from 'react';
import * as THREE from 'three';

interface AtomPosition {
    x: number;
    y: number;
    z: number;
    type: number;
}

interface UseKeyboardControlsProps {
    ctrlPressed: boolean;
    shiftPressed: boolean;
    isGroupSelected: boolean;
    setGroupPosition: React.Dispatch<React.SetStateAction<THREE.Vector3>>;
    setGroupRotation: React.Dispatch<React.SetStateAction<THREE.Euler>>;
    setIsGroupSelected: React.Dispatch<React.SetStateAction<boolean>>;
    resetTransforms: () => void;
    resetRotation: () => void;
}

const useKeyboardControls = ({
    ctrlPressed,
    shiftPressed,
    isGroupSelected,
    setGroupPosition,
    setGroupRotation,
    setIsGroupSelected,
    resetTransforms,
    resetRotation,
}: UseKeyboardControlsProps) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isGroupSelected) return;

            if((ctrlPressed || shiftPressed) && 
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'q', 'Q', 'e', 'E'].includes(event.key)){
                event.preventDefault();
                
                const moveStep = 0.5;
                const rotationStep = 0.1;
                
                if(shiftPressed){
                    let deltaX = 0, deltaY = 0, deltaZ = 0;
                    
                    switch (event.key){
                        case 'ArrowUp':
                            deltaZ = -moveStep;
                            break;
                        case 'ArrowDown':
                            deltaZ = moveStep;
                            break;
                        case 'ArrowLeft':
                            deltaX = -moveStep;
                            break;
                        case 'ArrowRight':
                            deltaX = moveStep;
                            break;
                        case 'q':
                        case 'Q':
                             deltaY = moveStep;
                            break;
                        case 'e':
                        case 'E':
                            deltaY = -moveStep;
                            break;
                    }

                    setGroupPosition(prev => new THREE.Vector3(
                        prev.x + deltaX,
                        prev.y + deltaY,
                        prev.z + deltaZ
                    ));
                    
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
                    }
                }
            }

            if(event.key === 'g' || event.key === 'G'){
                setIsGroupSelected(true);
            }else if(event.key === 'Escape'){
                resetTransforms();
            }else if(event.key === 'r' || event.key === 'R'){
                resetRotation();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [ctrlPressed, shiftPressed, isGroupSelected, setGroupPosition, setGroupRotation, setIsGroupSelected, resetTransforms, resetRotation]);
};

export default useKeyboardControls;