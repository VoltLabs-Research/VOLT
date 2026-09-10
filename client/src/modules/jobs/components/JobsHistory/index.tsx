import JobSkeleton from '@/modules/jobs/components/JobSkeleton';
import JobGroup from '@/modules/jobs/components/JobGroup';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { Inbox } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TrajectoryJobGroup as TJG } from '@volt/contracts/modules/jobs/domain';

interface JobsHistoryProps {
    trajectoryId?: string;
    groups: TJG[];
    isLoading: boolean;
};

const JobsHistory = ({
    trajectoryId,
    groups,
    isLoading
}: JobsHistoryProps) => {
    const filteredGroups = useMemo(() => {
        let result = groups;
        if (trajectoryId) {
            result = result.filter((g: TJG) => g.trajectoryId === trajectoryId);
        }
        return result;
    }, [groups, trajectoryId]);

    const shouldShowSkeleton = isLoading;
    let content: ReactNode = filteredGroups.map((group: TJG) => (
        <JobGroup
            key={group.trajectoryId}
            group={group}
        />
    ));

    if (shouldShowSkeleton) {
        content = <JobSkeleton />;
    } else if (filteredGroups.length === 0) {
        content = (
            <RecoveryState
                title='No events to display'
                description='No jobs match the current filters yet.'
                icon={<Inbox size={24} strokeWidth={1} className='text-muted' />}
            />
        );
    }

    return (
        <div className='flex flex-col gap-2 h-full' role='list'>
            {content}
        </div>
    );
};

export default JobsHistory;
