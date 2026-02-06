import { useCallback, useEffect, useRef } from 'react';

interface UseJobsCompletionToastArgs {
    trajectoryId?: string;
    hasActiveJobs: boolean;
    allJobsCompleted: boolean;
    showSuccess: (message: string) => void;
}

const useJobsCompletionToast = ({
    trajectoryId,
    hasActiveJobs,
    allJobsCompleted,
    showSuccess
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
            showSuccess('Analysis completed successfully!');
            hasShownCompletionToastRef.current = true;
            hadActiveJobsRef.current = false;
        }, 500);

        return clearCompletionTimer;
    }, [trajectoryId, hasActiveJobs, allJobsCompleted, showSuccess, clearCompletionTimer]);
};

export default useJobsCompletionToast;
