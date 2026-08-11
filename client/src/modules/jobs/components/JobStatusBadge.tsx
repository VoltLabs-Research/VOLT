import { cn } from '@heroui/react';
import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';
import type { ReactNode } from 'react';

interface JobStatusBadgeProps {
    status: JobStatus | FrameJobGroupStatus;
    children: ReactNode;
};

const JobStatusBadge = ({ status, children }: JobStatusBadgeProps) => {
    const statusToneClassNames: Record<JobStatus | FrameJobGroupStatus, string> = {
        [JobStatus.Queued]: 'text-warning',
        [JobStatus.Running]: 'text-foreground',
        [JobStatus.Completed]: 'text-success',
        [JobStatus.Failed]: 'text-danger',
        [JobStatus.Retrying]: 'text-muted',
        [JobStatus.QueuedAfterFailure]: 'text-muted',
        [FrameJobGroupStatus.Partial]: 'text-muted'
    };

    return (
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap uppercase text-xs font-medium', statusToneClassNames[status])}>
            {children}
        </span>
    );
};

export default JobStatusBadge;
