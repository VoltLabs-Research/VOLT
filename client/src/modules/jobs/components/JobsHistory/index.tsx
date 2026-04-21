import JobSkeleton from '@/modules/jobs/components/JobSkeleton';
import JobGroup from '@/modules/jobs/components/JobGroup';
import FrameGroup from '@/modules/jobs/components/FrameGroup';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { Inbox } from 'lucide-react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TrajectoryJobGroup as TJG, Job } from '@/modules/jobs/api/entities/job';

interface JobsHistoryProps {
    trajectoryId?: string;
    queueFilter?: string;
    groups: TJG[];
    isConnected: boolean;
    isLoading: boolean;
    displayMode?: 'full' | 'children-only';
    groupStatusPresentation?: 'badge' | 'trajectory-name';
};

const JobsHistory = ({
    trajectoryId,
    queueFilter,
    groups,
    isLoading,
    displayMode = 'full',
    groupStatusPresentation = 'badge'
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

    const shouldShowSkeleton = isLoading;
    let content: ReactNode = filteredGroups.map((group: TJG) => {
        if (displayMode === 'children-only') {
            return group.frameGroups.map((frame) => (
                <div key={`${group.trajectoryId}-${frame.timestep}`} className='job-group-children'>
                    <FrameGroup frame={frame} />
                </div>
            ));
        }

        return (
            <JobGroup
                key={group.trajectoryId}
                group={group}
                statusPresentation={groupStatusPresentation}
            />
        );
    });

    if (shouldShowSkeleton) {
        content = <JobSkeleton />;
    } else if (filteredGroups.length === 0) {
        content = (
            <EmptyState
                title='No events to display'
                description='No jobs match the current filters yet.'
                icon={<Inbox size={24} strokeWidth={1} className='color-muted' />}
            />
        );
    }

    return (
        <div className='volt-container d-flex column gap-05 h-max' role='list'>
            {content}
        </div>
    );
};

export default JobsHistory;
