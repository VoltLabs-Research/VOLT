import useJobGroupActions from '@/modules/jobs/hooks/use-job-group-actions';
import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import FrameGroup from '@/modules/jobs/components/FrameGroup';
import JobGroupHeader from './JobGroupHeader';
import JobGroupMenu from './JobGroupMenu';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, TrajectoryJobGroup as TrajectoryJobGroupType } from '@volt/contracts/modules/jobs/domain';

interface JobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
};

const JobGroup = ({ group, defaultExpanded = false }: JobGroupProps) => {
    const containsTransferJobs = useMemo(() => {
        return group.frameGroups.some((frame) => frame.jobs.some((job) => job.queueType === 'cluster_transfer'));
    }, [group.frameGroups]);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || containsTransferJobs);
    const contentId = useId();
    const {
        loadingAction,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    } = useJobGroupActions(group.trajectoryId);

    const handleToggle = () => {
        setIsExpanded((value) => !value);
    };

    useEffect(() => {
        if (containsTransferJobs) {
            setIsExpanded(true);
        }
    }, [containsTransferJobs]);

    const content = group.frameGroups.map((frame: FrameJobGroup) => (
        <FrameGroup key={frame.timestep} frame={frame} />
    ));

    return (
        <div className='mb-2' role='listitem'>
            <JobGroupMenu
                trajectoryId={group.trajectoryId}
                loadingAction={loadingAction}
                onRemoveRunningJobs={handleRemoveRunningJobs}
                onRetryFailedJobs={handleRetryFailedJobs}
                trigger={(
                    <JobGroupHeader
                        group={group}
                        isExpanded={isExpanded}
                        contentId={contentId}
                        onToggle={handleToggle}
                    />
                )}
            />
            <CollapsibleJobContent id={contentId} isExpanded={isExpanded} className='pt-1 pl-4' duration={0.25} ease='easeInOut'>
                {content}
            </CollapsibleJobContent>
        </div>
    );
};

export default JobGroup;
