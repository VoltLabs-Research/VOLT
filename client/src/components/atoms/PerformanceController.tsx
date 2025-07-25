import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface PerformanceControllerProps {
    targetFPS?: number;
    recoveryFPS?: number;
    minDpr?: number;
    maxDpr?: number;
    step?: number;
    cooldown?: number;
    setDpr?: (dpr: number) => void;
}

const PerformanceController = ({
    targetFPS = 25,
    recoveryFPS = 35,
    minDpr = 0.5,
    maxDpr = 2,
    step = 0.1,
    cooldown = 0.2,
    setDpr
}: PerformanceControllerProps) => {
    const { gl } = useThree();
    const targetDpr = useRef(gl.getPixelRatio());
    const lastDecision = useRef(0);
    const stableFrames = useRef(0);
    const needsRecovery = useRef(false);

    useEffect(() => {
        targetDpr.current = maxDpr;
        setDpr(maxDpr);
    }, [gl, maxDpr, setDpr]);

    useFrame(({ clock }, delta) => {
        const fps = 1 / delta;
        const now = clock.elapsedTime;

        // Only make decision at the specified cooldown interval
        if(now - lastDecision.current > cooldown){
            if(fps < targetFPS){
                // If FPS is below target, reduce DPR
                targetDpr.current = Math.max(minDpr, targetDpr.current - step);
                needsRecovery.current = true;
                stableFrames.current = 0;
            }else if(fps > recoveryFPS){
                // If FPS is good, count stable frames
                stableFrames.current++;
                // If we have enough stable frames and we're not at max DPR, try to increase it
                if(stableFrames.current > 3){
                    // If we're already at max DPR, no need to recover
                    if(Math.abs(targetDpr.current - maxDpr) < 0.01){
                        needsRecovery.current = false;
                    }else if(needsRecovery.current){
                        // Increase DPR more aggresively when recovering
                        const newDpr = Math.min(
                            maxDpr,
                            targetDpr.current + (step * 1.5)
                        );
                        targetDpr.current = newDpr;
                        // If we've reached max DPR, mark recovery as complete
                        if(Math.abs(newDpr - maxDpr) < 0.01){
                            needsRecovery.current = false;
                        }
                    }

                    stableFrames.current = 0;
                }
            }else{
                // Reset stable frames counter if FPS is in the middle range
                stableFrames.current = 0;
            }

            lastDecision.current = now;
        }

        // Smoothly transition to target DPR
        const current = gl.getPixelRatio();
        // higher = smoother but slower
        const dampingFactor = 5;
        const smooth = THREE.MathUtils.damp(current, targetDpr.current, dampingFactor, delta);

        // Only update if the change is signifcant
        if(Math.abs(smooth - current) > 0.01){
            setDpr(smooth);
        }
    });
    
    return null;
};

export default PerformanceController;