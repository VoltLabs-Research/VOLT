import { useState } from 'react';
import * as THREE from 'three';

const useGroupTransforms = () => {
    const [groupRotation, setGroupRotation] = useState(new THREE.Euler(0, 0, 0));
    const [groupPosition, setGroupPosition] = useState(new THREE.Vector3(0, 0, 0));
    const [isGroupSelected, setIsGroupSelected] = useState(false);

    const resetTransforms = () => {
        setGroupRotation(new THREE.Euler(0, 0, 0));
        setGroupPosition(new THREE.Vector3(0, 0, 0));
        setIsGroupSelected(false);
    };

    const resetRotation = () => {
        setGroupPosition(new THREE.Euler(0, 0, 0));
    };

    return {
        groupRotation,
        setGroupRotation,
        groupPosition,
        setGroupPosition,
        isGroupSelected,
        setIsGroupSelected,
        resetTransforms,
        resetRotation
    }
};

export default useGroupTransforms;