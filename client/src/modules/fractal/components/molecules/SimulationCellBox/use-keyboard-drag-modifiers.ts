import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type DragAxisLock = 'x' | 'y' | 'z';

export const FLOOR_AXIS_LOCK: DragAxisLock = 'z';

const _cameraForward = new THREE.Vector3();

const isPrimaryDragModifierPressed = (event: KeyboardEvent) => event.ctrlKey || event.metaKey;

/**
 * Keyboard modifiers that steer model dragging: Alt swaps the floor axis lock
 * for the screen-facing vertical axis, and Ctrl/Cmd arms dragging on desktop.
 */
export const useKeyboardDragModifiers = (camera: THREE.Camera, isMobileViewport: boolean) => {
    const [axisLock, setAxisLock] = useState<DragAxisLock>(FLOOR_AXIS_LOCK);
    const [isModifierActive, setIsModifierActive] = useState(false);
    const axisLockRef = useRef<DragAxisLock>(FLOOR_AXIS_LOCK);
    axisLockRef.current = axisLock;

    const pickVerticalAxisLock = useCallback((): DragAxisLock => {
        camera.getWorldDirection(_cameraForward);
        return Math.abs(_cameraForward.x) > Math.abs(_cameraForward.y) ? 'y' : 'x';
    }, [camera]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Alt' && axisLockRef.current === FLOOR_AXIS_LOCK) {
                setAxisLock(pickVerticalAxisLock());
            }

            if (!isMobileViewport) {
                setIsModifierActive(isPrimaryDragModifierPressed(event));
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key === 'Alt') {
                setAxisLock(FLOOR_AXIS_LOCK);
            }

            if (!isMobileViewport) {
                setIsModifierActive(isPrimaryDragModifierPressed(event));
            }
        };
        const handleBlur = () => {
            setAxisLock(FLOOR_AXIS_LOCK);
            setIsModifierActive(false);
        };

        if (isMobileViewport) {
            setIsModifierActive(false);
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isMobileViewport, pickVerticalAxisLock]);

    return {
        axisLock,
        axisLockRef,
        isModifierActive
    };
};
