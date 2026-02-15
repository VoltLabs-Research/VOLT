import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import JobSkeleton from '@/modules/jobs/presentation/components/atoms/JobSkeleton';
import JobGroup from '@/modules/jobs/presentation/components/molecules/JobGroup';
import FrameGroup from '@/modules/jobs/presentation/components/molecules/JobGroup/FrameGroup';
import Container from '@/shared/presentation/components/Container';
import type { TrajectoryJobGroup as TJG, Job } from '@/modules/jobs/domain/entities/Job';

interface JobsHistoryProps {
    trajectoryId?: string;
    queueFilter?: string;
    groups: TJG[];
    isConnected: boolean;
    isLoading: boolean;
    onRemoveTrajectoryGroup: (trajectoryId: string) => void;
    displayMode?: 'full' | 'children-only';
}

const JobsHistory = ({
    trajectoryId,
    queueFilter,
    groups,
    isConnected,
    isLoading,
    onRemoveTrajectoryGroup,
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
                <Container className="d-flex column items-center content-center gap-05 flex-1 h-max">
                    <Inbox size={24} strokeWidth={1} className="color-muted" />
                    <span className="font-size-05 color-muted">No events to display</span>
                </Container>
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
                            onRemoveTrajectoryGroup={onRemoveTrajectoryGroup}
                        />
                    )
                )
            )}
        </Container>
    );
};

export default JobsHistory;
