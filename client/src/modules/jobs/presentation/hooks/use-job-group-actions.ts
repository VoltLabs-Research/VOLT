import { useCallback, useState } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';
import useJobsUseCases from '@/modules/jobs/presentation/hooks/use-jobs-use-cases';
import useToast from '@/shared/presentation/hooks/use-toast';

interface UseJobGroupActionsArgs {
    group: TrajectoryJobGroup;
    onRemoveTrajectoryGroup: (trajectoryId: string) => void;
}

const useJobGroupActions = ({ group, onRemoveTrajectoryGroup }: UseJobGroupActionsArgs) => {
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const { jobsRepository } = useJobsUseCases();
    const { showSuccess, showInfo, showError } = useToast();

    const handleClearHistory = useCallback(async () => {
        showSuccess('Clearing history...');
        setLoadingAction('clear');
        onRemoveTrajectoryGroup(group.trajectoryId);

        try {
            const response = await jobsRepository.clearHistory(group.trajectoryId);
            showSuccess(`History cleared: ${response.deletedJobs} jobs and ${response.deletedAnalyses} analyses removed`);
        } catch (error: any) {
            console.error('Failed to clear history', error);
            showError(error?.response?.data?.message || 'Failed to clear history');
        } finally {
            setLoadingAction(null);
        }
    }, [group.trajectoryId, jobsRepository, onRemoveTrajectoryGroup, showError, showSuccess]);

    const handleRemoveRunningJobs = useCallback(async () => {
        showSuccess('Removing running jobs...');
        setLoadingAction('remove');
        try {
            const response = await jobsRepository.removeRunningJobs(group.trajectoryId);
            if (response.deletedJobs === 0) {
                showInfo('No running jobs found');
            } else {
                showSuccess(`Removed ${response.deletedJobs} running jobs and ${response.deletedAnalyses} analyses`);
            }
        } catch (error: any) {
            console.error('Failed to remove running jobs', error);
            showError(error?.response?.data?.message || 'Failed to remove running jobs');
        } finally {
            setLoadingAction(null);
        }
    }, [group.trajectoryId, jobsRepository, showError, showInfo, showSuccess]);

    const handleRetryFailedJobs = useCallback(async () => {
        showSuccess('Retrying failed jobs...');
        setLoadingAction('retry');
        try {
            const response = await jobsRepository.retryFailedJobs(group.trajectoryId);
            if (response.retriedFrames === 0) {
                showInfo('No failed frames found to retry');
            } else {
                showSuccess(`Queued ${response.retriedFrames} failed frames for retry`);
            }
        } catch (error: any) {
            console.error('Failed to retry failed jobs', error);
            showError(error?.response?.data?.message || 'Failed to retry failed jobs');
        } finally {
            setLoadingAction(null);
        }
    }, [group.trajectoryId, jobsRepository, showError, showInfo, showSuccess]);

    return {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    };
};

export default useJobGroupActions;
