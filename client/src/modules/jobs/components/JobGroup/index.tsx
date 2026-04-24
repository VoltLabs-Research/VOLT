import { frameGroupStatusClassNames } from '@/modules/jobs/utilities/frame-group-status';
import useJobGroupActions from '@/modules/jobs/hooks/use-job-group-actions';
import FrameGroup from '@/modules/jobs/components/FrameGroup';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import Box from '@/shared/presentation/primitives/Box';
import JobGroupHeader from './JobGroupHeader';
import JobGroupMenu from './JobGroupMenu';
import '@/modules/jobs/components/JobGroup/JobGroup.css';
import { AnimatePresence, motion } from 'framer-motion';
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
    const prefersReducedMotion = usePrefersReducedMotion();
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

            {prefersReducedMotion ? (
                isExpanded ? <div id={contentId} className='job-group-children'>{content}</div> : null
            ) : (
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            id={contentId}
                            className='job-group-children'
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                        >
                            {content}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </Box>
    );
};

export default JobGroup;
