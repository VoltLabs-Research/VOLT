import JobsHistory from '@/modules/jobs/components/JobsHistory';
import useTeamJobs from '@/modules/jobs/hooks/use-team-jobs';

const JobsHistoryViewer = () => {
    const { groups, isLoading } = useTeamJobs({ subscribe: false });

    return (
        <div className='flex flex-col w-full h-full'>
            <JobsHistory
                groups={groups}
                isLoading={isLoading}
            />
        </div>
    );
};

export default JobsHistoryViewer;
