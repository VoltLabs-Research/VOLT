import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';

interface UseJobsCompletionToastArgs {
    trajectoryId?: string;
    hasActiveJobs: boolean;
    allJobsCompleted: boolean;
}

const useJobsCompletionToast = ({
    trajectoryId,
    hasActiveJobs,
    allJobsCompleted
}: UseJobsCompletionToastArgs) => {
    const hadActiveJobsRef = useRef(false);
    const hasShownCompletionToastRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCompletionTimer = useCallback(() => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    useEffect(() => {
        if (!hasActiveJobs) return;
        hadActiveJobsRef.current = true;
        hasShownCompletionToastRef.current = false;
    }, [hasActiveJobs]);

    useEffect(() => {
        if (!trajectoryId) return;
        if (!hadActiveJobsRef.current) return;
        if (hasShownCompletionToastRef.current) return;
        if (hasActiveJobs) return;

        if (!allJobsCompleted) {
            clearCompletionTimer();
            return;
        }

        timerRef.current = setTimeout(() => {
            sileo.success({ title: 'Analysis completed successfully!' });
            hasShownCompletionToastRef.current = true;
            hadActiveJobsRef.current = false;
        }, 500);

        return clearCompletionTimer;
    }, [trajectoryId, hasActiveJobs, allJobsCompleted, clearCompletionTimer]);
};

export default useJobsCompletionToast;
