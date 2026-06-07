import { frameGroupStatusClassNames } from '@/modules/jobs/utilities/frame-group-status';
import useJobGroupActions from '@/modules/jobs/hooks/use-job-group-actions';
import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import FrameGroup from '@/modules/jobs/components/FrameGroup';
import { Box } from '@voltstack/bravais';
import JobGroupHeader from './JobGroupHeader';
import JobGroupMenu from './JobGroupMenu';
import '@/modules/jobs/components/JobGroup/JobGroup.css';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, TrajectoryJobGroup as TrajectoryJobGroupType } from '@/modules/jobs/api/entities/job';

interface JobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
    statusPresentation?: 'badge' | 'trajectory-name';
};

const JobGroup = ({ group, defaultExpanded = false, statusPresentation = 'badge' }: JobGroupProps) => {
    const containsTransferJobs = useMemo(() => {
        return group.frameGroups.some((frame) => frame.jobs.some((job) => job.queueType === 'cluster_transfer'));
    }, [group.frameGroups]);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded || containsTransferJobs);
    const contentId = useId();
    const statusClassName = frameGroupStatusClassNames[group.overallStatus];
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
        <Box className='job-group' role='listitem'>
            <JobGroupMenu
                trajectoryId={group.trajectoryId}
                loadingAction={loadingAction}
                onRemoveRunningJobs={handleRemoveRunningJobs}
                onRetryFailedJobs={handleRetryFailedJobs}
                trigger={(
                    <JobGroupHeader
                        group={group}
                        statusClassName={statusClassName}
                        isExpanded={isExpanded}
                        contentId={contentId}
                        statusPresentation={statusPresentation}
                        onToggle={handleToggle}
                    />
                )}
            />

            <CollapsibleJobContent id={contentId} isExpanded={isExpanded} className='job-group-children' duration={0.25} ease='easeInOut'>
                {content}
            </CollapsibleJobContent>
        </Box>
    );
};

export default JobGroup;
