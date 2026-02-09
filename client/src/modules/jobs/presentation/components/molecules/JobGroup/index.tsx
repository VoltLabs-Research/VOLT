import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrajectoryJobGroup as TrajectoryJobGroupType, FrameJobGroup } from '@/modules/jobs/domain/entities/Job';
import Container from '@/shared/presentation/components/Container';
import FrameGroup from './FrameGroup';
import JobGroupHeader from './JobGroupHeader';
import JobGroupMenu from './JobGroupMenu';
import useJobGroupActions from '@/modules/jobs/presentation/hooks/use-job-group-actions';
import { statusConfig } from './status-config';
import '@/modules/jobs/presentation/components/molecules/JobGroup/JobGroup.css';

interface JobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
    onRemoveTrajectoryGroup: (trajectoryId: string) => void;
}
const JobGroup: React.FC<JobGroupProps> = ({ group, defaultExpanded = false, onRemoveTrajectoryGroup }) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const statusClassName = statusConfig[group.overallStatus];
    const {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    } = useJobGroupActions({ group, onRemoveTrajectoryGroup });

    const headerContent = (
        <JobGroupHeader
            group={group}
            statusClassName={statusClassName}
            isExpanded={isExpanded}
            onToggle={() => setIsExpanded(!isExpanded)}
        />
    );

    return (
        <Container className='job-group'>
            <JobGroupMenu
                trajectoryId={group.trajectoryId}
                trigger={headerContent}
                loadingAction={loadingAction}
                onClearHistory={handleClearHistory}
                onRemoveRunningJobs={handleRemoveRunningJobs}
                onRetryFailedJobs={handleRetryFailedJobs}
            />

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className='job-group-children'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                        {group.frameGroups.map((frame: FrameJobGroup) => (
                            <FrameGroup key={frame.timestep} frame={frame} />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};

export default JobGroup;
