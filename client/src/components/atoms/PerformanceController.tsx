import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const SMOOTHING_FACTOR = 0.1;

const PerformanceController = ({
    targetFPS = 25,
    recoveryFPS = 35,
    minDpr = 0.5,
    maxDpr = 2,
    step = 0.1,
    cooldown = 0.2,
    setDpr
}) => {
    const smoothedFPS = useRef(60);
    const lastUpdateTime = useRef(0);

    useFrame((state, delta) => {
        const instantFPS = 1 / delta;

        if(delta === 0 || !isFinite(instantFPS)){
            return;
        }

        smoothedFPS.current = (
            (1 - SMOOTHING_FACTOR) * smoothedFPS.current + 
            SMOOTHING_FACTOR * instantFPS
        );

        const now = state.clock.elapsedTime;
        if(now - lastUpdateTime.current < cooldown){
            return;
        }

        if(instantFPS < targetFPS * 0.7){
            // It adjusts suddenly if it is a sudden fall
            smoothedFPS.current = instantFPS; 
        }

        if(smoothedFPS.current < targetFPS){
            setDpr((currentDpr: number) => {
                const newDpr = Math.max(minDpr, currentDpr - step);
                if(newDpr !== currentDpr){
                    console.log(`Low FPS (${smoothedFPS.current.toFixed(1)}), reducing DPR to ${newDpr.toFixed(2)}`);
                    lastUpdateTime.current = now;
                }

                return newDpr;
            });
        }else if(smoothedFPS.current > recoveryFPS){
            setDpr((currentDpr: number) => {
                const newDpr = Math.min(maxDpr, currentDpr + step);
                if(newDpr !== currentDpr){
                    console.log(`High FPS (${smoothedFPS.current.toFixed(1)}), increasing DPR to ${newDpr.toFixed(2)}`);
                    lastUpdateTime.current = now;
                }

                return newDpr;
            });
        }
    });
    
    return null;
};

export default PerformanceController;