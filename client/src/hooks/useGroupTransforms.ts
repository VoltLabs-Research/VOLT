import { useState, useCallback } from 'react';
import * as THREE from 'three';

const useGroupTransforms = () => {
    const [groupRotation, setGroupRotation] = useState(new THREE.Euler(0, 0, 0));
    const [groupPosition, setGroupPosition] = useState(new THREE.Vector3(0, 0, 0));
    const [isGroupSelected, setIsGroupSelected] = useState(false);

    const resetTransforms = useCallback(() => {
        setGroupRotation(new THREE.Euler(0, 0, 0));
        setGroupPosition(new THREE.Vector3(0, 0, 0));
        setIsGroupSelected(false);
    }, [setGroupRotation, setGroupPosition, setIsGroupSelected]);

    const deselectGroup = useCallback(() => {
        setIsGroupSelected(false);
    }, [setIsGroupSelected]);

    const resetRotation = useCallback(() => {
        setGroupRotation(new THREE.Euler(0, 0, 0));
    }, [setGroupRotation]);

    return {
        groupRotation,
        setGroupRotation,
        groupPosition,
        setGroupPosition,
        isGroupSelected,
        setIsGroupSelected,
        resetTransforms,
        deselectGroup,
        resetRotation
    };
};

export default useGroupTransforms;