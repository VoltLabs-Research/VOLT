import { useEffect, useState, useRef } from 'react';

// TODO: fix "any"
const useJobProgress = (jobs: any, itemId: string): any => {
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [shouldHideBorder, setShouldHideBorder] = useState<boolean>(false);

    const completionTimeoutRef = useRef<number | null>(null);
    const previousCompletionRate = useRef<number>(0);

    const totalJobs = jobs._stats?.total || 0;
    const completionRate = jobs._stats?.completionRate || 0;
    const hasJobs = totalJobs > 0;
    const hasActiveJobs = jobs._stats?.hasActiveJobs || false;

    const getBorderColor = (): string => {
        if(!hasJobs || shouldHideBorder){
            return 'transparent';
        }

        if(completionRate === 100) return '#22c55e';
        if(completionRate >= 75) return '#3b82f6';
        if(completionRate >= 50) return '#f59e0b';
        if(completionRate >= 25) return '#f97316';

        return '#dc2626';
    };

    const getWaitingBorder = (): string => {
        return 'conic-gradient(from -90deg, #6b7280 0deg, #6b7280 90deg, transparent 90deg, transparent 360deg)';
    };

    const getProgressBorder = (): string => {
        if(!hasJobs || shouldHideBorder || completionRate === 0) return 'none';
        if(completionRate === 0 && hasActiveJobs){
            return getWaitingBorder();
        }

        const borderColor = getBorderColor();
        const degrees = (completionRate / 100) * 360;
        return `conic-gradient(from -90deg, ${borderColor} 0deg, ${borderColor} ${degrees}deg, transparent ${degrees}deg, transparent 360deg)`;
    };

    const cleanup = (): void => {
        if(completionTimeoutRef.current){
            clearTimeout(completionTimeoutRef.current);
        }
    };

    useEffect(() => {
        if(completionRate === 100 && previousCompletionRate.current !== 100 && hasJobs){
            console.log(`Item ${itemId} completed! Starting 5-second countdown...`);
            setIsCompleted(true);
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }

            completionTimeoutRef.current = setTimeout(() => {
                console.log(`Hiding progress border for item ${itemId}`);
                setShouldHideBorder(true);
                setIsCompleted(false);
            }, 5000);
        }else if(completionRate < 100 && previousCompletionRate.current === 1000){
            console.log(`Item ${itemId} has new jobs, showing border again`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if(!hasJobs){
            setShouldHideBorder(false);
            setIsCompleted(false);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }

        previousCompletionRate.current = completionRate;

        return () => {
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }
        };
    }, [completionRate, hasJobs, itemId]);

    return {
        totalJobs,
        completionRate,
        hasJobs,
        hasActiveJobs,
        isCompleted,
        shouldHideBorder,
        getBorderColor,
        getProgressBorder,
        cleanup
    };
};

export default useJobProgress;