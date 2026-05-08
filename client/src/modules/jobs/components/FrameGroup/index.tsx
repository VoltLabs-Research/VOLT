import { getFrameGroupStatusLabel } from '@/modules/jobs/utilities/job-status-label';
import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import JobQueue from '@/modules/jobs/components/JobQueue';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import StatusBadge from '@/shared/presentation/primitives/StatusBadge';
import Text from '@/shared/presentation/primitives/Text';
import { motion } from 'framer-motion';
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
        <Box className='frame-job-group'>
            <button
                type='button'
                className='frame-job-group-header frame-job-group-toggle u-select-none'
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
            >
                <Row justify='between' width='max'>
                    <Text as='p' size='sm' tone='secondary'>{label}</Text>
                    <Row gap='05'>
                        <StatusBadge status={frame.overallStatus} size='compact'>{statusLabel}</StatusBadge>
                        <motion.i
                            className='chevron-icon font-size-1 color-secondary'
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                            aria-hidden='true'
                        >
                            <IoChevronForward />
                        </motion.i>
                    </Row>
                </Row>
            </button>
            <CollapsibleJobContent id={contentId} isExpanded={isExpanded}>
                {jobs}
            </CollapsibleJobContent>
        </Box>
    );
};

export default FrameGroup;
