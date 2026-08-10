import { FRAME_GROUP_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import JobQueue from '@/modules/jobs/components/JobQueue';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { StatusBadge } from '@voltstack/bravais';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, Job } from '@volt/contracts/modules/jobs/domain';

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
    const statusLabel = FRAME_GROUP_STATUS_LABELS[frame.overallStatus];
    const jobs = frame.jobs.map((job: Job, index: number) => (
        <JobQueue key={job.jobId || `job-${index}`} job={job} isChild />
    ));

    useEffect(() => {
        if (containsTransferJobs) {
            setIsExpanded(true);
        }
    }, [containsTransferJobs]);

    return (
        <div className='frame-job-group'>
            <button
                type='button'
                className='frame-job-group-header frame-job-group-toggle select-none'
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
            >
                <div className='flex flex-row items-center justify-between w-full'>
                    <p className='text-xs text-muted'>{label}</p>
                    <div className='flex flex-row items-center gap-2'>
                        <StatusBadge status={frame.overallStatus} size='compact'>{statusLabel}</StatusBadge>
                        <motion.i
                            className='chevron-icon text-xs text-muted'
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                            aria-hidden='true'
                        >
                            <ChevronRight />
                        </motion.i>
                    </div>
                </div>
            </button>
            <CollapsibleJobContent id={contentId} isExpanded={isExpanded}>
                {jobs}
            </CollapsibleJobContent>
        </div>
    );
};

export default FrameGroup;
