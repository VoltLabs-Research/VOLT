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

import { useEffect, useState, useRef } from 'react';

interface JobStats {
    total: number;
    completionRate: number;
    hasActiveJobs: boolean;
}

interface Jobs {
    _stats?: JobStats;
}

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

const useJobProgress = (jobs: Jobs, itemId: string): JobProgressResult => {
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
        }
    };

    useEffect(() => {
        if(completionRate === 100 && previousCompletionRate.current !== 100 && hasJobs){
            console.log(`Item ${itemId} completed! Starting 5-second countdown...`);
            setIsCompleted(true);
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }

            completionTimeoutRef.current = window.setTimeout(() => {
                console.log(`Hiding progress border for item ${itemId}`);
                setShouldHideBorder(true);
                setIsCompleted(false);
            }, 5000);
        }else if(completionRate < 100 && previousCompletionRate.current === 100){
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

    useEffect(() => {
        if(hasJobs){
            console.log(`Item ${itemId}: ${completionRate}% complete (${totalJobs} jobs) | Completed: ${isCompleted} | Hidden: ${shouldHideBorder} | Active: ${hasActiveJobs}`);
        }
    }, [itemId, completionRate, totalJobs, hasJobs, isCompleted, shouldHideBorder, hasActiveJobs]);

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