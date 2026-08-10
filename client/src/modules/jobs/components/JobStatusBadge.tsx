import { cn } from '@heroui/react';
import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';
import type { ReactNode } from 'react';

interface JobStatusBadgeProps {
    status: JobStatus | FrameJobGroupStatus;
    children: ReactNode;
};

/**
 * bravais's `StatusBadge`, which every call site in this module used at
 * `size='compact'`.
 *
 * Two things about it are easy to get wrong. It painted **no background and no
 * border** in any variant — despite carrying `rounded-full`, which `size='compact'`
 * then cancelled with `border-radius: 0` — so it was coloured uppercase text and
 * nothing else. A HeroUI `Chip` would add a pill that was never there. And the
 * uppercasing lived only in CSS (`.status-badge { text-transform: uppercase }`), so
 * dropping the sheet without `uppercase` here would silently render the caller's own
 * casing: `Queued` where the screen said `QUEUED`.
 *
 * Tones come from bravais's `STATUS_VARIANTS` table, resolved through this app's
 * palette: `running` mapped to variant `active` → `--accent-blue`, and the accent is
 * now the foreground, so a running badge is plain ink. `retrying`,
 * `queued_after_failure` and `partial` were never in that table and fell through to
 * `neutral`.
 */
const STATUS_TONE_CLASS_NAMES: Record<JobStatus | FrameJobGroupStatus, string> = {
    [JobStatus.Queued]: 'text-warning',
    [JobStatus.Running]: 'text-foreground',
    [JobStatus.Completed]: 'text-success',
    [JobStatus.Failed]: 'text-danger',
    [JobStatus.Retrying]: 'text-muted',
    [JobStatus.QueuedAfterFailure]: 'text-muted',
    [FrameJobGroupStatus.Partial]: 'text-muted'
};

const BADGE_CLASS_NAMES = 'inline-flex items-center gap-1 whitespace-nowrap uppercase text-xs font-medium';

const JobStatusBadge = ({ status, children }: JobStatusBadgeProps) => (
    <span className={cn(BADGE_CLASS_NAMES, STATUS_TONE_CLASS_NAMES[status])}>
        {children}
    </span>
);

export default JobStatusBadge;
