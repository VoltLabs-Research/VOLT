import CollapsibleJobContent from '@/modules/jobs/components/CollapsibleJobContent';
import JobQueue from '@/modules/jobs/components/JobQueue';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { cn } from '@heroui/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import type { FrameJobGroup, Job } from '@volt/contracts/modules/jobs/domain';

interface FrameGroupProps {
    frame: FrameJobGroup;
};

const FRAME_STATUS_TONE_CLASS_NAMES: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'text-warning',
    [FrameJobGroupStatus.Running]: 'text-info-soft-foreground',
    [FrameJobGroupStatus.Completed]: 'text-success',
    [FrameJobGroupStatus.Failed]: 'text-danger',
    [FrameJobGroupStatus.Partial]: 'text-muted'
};

const FrameGroup = ({ frame }: FrameGroupProps) => {
    const containsTransferJobs = useMemo(() => {
        return frame.jobs.some((job) => job.queueType === 'cluster_transfer');
    }, [frame.jobs]);
    const [isExpanded, setIsExpanded] = useState(containsTransferJobs);
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
                className='w-full min-h-9 px-2 py-1.5 border-0 bg-transparent text-left select-none rounded-lg transition-colors duration-150 hover:bg-foreground/6 focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)]'
                onClick={() => setIsExpanded((value) => !value)}
                aria-expanded={isExpanded}
                aria-controls={contentId}
            >
                <div className='flex flex-row items-center justify-between w-full'>
                    <p className={cn('text-xs', FRAME_STATUS_TONE_CLASS_NAMES[frame.overallStatus])}>{label}</p>
                    <div className='flex flex-row items-center gap-2'>
                        <ChevronRight
                            className={cn('size-3.5 text-muted transition-transform duration-150 ease-out-fluid', isExpanded && 'rotate-90')}
                            aria-hidden='true'
                        />
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
