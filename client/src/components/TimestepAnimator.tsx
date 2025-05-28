import React, { useRef, useCallback, useEffect } from 'react';

const TimestepAnimator: React.FC<{
    timesteps: number[];
    currentTimestep: number;
    onTimestepChange: (timestep: number) => void;
    isPlaying: boolean;
    playSpeed: number;
}> = ({ timesteps, currentTimestep, onTimestepChange, isPlaying, playSpeed }) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const advanceFrame = useCallback(() => {
        if (!isPlaying || timesteps.length === 0) return;
        
        const currentIndex = timesteps.indexOf(currentTimestep);
        const nextIndex = (currentIndex + 1) % timesteps.length;
        onTimestepChange(timesteps[nextIndex]);
        
        const interval = 25 / playSpeed;
        timeoutRef.current = setTimeout(advanceFrame, interval);
    }, [timesteps, currentTimestep, onTimestepChange, isPlaying, playSpeed]);

    useEffect(() => {
        if (isPlaying && timesteps.length > 0) {
            const interval = 25 / playSpeed;
            timeoutRef.current = setTimeout(advanceFrame, interval);
        } else {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [isPlaying, playSpeed, advanceFrame]);

    return null;
};

export default TimestepAnimator;
