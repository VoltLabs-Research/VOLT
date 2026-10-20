import { useCallback, useEffect, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';

const DOUBLE_TAP_MAX_DELAY_MS = 320;
const DOUBLE_TAP_MAX_DISTANCE_PX = 24;
const TOUCH_DRAG_ARM_TIMEOUT_MS = 800;

export const useTouchDragArming = (isMobileViewport: boolean) => {
    const lastPointerTypeRef = useRef<string | null>(null);
    const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
    const armedRef = useRef(false);
    const armTimerRef = useRef<number | null>(null);

    const clearArmTimer = useCallback(() => {
        if (armTimerRef.current !== null) {
            window.clearTimeout(armTimerRef.current);
            armTimerRef.current = null;
        }
    }, []);

    const disarm = useCallback(() => {
        armedRef.current = false;
        clearArmTimer();
    }, [clearArmTimer]);

    useEffect(() => {
        return () => clearArmTimer();
    }, [clearArmTimer]);

    const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
        lastPointerTypeRef.current = event.pointerType;
        if (!isMobileViewport || event.pointerType !== 'touch') {
            return;
        }

        const previousTap = lastTapRef.current;
        const now = Date.now();
        const isDoubleTap = Boolean(
            previousTap &&
            now - previousTap.time <= DOUBLE_TAP_MAX_DELAY_MS &&
            Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= DOUBLE_TAP_MAX_DISTANCE_PX
        );

        lastTapRef.current = {
            time: now,
            x: event.clientX,
            y: event.clientY
        };

        if (!isDoubleTap) {
            disarm();
            return;
        }

        armedRef.current = true;
        clearArmTimer();
        armTimerRef.current = window.setTimeout(() => {
            armedRef.current = false;
            armTimerRef.current = null;
        }, TOUCH_DRAG_ARM_TIMEOUT_MS);
    }, [clearArmTimer, disarm, isMobileViewport]);

    const isTouchGesture = useCallback(
        () => isMobileViewport && lastPointerTypeRef.current === 'touch',
        [isMobileViewport]
    );

    const consumeArming = useCallback(() => {
        if (!armedRef.current) {
            return false;
        }

        disarm();
        return true;
    }, [disarm]);

    return {
        handlePointerDown,
        isTouchGesture,
        consumeArming
    };
};
