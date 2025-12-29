import { memo, useMemo } from 'react';
import { useTeamJobsStore } from '@/stores/slices/team';
import JobSkeleton from '@/components/atoms/common/JobSkeleton';
import TrajectoryJobGroup from '@/components/molecules/common/TrajectoryJobGroup';
import Container from '@/components/primitives/Container';
import type { TrajectoryJobGroup as TJG, Job } from '@/types/jobs';
import './JobsHistory.css';

interface JobsHistoryProps {
    trajectoryId?: string;
    queueFilter?: string;
}

const JobsHistory = memo(({ trajectoryId, queueFilter }: JobsHistoryProps) => {
    const groups = useTeamJobsStore((state) => state.groups);
    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);

    const filteredGroups = useMemo(() => {
        let result = groups;
        if (trajectoryId) {
            result = result.filter((g: TJG) => g.trajectoryId === trajectoryId);
        }
        if (queueFilter) {
            result = result.map((g: TJG) => ({
                ...g,
                frameGroups: g.frameGroups.map(f => ({
                    ...f,
                    jobs: f.jobs.filter((j: Job) => j.queueType?.includes(queueFilter))
                })).filter(f => f.jobs.length > 0)
            })).filter((g: TJG) => g.frameGroups.length > 0);
        }
        return result;
    }, [groups, trajectoryId, queueFilter]);

    const shouldShowSkeleton = !isConnected || isLoading;

    return (
        <Container className='d-flex column gap-05'>
            {shouldShowSkeleton ? (
                <JobSkeleton />
            ) : (
                filteredGroups.map((group: TJG, index: number) => (
                    <TrajectoryJobGroup
                        key={group.trajectoryId}
                        group={group}
                        defaultExpanded={index === 0}
                    />
                ))
            )}
        </Container>
    );
});

JobsHistory.displayName = 'JobsHistory';

export default JobsHistory;


