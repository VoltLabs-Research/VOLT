import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronRight, FaTrash, FaStop, FaRedo } from 'react-icons/fa';
import type { TrajectoryJobGroup as TrajectoryJobGroupType, FrameJobGroup, Job } from '@/modules/jobs/domain/entities';
import { formatDistanceToNow } from 'date-fns';
import JobQueue from '@/modules/jobs/presentation/components/atoms/JobQueue';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Popover from '@/shared/presentation/components/molecules/common/Popover';
import PopoverMenuItem from '@/shared/presentation/components/atoms/common/PopoverMenuItem';
import { useTrajectoryJobs } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import { useJobStore } from '@/modules/jobs/presentation/stores';
import '@/modules/jobs/presentation/components/molecules/TrajectoryJobGroup/TrajectoryJobGroup.css';
import useToast from '@/shared/presentation/hooks/ui/use-toast';

interface TrajectoryJobGroupProps {
    group: TrajectoryJobGroupType;
    defaultExpanded?: boolean;
}

const statusConfig = {
    queued: 'status-queued',
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
                className={`frame-job-group-header ${statusClassName} u-select-none cursor-pointer`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Container className="d-flex items-center content-between w-max">
                    <Paragraph className="font-size-1 color-secondary">{label}</Paragraph>
                    <Container className="d-flex items-center gap-05">
                        <span className={`frame-status-badge ${statusClassName} font-weight-6`}>{frame.jobs.length}</span>
                        <motion.i
                            className="chevron-icon font-size-1 color-secondary"
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
    const removeTrajectoryGroup = useJobStore((state) => state.removeTrajectoryGroup);
    const { showSuccess, showInfo, showError } = useToast();
    const { clearHistory, removeRunningJobs, retryFailedJobs } = useTrajectoryJobs(group.trajectoryId);

    React.useEffect(() => {
        setIsExpanded(defaultExpanded);
    }, [defaultExpanded]);

    const statusClassName = statusConfig[group.overallStatus];

    const handleClearHistory = async () => {
        showSuccess('Clearing history...');
        
        // Optimistic UI update
        removeTrajectoryGroup(group.trajectoryId);

        try {
            const response = await clearHistory.mutateAsync();
            showSuccess(`History cleared: ${response.deletedJobs} jobs and ${response.deletedAnalyses} analyses removed`);
        } catch (error: any) {
            console.error('Failed to clear history', error);
            showError(error?.response?.data?.message || 'Failed to clear history');
        }
    };

    const handleRemoveRunningJobs = async () => {
        showSuccess('Removing running jobs...');

        try {
            const response = await removeRunningJobs.mutateAsync();
            if (response.deletedJobs === 0) {
                showInfo('No running jobs found');
            } else {
                showSuccess(`Removed ${response.deletedJobs} running jobs and ${response.deletedAnalyses} analyses`);
            }
        } catch (error: any) {
            console.error('Failed to remove running jobs', error);
            showError(error?.response?.data?.message || 'Failed to remove running jobs');
        }
    };

    const handleRetryFailedJobs = async () => {
        showSuccess('Retrying failed jobs...');

        try {
            const response = await retryFailedJobs.mutateAsync();
            if (response.retriedFrames === 0) {
                showInfo('No failed frames found to retry');
            } else {
                showSuccess(`Queued ${response.retriedFrames} failed frames for retry`);
            }
        } catch (error: any) {
            console.error('Failed to retry failed jobs', error);
            showError(error?.response?.data?.message || 'Failed to retry failed jobs');
        }
    };

    const headerContent = (
        <Container
            className={`trajectory-job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''} u-select-none cursor-pointer`}
            onClick={() => setIsExpanded(!isExpanded)}
        >
            <Container className="d-flex w-max items-center content-between gap-05 p-1">
                <Container className="d-flex column gap-01">
                    <Title className="font-size-1 font-weight-6 color-primary trajectory-name overflow-hidden">
                        {group.trajectoryName}
                    </Title>
                    <Paragraph className="font-size-1 color-secondary">
                        {group.completedCount}/{group.totalCount} jobs • {formatDistanceToNow(group.latestTimestamp, { addSuffix: true })}
                    </Paragraph>
                </Container>
                <Container className="d-flex items-center gap-1">
                    <span className={`overall-status-badge ${statusClassName} font-weight-6`}>
                        {group.overallStatus}
                    </span>
                    <motion.i
                        className="chevron-icon font-size-1 color-secondary"
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <FaChevronRight />
                    </motion.i>
                </Container>
            </Container>
        </Container>
    );

    const isAnyActionLoading = clearHistory.isPending || removeRunningJobs.isPending || retryFailedJobs.isPending;

    return (
        <Container className="trajectory-job-group">
            <Popover
                id={`trajectory-job-menu-${group.trajectoryId}`}
                trigger={headerContent}
                triggerAction="contextmenu"
            >
                {(close) => (
                    <>
                        <PopoverMenuItem
                            icon={<FaTrash />}
                            onClick={() => {
                                handleClearHistory();
                                close();
                            }}
                            variant="danger"
                            isLoading={clearHistory.isPending}
                            disabled={isAnyActionLoading}
                        >
                            Clear History
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={<FaStop />}
                            onClick={() => {
                                handleRemoveRunningJobs();
                                close();
                            }}
                            variant="danger"
                            isLoading={removeRunningJobs.isPending}
                            disabled={isAnyActionLoading}
                        >
                            Remove Running Jobs
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={<FaRedo />}
                            onClick={() => {
                                handleRetryFailedJobs();
                                close();
                            }}
                            isLoading={retryFailedJobs.isPending}
                            disabled={isAnyActionLoading}
                        >
                            Retry Failed Jobs
                        </PopoverMenuItem>
                    </>
                )}
            </Popover>

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
