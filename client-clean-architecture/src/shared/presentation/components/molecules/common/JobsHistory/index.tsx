import { memo, useMemo } from 'react';
import { useJobStore } from '@/modules/jobs/presentation/stores';
import JobSkeleton from '@/modules/jobs/presentation/components/atoms/JobSkeleton';
import TrajectoryJobGroup from '@/modules/jobs/presentation/components/molecules/TrajectoryJobGroup';
import Container from '@/shared/presentation/components/primitives/Container';
import type { TrajectoryJobGroup as TJG, Job } from '@/modules/jobs/domain/entities';
import '@/shared/presentation/components/molecules/common/JobsHistory/JobsHistory.css';

interface JobsHistoryProps {
    trajectoryId?: string;
    queueFilter?: string;
}

const JobsHistory = memo(({ trajectoryId, queueFilter }: JobsHistoryProps) => {
    const groups = useJobStore((state: any) => state.groups);
    const isConnected = useJobStore((state: any) => state.isConnected);
    const isLoading = useJobStore((state: any) => state.isLoading);

    const filteredGroups = useMemo(() => {
        let result = groups;
        if (trajectoryId) {
            result = result.filter((g: TJG) => g.trajectoryId === trajectoryId);
        }
        if (queueFilter) {
            result = result.map((g: TJG) => ({
                ...g,
                frameGroups: g.frameGroups.map((f: any) => ({
                    ...f,
                    jobs: f.jobs.filter((j: Job) => j.queueType?.includes(queueFilter))
                })).filter((f: any) => f.jobs.length > 0)
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
