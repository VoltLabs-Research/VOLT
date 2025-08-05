/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useEffect, useState, useRef, useMemo } from 'react';
import type { Job } from '@/types/jobs';

interface JobProgressResult {
    totalJobs: number;
    completionRate: number;
    hasJobs: boolean;
    hasActiveJobs: boolean;
    isCompleted: boolean;
    shouldHideBorder: boolean;
    getBorderColor: () => string;
    getProgressBorder: () => string;
    cleanup: () => void;
}

const useJobProgress = (jobs: Job[], itemId: string): JobProgressResult => {
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [shouldHideBorder, setShouldHideBorder] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);

    const completionTimeoutRef = useRef<number | null>(null);
    const previousCompletionRate = useRef<number>(0);
    const previousTotalJobs = useRef<number>(0);
    const hasBeenCompleted = useRef<boolean>(false);

    const jobStats = useMemo(() => ({
        totalJobs: jobs._stats?.total || 0,
        completionRate: jobs._stats?.completionRate || 0,
        hasJobs: (jobs._stats?.total || 0) > 0,
        hasActiveJobs: jobs._stats?.hasActiveJobs || false
    }), [jobs._stats?.total, jobs._stats?.completionRate, jobs._stats?.hasActiveJobs]);

    const { totalJobs, completionRate, hasJobs, hasActiveJobs } = jobStats;

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
        // If there are no jobs or you need to hide the border, show nothing
        if(!hasJobs || shouldHideBorder) return 'none';
        
        // If the completion rate is 0 but there are active jobs, display the waiting border
        if(completionRate === 0 && hasActiveJobs){
            return getWaitingBorder();
        }
        
        // If the completion rate is 0 and there are no active jobs, do not show the border.
        if(completionRate === 0) return 'none';

        // If there is progress, show the progress border
        const borderColor = getBorderColor();
        const degrees = (completionRate / 100) * 360;
        return `conic-gradient(from -90deg, ${borderColor} 0deg, ${borderColor} ${degrees}deg, transparent ${degrees}deg, transparent 360deg)`;
    };

    const cleanup = (): void => {
        if(completionTimeoutRef.current){
            clearTimeout(completionTimeoutRef.current);
            completionTimeoutRef.current = null;
        }
    };

    useEffect(() => {
        if(!isInitialized && hasJobs){
            console.log(`Initializing job progress for item ${itemId}`);
            previousCompletionRate.current = completionRate;
            previousTotalJobs.current = totalJobs;
            hasBeenCompleted.current = completionRate === 100;
            setIsInitialized(true);
        }
    }, [itemId, hasJobs, completionRate, totalJobs, isInitialized]);

    useEffect(() => {
        if(!isInitialized || !hasJobs){
            return;
        }

        const hasNewJobs = totalJobs > previousTotalJobs.current;
        const completionChanged = completionRate !== previousCompletionRate.current;
        const wasCompleted = previousCompletionRate.current === 100;
        const isNowCompleted = completionRate === 100;

        // If there are new jobs, reset status but keep progress
        if(hasNewJobs){
            console.log(`Item ${itemId}: New jobs detected (${previousTotalJobs.current} -> ${totalJobs})`);
            
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if(isNowCompleted && !wasCompleted && !hasBeenCompleted.current){
            // If completed for the first time
            console.log(`Item ${itemId} completed! Starting 5-second countdown...`);
            setIsCompleted(true);
            hasBeenCompleted.current = true;
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }

            completionTimeoutRef.current = window.setTimeout(() => {
                console.log(`Hiding progress border for item ${itemId}`);
                setShouldHideBorder(true);
                setIsCompleted(false);
            }, 5000);
        }else if(!isNowCompleted && wasCompleted){
            // If it changed from completed to not completed (new jobs while in countdown)
            console.log(`Item ${itemId} has new jobs while was completed, showing border again`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if (completionChanged && !isNowCompleted) {
            // Progress update only (no resetting)
            console.log(`Item ${itemId}: Progress update ${previousCompletionRate.current}% -> ${completionRate}%`);
        }

        // Update references for the next comparison
        previousCompletionRate.current = completionRate;
        previousTotalJobs.current = totalJobs;
    }, [itemId, completionRate, totalJobs, hasJobs, isInitialized]);

    useEffect(() => {
        if(!hasJobs && isInitialized){
            console.log(`Item ${itemId}: No jobs, resetting states`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            setIsInitialized(false);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }
    }, [hasJobs, itemId, isInitialized]);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [itemId]);

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