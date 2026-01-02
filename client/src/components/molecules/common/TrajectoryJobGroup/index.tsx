import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronRight } from 'react-icons/fa';
import type { TrajectoryJobGroup as TrajectoryJobGroupType, FrameJobGroup, Job } from '@/types/jobs';
import { formatDistanceToNow } from 'date-fns';
import JobQueue from '@/components/atoms/common/JobQueue';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './TrajectoryJobGroup.css';

interface TrajectoryJobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
}

const statusConfig = {
    running: 'status-running',
    completed: 'status-completed',
    failed: 'status-failed',
    partial: 'status-partial'
};

const FrameGroup: React.FC<{ frame: FrameJobGroup }> = memo(({ frame }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const statusClassName = statusConfig[frame.overallStatus];
    const label = `Frame ${frame.timestep}`;

    return (
        <Container className="frame-job-group">
            <Container
                className={`frame-job-group-header ${statusClassName}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Container className="d-flex items-center content-between w-max">
                    <Paragraph className="font-size-1 color-secondary">{label}</Paragraph>
                    <Container className="d-flex items-center gap-05">
                        <span className={`frame-status-badge ${statusClassName}`}>{frame.jobs.length}</span>
                        <motion.i
                            className="chevron-icon"
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <FaChevronRight />
                        </motion.i>
                    </Container>
                </Container>
            </Container>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {frame.jobs.map((job: Job, index: number) => (
                            <JobQueue key={job.jobId || `job-${index}`} job={job} isChild />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
});

FrameGroup.displayName = 'FrameGroup';

const TrajectoryJobGroup: React.FC<TrajectoryJobGroupProps> = memo(({ group, defaultExpanded = false }) => {
    const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

    React.useEffect(() => {
        setIsExpanded(defaultExpanded);
    }, [defaultExpanded]);

    const statusClassName = statusConfig[group.overallStatus];

    return (
        <Container className="trajectory-job-group">
            <Container
                className={`trajectory-job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Container className="d-flex w-max items-center content-between gap-05 p-1">
                    <Container className="d-flex column gap-01">
                        <Title className="font-size-1 font-weight-6 color-primary trajectory-name">
                            {group.trajectoryName}
                        </Title>
                        <Paragraph className="font-size-1 color-secondary">
                            {group.completedCount}/{group.totalCount} jobs • {formatDistanceToNow(group.latestTimestamp, { addSufix: true })}
                        </Paragraph>
                    </Container>
                    <Container className="d-flex items-center gap-1">
                        <span className={`overall-status-badge ${statusClassName}`}>
                            {group.overallStatus}
                        </span>
                        <motion.i
                            className="chevron-icon"
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <FaChevronRight />
                        </motion.i>
                    </Container>
                </Container>
            </Container>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="trajectory-job-group-children"
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
});

TrajectoryJobGroup.displayName = 'TrajectoryJobGroup';

export default TrajectoryJobGroup;


