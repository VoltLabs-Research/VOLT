import { frameGroupStatusClassNames } from '@/modules/jobs/utilities/frame-group-status';
import useJobGroupActions from '@/modules/jobs/hooks/use-job-group-actions';
import FrameGroup from '@/modules/jobs/components/molecules/FrameGroup';
import Container from '@/shared/presentation/components/Container';
import JobGroupHeader from './JobGroupHeader';
import JobGroupMenu from './JobGroupMenu';
import '@/modules/jobs/components/molecules/JobGroup/JobGroup.css';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { FrameJobGroup, TrajectoryJobGroup as TrajectoryJobGroupType } from '@/modules/jobs/api/entities/job';

interface JobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
};

const JobGroup = ({ group, defaultExpanded = false }: JobGroupProps) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const statusClassName = frameGroupStatusClassNames[group.overallStatus];
    const {
        loadingAction,
        handleClearHistory,
        handleRemoveRunningJobs,
        handleRetryFailedJobs
    } = useJobGroupActions();

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
