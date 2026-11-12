import JobSkeleton from '@/modules/jobs/components/JobSkeleton';
import JobGroup from '@/modules/jobs/components/JobGroup';
import type { ReactNode } from 'react';
import type { TrajectoryJobGroup as TJG } from '@volt/contracts/modules/jobs/domain';

interface JobsHistoryProps {
    groups: TJG[];
    isLoading: boolean;
};

const JobsHistory = ({
    groups,
    isLoading
}: JobsHistoryProps) => {
    let content: ReactNode = groups.map((group: TJG) => (
        <JobGroup
            key={group.trajectoryId}
            group={group}
        />
    ));

    if (isLoading) {
        content = <JobSkeleton />;
    } else if (groups.length === 0) {
        content = (
            <div className='flex flex-1 flex-col items-center justify-center gap-1 px-2.5 py-8 text-center'>
                <p className='text-base font-medium'>No events to display</p>
                <p className='text-sm text-muted'>No jobs match the current filters yet.</p>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-0.5 h-full' role='list'>
            {content}
        </div>
    );
};

export default JobsHistory;
