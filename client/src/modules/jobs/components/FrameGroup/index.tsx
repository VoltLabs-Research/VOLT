import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import JobQueue from '@/modules/jobs/components/JobQueue';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { cn } from '@heroui/react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, Job } from '@volt/contracts/modules/jobs/domain';

interface FrameGroupProps {
    frame: FrameJobGroup;
};

const FRAME_STATUS_TONE_CLASS_NAMES: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'text-warning',
    [FrameJobGroupStatus.Running]: 'text-foreground',
    [FrameJobGroupStatus.Completed]: 'text-success',
    [FrameJobGroupStatus.Failed]: 'text-danger',
    [FrameJobGroupStatus.Partial]: 'text-muted'
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
    const jobs = frame.jobs.map((job: Job, index: number) => (
        <JobQueue key={job.jobId || `job-${index}`} job={job} isChild />
    ));

    useEffect(() => {
        if (containsTransferJobs) {
            setIsExpanded(true);
        }
    }, [containsTransferJobs]);

    return (
        <div className='ml-2 border-l border-border'>
            <button
                type='button'
                className='w-full min-h-[2.75rem] px-3 py-2.5 border-0 bg-transparent text-left select-none rounded-xl hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)]'
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
            >
                <div className='flex flex-row items-center justify-between w-full'>
                    <p className={cn('text-xs', FRAME_STATUS_TONE_CLASS_NAMES[frame.overallStatus])}>{label}</p>
                    <div className='flex flex-row items-center gap-2'>
                        <motion.i
                            className='text-xs text-muted'
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
