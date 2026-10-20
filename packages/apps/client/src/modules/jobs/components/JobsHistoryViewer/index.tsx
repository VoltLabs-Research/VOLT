import JobsHistory from '@/modules/jobs/components/JobsHistory';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';
import useJobsHistoryFilters from './use-jobs-history-filters';
import useJobsCompletionToast from './use-jobs-completion-toast';

interface JobsHistoryViewerProps {
    trajectoryId?: string;
};

const JobsHistoryViewer = ({ trajectoryId }: JobsHistoryViewerProps) => {
    const { groups, isConnected, isLoading } = useTeamJobs({ subscribe: false });
    const {
        relevantJobs,
        hasActiveJobs,
        allJobsCompleted
    } = useJobsHistoryFilters({
        groups,
        trajectoryId,
        isConnected,
        isLoading
    });

    useJobsCompletionToast({
        trajectoryId,
        jobs: relevantJobs,
        hasActiveJobs,
        allJobsCompleted
    });

    return (
        <div className='flex flex-col w-full h-full'>
            <JobsHistory
                trajectoryId={trajectoryId}
                groups={groups}
                isLoading={isLoading}
            />
        </div>
    );
};

export default JobsHistoryViewer;
