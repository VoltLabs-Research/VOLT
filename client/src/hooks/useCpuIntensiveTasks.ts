import { useCallback } from 'react';

interface UseCpuIntensiveTasksReturn {
    canPerformCpuIntensiveTask: () => boolean;
    shouldShowNotification: () => boolean;
}

export const useCpuIntensiveTasks = (): UseCpuIntensiveTasksReturn => {
    const canPerformCpuIntensiveTask = useCallback((): boolean => {
        return import.meta.env.VITE_CPU_INTENSIVE_TASKS === 'true';
    }, []);

    const shouldShowNotification = useCallback((): boolean => {
        return !canPerformCpuIntensiveTask();
    }, [canPerformCpuIntensiveTask]);

    return {
        canPerformCpuIntensiveTask,
        shouldShowNotification
    };
};
