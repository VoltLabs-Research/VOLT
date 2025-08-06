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

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import useLogger from '@/hooks/useLogger';

// TODO: DUPLICATED CODE
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
    animatedCompletionRate: number;
    hasJobs: boolean;
    hasActiveJobs: boolean;
    isCompleted: boolean;
    shouldHideBorder: boolean;
    isAnimating: boolean;
    getBorderColor: () => string;
    getProgressBorder: () => string;
    getAnimatedProgressBorder: () => string;
    cleanup: () => void;
}

const ANIMATION_CONFIG = {
    duration: 800,
    easing: (t: number) => t * (2 - t),
    frameRate: 60,
} as const;

const useJobProgress = (jobs: Jobs, itemId: string): JobProgressResult => {
    const logger = useLogger('use-job-progress');
    const [isCompleted, setIsCompleted] = useState<boolean>(false);
    const [shouldHideBorder, setShouldHideBorder] = useState<boolean>(false);
    const [isInitialized, setIsInitialized] = useState<boolean>(false);
    const [animatedCompletionRate, setAnimatedCompletionRate] = useState<number>(0);
    const [isAnimating, setIsAnimating] = useState<boolean>(false);

    const completionTimeoutRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const animationStartRef = useRef<number | null>(null);
    const animationStartValue = useRef<number>(0);
    const animationTargetValue = useRef<number>(0);
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

    const animateProgress = useCallback((from: number, to: number) => {
        logger.log(`Animating progress from ${from}% to ${to}%`);
        
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        if (from === to) {
            setAnimatedCompletionRate(to);
            setIsAnimating(false);
            return;
        }

        setIsAnimating(true);
        animationStartRef.current = performance.now();
        animationStartValue.current = from;
        animationTargetValue.current = to;

        const animate = (currentTime: number) => {
            if (!animationStartRef.current) return;

            const elapsed = currentTime - animationStartRef.current;
            const progress = Math.min(elapsed / ANIMATION_CONFIG.duration, 1);
            
            const easedProgress = ANIMATION_CONFIG.easing(progress);
            
            const currentValue = animationStartValue.current + 
                (animationTargetValue.current - animationStartValue.current) * easedProgress;
            
            setAnimatedCompletionRate(Math.round(currentValue));

            if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setAnimatedCompletionRate(animationTargetValue.current);
                setIsAnimating(false);
                animationFrameRef.current = null;
                logger.log(`Animation completed at ${animationTargetValue.current}%`);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);
    }, []);

    const cleanupAnimation = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsAnimating(false);
    }, []);

    const getBorderColor = useCallback((): string => {
        if(!hasJobs || shouldHideBorder){
            return 'transparent';
        }

        if(animatedCompletionRate === 100) return '#22c55e';
        if(animatedCompletionRate >= 75) return '#3b82f6';
        if(animatedCompletionRate >= 50) return '#f59e0b';
        if(animatedCompletionRate >= 25) return '#f97316';

        return '#dc2626';
    }, [hasJobs, shouldHideBorder, animatedCompletionRate]);

    const getWaitingBorder = useCallback((): string => {
        return 'conic-gradient(from -90deg, #6b7280 0deg, #6b7280 90deg, transparent 90deg, transparent 360deg)';
    }, []);

    const getProgressBorder = useCallback((): string => {
        if(!hasJobs || shouldHideBorder) return 'none';
        
        if(completionRate === 0 && hasActiveJobs){
            return getWaitingBorder();
        }
        
        if(completionRate === 0) return 'none';

        const borderColor = hasJobs && !shouldHideBorder ? (
            completionRate === 100 ? '#22c55e' :
            completionRate >= 75 ? '#3b82f6' :
            completionRate >= 50 ? '#f59e0b' :
            completionRate >= 25 ? '#f97316' : '#dc2626'
        ) : 'transparent';
        
        const degrees = (completionRate / 100) * 360;
        return `conic-gradient(from -90deg, ${borderColor} 0deg, ${borderColor} ${degrees}deg, transparent ${degrees}deg, transparent 360deg)`;
    }, [hasJobs, shouldHideBorder, completionRate, hasActiveJobs, getWaitingBorder]);

    const getAnimatedProgressBorder = useCallback((): string => {
        if(!hasJobs || shouldHideBorder) return 'none';
        
        if(animatedCompletionRate === 0 && hasActiveJobs){
            return getWaitingBorder();
        }
        
        if(animatedCompletionRate === 0) return 'none';

        const borderColor = getBorderColor();
        const degrees = (animatedCompletionRate / 100) * 360;
        
        const result = `conic-gradient(from -90deg, ${borderColor} 0deg, ${borderColor} ${degrees}deg, transparent ${degrees}deg, transparent 360deg)`;
        logger.log(`Border: ${animatedCompletionRate}% -> ${borderColor} (${degrees}deg)`);
        
        return result;
    }, [hasJobs, shouldHideBorder, animatedCompletionRate, hasActiveJobs, getBorderColor, getWaitingBorder]);

    const cleanup = useCallback((): void => {
        if(completionTimeoutRef.current){
            clearTimeout(completionTimeoutRef.current);
            completionTimeoutRef.current = null;
        }
        cleanupAnimation();
    }, [cleanupAnimation]);

    useEffect(() => {
        if(!isInitialized && hasJobs){
            logger.log(`Initializing job progress for item ${itemId} with ${completionRate}%`);
            previousCompletionRate.current = completionRate;
            previousTotalJobs.current = totalJobs;
            hasBeenCompleted.current = completionRate === 100;
            setAnimatedCompletionRate(completionRate);
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

        if(hasNewJobs){
            logger.log(`New jobs detected for ${itemId}: ${previousTotalJobs.current} -> ${totalJobs}`);
            
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            
            animateProgress(animatedCompletionRate, 0);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if(isNowCompleted && !wasCompleted && !hasBeenCompleted.current){
            logger.log(`${itemId} completed! Animating to 100%`);
            setIsCompleted(true);
            hasBeenCompleted.current = true;
            
            animateProgress(animatedCompletionRate, completionRate);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
            }

            completionTimeoutRef.current = window.setTimeout(() => {
                logger.log(`Hiding progress border for ${itemId}`);
                setShouldHideBorder(true);
                setIsCompleted(false);
            }, 5000);
        }else if(!isNowCompleted && wasCompleted){
            logger.log(`${itemId} new jobs while completed`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            
            animateProgress(animatedCompletionRate, completionRate);
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }else if(completionChanged && !isNowCompleted){
            logger.log(`Progress update for ${itemId}: ${previousCompletionRate.current}% -> ${completionRate}%`);
            
            animateProgress(animatedCompletionRate, completionRate);
        }

        previousCompletionRate.current = completionRate;
        previousTotalJobs.current = totalJobs;
    }, [itemId, completionRate, totalJobs, hasJobs, isInitialized, animatedCompletionRate, animateProgress]);

    useEffect(() => {
        if(!hasJobs && isInitialized){
            logger.log(`No jobs for ${itemId}, resetting states`);
            setShouldHideBorder(false);
            setIsCompleted(false);
            hasBeenCompleted.current = false;
            setIsInitialized(false);
            setAnimatedCompletionRate(0);
            cleanupAnimation();
            
            if(completionTimeoutRef.current){
                clearTimeout(completionTimeoutRef.current);
                completionTimeoutRef.current = null;
            }
        }
    }, [hasJobs, itemId, isInitialized, cleanupAnimation]);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        totalJobs,
        completionRate,
        animatedCompletionRate,
        hasJobs,
        hasActiveJobs,
        isCompleted,
        shouldHideBorder,
        isAnimating,
        getBorderColor,
        getProgressBorder,
        getAnimatedProgressBorder,
        cleanup
    };
};

export default useJobProgress;