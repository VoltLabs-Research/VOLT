import { useRef, useCallback, useEffect, useState } from 'react';
import { Euler } from 'three';
import useModelKeyboardInteraction from '@/modules/fractal/hooks/use-model-keyboard-interaction';

interface RotatableObject {
    rotation: Euler;
};

interface InteractionState {
    currentRotation: Euler;
    targetRotation: Euler | null;
    selectedObject: RotatableObject | null;
};

interface UseModelInteractionParams {
    onSelect?: () => void;
    onInvalidate?: () => void;
};

interface UseModelInteractionReturn {
    isSelected: boolean;
    isHovered: boolean;
    deselect: () => void;
    resetTransform: () => void;
    rotateXNegative: () => void;
    rotateXPositive: () => void;
    rotateYNegative: () => void;
    rotateYPositive: () => void;
    rotateZNegative: () => void;
    rotateZPositive: () => void;
    setSelectedObject: (target: RotatableObject | null) => void;
    onHoverChange: (hovered: boolean) => void;
};

const LERP_ROTATION = 0.18;
const ROTATION_STEP = Math.PI / 24;

export default function useModelInteraction({
    onSelect,
    onInvalidate
}: UseModelInteractionParams): UseModelInteractionReturn {
    const [isHovered, setIsHovered] = useState(false);
    const [isSelected, setIsSelected] = useState(false);
    const animationFrameRef = useRef<number | null>(null);

    const stateRef = useRef<InteractionState>({
        currentRotation: new Euler(0, 0, 0),
        targetRotation: null,
        selectedObject: null
    });

    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;

    const onInvalidateRef = useRef(onInvalidate);
    onInvalidateRef.current = onInvalidate;

    const stopAnimation = useCallback(() => {
        if (animationFrameRef.current !== null) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const runAnimation = useCallback(() => {
        stopAnimation();

        const tick = () => {
            const interaction = stateRef.current;
            const selectedObject = interaction.selectedObject;
            const targetRotation = interaction.targetRotation;

            if (!selectedObject || !targetRotation) {
                animationFrameRef.current = null;
                return;
            }

            interaction.currentRotation.x += (targetRotation.x - interaction.currentRotation.x) * LERP_ROTATION;
            interaction.currentRotation.y += (targetRotation.y - interaction.currentRotation.y) * LERP_ROTATION;
            interaction.currentRotation.z += (targetRotation.z - interaction.currentRotation.z) * LERP_ROTATION;

            selectedObject.rotation.copy(interaction.currentRotation);
            onInvalidateRef.current?.();

            const isSettled =
                Math.abs(targetRotation.x - interaction.currentRotation.x) < 1e-3 &&
                Math.abs(targetRotation.y - interaction.currentRotation.y) < 1e-3 &&
                Math.abs(targetRotation.z - interaction.currentRotation.z) < 1e-3;

            if (isSettled) {
                selectedObject.rotation.copy(targetRotation);
                interaction.currentRotation.copy(targetRotation);
                onInvalidateRef.current?.();
                animationFrameRef.current = null;
                return;
            }

            animationFrameRef.current = window.requestAnimationFrame(tick);
        };

        animationFrameRef.current = window.requestAnimationFrame(tick);
    }, [stopAnimation]);

    const rotate = useCallback((dx: number, dy: number, dz: number) => {
        const interaction = stateRef.current;
        if (!interaction.selectedObject) {
            return;
        }

        const nextRotation = interaction.targetRotation?.clone() ?? interaction.currentRotation.clone();
        nextRotation.x += dx;
        nextRotation.y += dy;
        nextRotation.z += dz;
        interaction.targetRotation = nextRotation;

        runAnimation();
    }, [runAnimation]);

    const deselect = useCallback(() => {
        const interaction = stateRef.current;
        interaction.selectedObject = null;
        interaction.targetRotation = null;
        setIsSelected(false);
        stopAnimation();
    }, [stopAnimation]);

    const resetTransform = useCallback(() => {
        const interaction = stateRef.current;
        if (!interaction.selectedObject) {
            return;
        }

        interaction.targetRotation = new Euler(0, 0, 0);
        runAnimation();
    }, [runAnimation]);

    const setSelectedObject = useCallback((target: RotatableObject | null) => {
        const interaction = stateRef.current;
        interaction.selectedObject = target;

        if (!target) {
            interaction.targetRotation = null;
            setIsSelected(false);
            stopAnimation();
            return;
        }

        interaction.currentRotation = target.rotation.clone();
        interaction.targetRotation = target.rotation.clone();
        setIsSelected(true);
        onSelectRef.current?.();
    }, [stopAnimation]);

    const onHoverChange = useCallback((hovered: boolean) => {
        setIsHovered(hovered);
    }, []);

    const rotateXNegative = useCallback(() => {
        rotate(-ROTATION_STEP, 0, 0);
    }, [rotate]);

    const rotateXPositive = useCallback(() => {
        rotate(ROTATION_STEP, 0, 0);
    }, [rotate]);

    const rotateYNegative = useCallback(() => {
        rotate(0, -ROTATION_STEP, 0);
    }, [rotate]);

    const rotateYPositive = useCallback(() => {
        rotate(0, ROTATION_STEP, 0);
    }, [rotate]);

    const rotateZNegative = useCallback(() => {
        rotate(0, 0, -ROTATION_STEP);
    }, [rotate]);

    const rotateZPositive = useCallback(() => {
        rotate(0, 0, ROTATION_STEP);
    }, [rotate]);

    useModelKeyboardInteraction({
        enabled: isSelected,
        onRotateXNegative: rotateXNegative,
        onRotateXPositive: rotateXPositive,
        onRotateYNegative: rotateYNegative,
        onRotateYPositive: rotateYPositive,
        onRotateZNegative: rotateZNegative,
        onRotateZPositive: rotateZPositive,
        onDeselect: deselect
    });

    useEffect(() => {
        return () => {
            stopAnimation();
        };
    }, [stopAnimation]);

    return {
        isSelected,
        isHovered,
        deselect,
        resetTransform,
        rotateXNegative,
        rotateXPositive,
        rotateYNegative,
        rotateYPositive,
        rotateZNegative,
        rotateZPositive,
        setSelectedObject,
        onHoverChange
    };
}
