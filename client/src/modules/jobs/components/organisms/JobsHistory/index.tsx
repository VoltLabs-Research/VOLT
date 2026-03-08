import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import JobSkeleton from '@/modules/jobs/components/atoms/JobSkeleton';
import JobGroup from '@/modules/jobs/components/molecules/JobGroup';
import FrameGroup from '@/modules/jobs/components/molecules/JobGroup/FrameGroup';
import Container from '@/shared/presentation/components/Container';
import type { TrajectoryJobGroup as TJG, Job } from '@/modules/jobs/api/entities/job';
import EmptyState from '@/shared/presentation/components/EmptyState';

interface JobsHistoryProps {
    trajectoryId?: string;
    queueFilter?: string;
    groups: TJG[];
    isConnected: boolean;
    isLoading: boolean;
    displayMode?: 'full' | 'children-only';
}

const JobsHistory = ({
    trajectoryId,
    queueFilter,
    groups,
    isConnected,
    isLoading,
    displayMode = 'full'
}: JobsHistoryProps) => {

    const filteredGroups = useMemo(() => {
        let result = groups;
        if (trajectoryId) {
            result = result.filter((g: TJG) => g.trajectoryId === trajectoryId);
        }
        if (queueFilter) {
            result = result.map((g: TJG) => ({
                ...g,
                frameGroups: g.frameGroups.map((f) => ({
                    ...f,
                    jobs: f.jobs.filter((j: Job) => j.queueType?.includes(queueFilter))
                })).filter((f) => f.jobs.length > 0)
            })).filter((g: TJG) => g.frameGroups.length > 0);
        }
        return result;
    }, [groups, trajectoryId, queueFilter]);

    const shouldShowSkeleton = !isConnected || isLoading;

    return (
        <Container className='d-flex column gap-05 h-max'>
            {shouldShowSkeleton ? (
                <JobSkeleton />
            ) : filteredGroups.length === 0 ? (
                <EmptyState
                    title='No events to display'
                    description='No jobs match the current filters yet.'
                    icon={<Inbox size={24} strokeWidth={1} className="color-muted" />}
                />
            ) : (
                filteredGroups.map((group: TJG, index: number) =>
                    displayMode === 'children-only' ? (
                        group.frameGroups.map((frame) => (
                            <div key={`${group.trajectoryId}-${frame.timestep}`} className='job-group-children'>
                                <FrameGroup frame={frame} />
                            </div>
                        ))
                    ) : (
                        <JobGroup
                            key={group.trajectoryId}
                            group={group}
                            defaultExpanded={index === 0}
                        />
                    )
                )
            )}
        </Container>
    );
};

export default JobsHistory;
