import useTeamJobs from '@/hooks/useTeamJobs';
import JobSkeleton from '@/components/atoms/JobSkeleton';
import JobQueue from '@/components/atoms/JobQueue';
import './JobsHistory.css';

const JobsHistory = () => {
    const { jobs, isConnected, isLoading } = useTeamJobs();

    return (
        <div className='jobs-history-container'>
            {(!isConnected || isLoading) ? (
                <JobSkeleton n={10} />
            ) : (
                jobs.map((job, index) => <JobQueue job={job} key={index} />)
            )}
        </div> 
    );
};

export default JobsHistory;