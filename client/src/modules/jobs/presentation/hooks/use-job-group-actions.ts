import { useCallback, useState } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';
import useJobsUseCases from '@/modules/jobs/presentation/hooks/use-jobs-use-cases';
import useToast from '@/shared/presentation/hooks/use-toast';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';

interface UseJobGroupActionsArgs {
    group: TrajectoryJobGroup;
    onRemoveTrajectoryGroup: (trajectoryId: string) => void;
}

const useJobGroupActions = ({ group, onRemoveTrajectoryGroup }: UseJobGroupActionsArgs) => {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const { jobsRepository } = useJobsUseCases();
    const { showSuccess, showInfo, showError } = useToast();

    const clearHistoryAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to clear history', error);
            showError((error as any)?.response?.data?.message || 'Failed to clear history');
        },
        onFinally: () => setLoadingAction(null)
    });

    const removeRunningJobsAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to remove running jobs', error);
            showError((error as any)?.response?.data?.message || 'Failed to remove running jobs');
        },
        onFinally: () => setLoadingAction(null)
    });

    const retryFailedJobsAction = useAsyncAction({
        onError: (error: unknown) => {
            console.error('Failed to retry failed jobs', error);
            showError((error as any)?.response?.data?.message || 'Failed to retry failed jobs');
        },
        onFinally: () => setLoadingAction(null)
    });

    const handleClearHistory = useCallback(async () => {
        showSuccess('Clearing history...');
        setLoadingAction('clear');
        onRemoveTrajectoryGroup(group.trajectoryId);
        await clearHistoryAction.execute(async () => {
            const response = await jobsRepository.clearHistory(group.trajectoryId);
            showSuccess(`History cleared: ${response.deletedJobs} jobs and ${response.deletedAnalyses} analyses removed`);
        });
    }, [group.trajectoryId, jobsRepository, onRemoveTrajectoryGroup, showSuccess, clearHistoryAction]);

    const handleRemoveRunningJobs = useCallback(async () => {
        showSuccess('Removing running jobs...');
        setLoadingAction('remove');
        await removeRunningJobsAction.execute(async () => {
            const response = await jobsRepository.removeRunningJobs(group.trajectoryId);
            if (response.deletedJobs === 0) {
                showInfo('No running jobs found');
            } else {
                showSuccess(`Removed ${response.deletedJobs} running jobs and ${response.deletedAnalyses} analyses`);
            }
        });
    }, [group.trajectoryId, jobsRepository, showInfo, showSuccess, removeRunningJobsAction]);

    const handleRetryFailedJobs = useCallback(async () => {
        showSuccess('Retrying failed jobs...');
        setLoadingAction('retry');
        await retryFailedJobsAction.execute(async () => {
            const response = await jobsRepository.retryFailedJobs(group.trajectoryId);
            if (response.retriedFrames === 0) {
                showInfo('No failed frames found to retry');
            } else {
                showSuccess(`Queued ${response.retriedFrames} failed frames for retry`);
            }
        });
    }, [group.trajectoryId, jobsRepository, showInfo, showSuccess, retryFailedJobsAction]);

    return {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    };
};

export default useJobGroupActions;
