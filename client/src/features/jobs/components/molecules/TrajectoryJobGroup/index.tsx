import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronRight, FaTrash, FaStop, FaRedo } from 'react-icons/fa';
import type { TrajectoryJobGroup as TrajectoryJobGroupType, FrameJobGroup, Job } from '@/types/jobs';
import { formatDistanceToNow } from 'date-fns';
import JobQueue from '@/features/jobs/components/atoms/JobQueue';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import trajectoryJobsApi from '@/features/trajectory/api/trajectory-jobs';
import { useTeamJobsStore } from '@/features/team/stores';
import '@/features/jobs/components/molecules/TrajectoryJobGroup/TrajectoryJobGroup.css';
import useToast from '@/hooks/ui/use-toast';

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
    const [loadingAction, setLoadingAction] = React.useState<string | null>(null);
    const removeTrajectoryGroup = useTeamJobsStore((state) => state.removeTrajectoryGroup);
    const { showSuccess, showInfo, showError, showWarning } = useToast();

    React.useEffect(() => {
        setIsExpanded(defaultExpanded);
    }, [defaultExpanded]);

    const statusClassName = statusConfig[group.overallStatus];

    const handleClearHistory = async () => {
        // Optimistic toast
        showSuccess('Clearing history...');

        setLoadingAction('clear');

        // Remove group immediately for optimistic UI
        removeTrajectoryGroup(group.trajectoryId);

        try {
            const response = await trajectoryJobsApi.clearHistory(group.trajectoryId);
            showSuccess(`History cleared: ${response.deletedJobs} jobs and ${response.deletedAnalyses} analyses removed`);
        } catch (error: any) {
            console.error('Failed to clear history', error);
            showError(error?.response?.data?.message || 'Failed to clear history');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRemoveRunningJobs = async () => {
        // Optimistic toast
        showSuccess('Removing running jobs...');

        setLoadingAction('remove');
        try {
            const response = await trajectoryJobsApi.removeRunningJobs(group.trajectoryId);
            if (response.deletedJobs === 0) {
                showInfo('No running jobs found');
            } else {
                showSuccess(`Removed ${response.deletedJobs} running jobs and ${response.deletedAnalyses} analyses`);
            }
        } catch (error: any) {
            console.error('Failed to remove running jobs', error);
            showError(error?.response?.data?.message || 'Failed to remove running jobs');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleRetryFailedJobs = async () => {
        // Optimistic toast
        showSuccess('Retrying failed jobs...');

        setLoadingAction('retry');
        try {
            const response = await trajectoryJobsApi.retryFailedJobs(group.trajectoryId);
            if (response.retriedFrames === 0) {
                showInfo('No failed frames found to retry');
            } else {
                showSuccess(`Queued ${response.retriedFrames} failed frames for retry`);
            }
        } catch (error: any) {
            console.error('Failed to retry failed jobs', error);
            showError(error?.response?.data?.message || 'Failed to retry failed jobs');
        } finally {
            setLoadingAction(null);
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
                            isLoading={loadingAction === 'clear'}
                            disabled={loadingAction !== null}
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
                            isLoading={loadingAction === 'remove'}
                            disabled={loadingAction !== null}
                        >
                            Remove Running Jobs
                        </PopoverMenuItem>
                        <PopoverMenuItem
                            icon={<FaRedo />}
                            onClick={() => {
                                handleRetryFailedJobs();
                                close();
                            }}
                            isLoading={loadingAction === 'retry'}
                            disabled={loadingAction !== null}
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


