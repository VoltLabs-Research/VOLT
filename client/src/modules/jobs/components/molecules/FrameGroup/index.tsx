import { frameGroupStatusClassNames } from '@/modules/jobs/utilities/frame-group-status';
import { getFrameGroupStatusLabel } from '@/modules/jobs/utilities/job-status-label';
import JobQueue from '@/modules/jobs/components/atoms/JobQueue';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { AnimatePresence, motion } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, Job } from '@/modules/jobs/api/entities/job';

interface FrameGroupProps {
    frame: FrameJobGroup;
};

const FrameGroup = ({ frame }: FrameGroupProps) => {
    const containsTransferJobs = useMemo(() => {
        return frame.jobs.some((job) => job.queueType === 'cluster_transfer');
    }, [frame.jobs]);
    const [isExpanded, setIsExpanded] = useState(containsTransferJobs);
    const prefersReducedMotion = usePrefersReducedMotion();
    const contentId = useId();
    const statusClassName = frameGroupStatusClassNames[frame.overallStatus];
    const label = containsTransferJobs
        ? (frame.jobs.length === 1 ? 'Storage Transfer' : 'Storage Transfers')
        : frame.timestep >= 0
            ? `Frame ${frame.timestep}`
            : 'General';
    const statusLabel = getFrameGroupStatusLabel(frame.overallStatus);
    const jobs = frame.jobs.map((job: Job, index: number) => (
        <JobQueue key={job.jobId || `job-${index}`} job={job} isChild />
    ));

    useEffect(() => {
        if (containsTransferJobs) {
            setIsExpanded(true);
        }
    }, [containsTransferJobs]);

    return (
        <Container className='frame-job-group'>
            <button
                type='button'
                className={`frame-job-group-header ${statusClassName} frame-job-group-toggle u-select-none`}
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
            >
                <Container className='d-flex items-center content-between w-max'>
                    <Paragraph className='font-size-1 color-secondary'>{label}</Paragraph>
                    <Container className='d-flex items-center gap-05'>
                        <span className={`frame-status-badge ${statusClassName} font-weight-6`} aria-label={`Status: ${statusLabel}`}>
                            {statusLabel}
                        </span>
                        <motion.i
                            className='chevron-icon font-size-1 color-secondary'
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                            aria-hidden='true'
                        >
                            <IoChevronForward />
                        </motion.i>
                    </Container>
                </Container>
            </button>
            {prefersReducedMotion ? (
                isExpanded ? <div id={contentId}>{jobs}</div> : null
            ) : (
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            id={contentId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {jobs}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </Container>
    );
};

export default FrameGroup;
