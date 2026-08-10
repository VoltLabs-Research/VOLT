import { cn } from '@heroui/react';
import { FRAME_GROUP_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import JobStatusBadge from '@/modules/jobs/components/JobStatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import type { TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

interface JobGroupHeaderProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    group: TrajectoryJobGroup;
    isExpanded: boolean;
    contentId: string;
    statusPresentation: 'badge' | 'trajectory-name';
    onToggle: () => void;
};

/**
 * `.job-group-header` + `.job-group-toggle`: a full-width, borderless, transparent
 * row that keeps a control's height and its own focus ring instead of the UA outline.
 */
const TOGGLE_CLASS_NAMES = [
    'w-full min-h-[3.25rem] border-0 bg-transparent text-left select-none rounded-2xl',
    'transition-colors duration-200 hover:bg-surface-hover',
    'focus-visible:outline-none',
    'focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)]'
].join(' ');

/**
 * Two durations, so this is the `transition` shorthand rather than
 * `transition-[color,text-shadow]` — the colour settles faster than the glow.
 * The reduced-motion opt-out is global now (`index.css`), not restated per rule.
 */
const NAME_CLASS_NAMES = 'max-w-[200px] truncate [transition:color_140ms_ease,text-shadow_180ms_ease]';

const NAME_TONE_CLASS_NAMES: Record<'queued' | 'running' | 'completed', string> = {
    queued: 'text-warning',
    // `--accent-blue`, which is now the foreground — the same ink the row already has.
    running: 'text-foreground',
    completed: 'text-success text-shadow-[0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)]'
};

const JobGroupHeader = forwardRef<HTMLButtonElement, JobGroupHeaderProps>(({
    group,
    isExpanded,
    contentId,
    statusPresentation,
    onToggle,
    ...buttonProps
}, ref) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const statusLabel = FRAME_GROUP_STATUS_LABELS[group.overallStatus];
    const summaryLabel = `${group.completedCount}/${group.totalCount} jobs • ${formatDistanceToNow(group.latestTimestamp, { addSuffix: true })}`;
    const previousStatusRef = useRef(group.overallStatus);
    const completionTimerRef = useRef<number | null>(null);
    const [showCompletedHighlight, setShowCompletedHighlight] = useState(false);

    useEffect(() => {
        return () => {
            if (completionTimerRef.current !== null) {
                window.clearTimeout(completionTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (
            previousStatusRef.current === FrameJobGroupStatus.Running
            && group.overallStatus === FrameJobGroupStatus.Completed
        ) {
            if (completionTimerRef.current !== null) {
                window.clearTimeout(completionTimerRef.current);
            }

            setShowCompletedHighlight(true);
            completionTimerRef.current = window.setTimeout(() => {
                setShowCompletedHighlight(false);
                completionTimerRef.current = null;
            }, SESSION_COMPLETION_HIGHLIGHT_MS);
        } else if (group.overallStatus !== FrameJobGroupStatus.Completed && showCompletedHighlight) {
            if (completionTimerRef.current !== null) {
                window.clearTimeout(completionTimerRef.current);
                completionTimerRef.current = null;
            }
            setShowCompletedHighlight(false);
        }

        previousStatusRef.current = group.overallStatus;
    }, [group.overallStatus, showCompletedHighlight]);

    const nameToneClassName = useMemo(() => {
        if (statusPresentation !== 'trajectory-name') {
            return '';
        }

        if (showCompletedHighlight) {
            return NAME_TONE_CLASS_NAMES.completed;
        }

        if (group.overallStatus === FrameJobGroupStatus.Running) {
            return NAME_TONE_CLASS_NAMES.running;
        }

        if (group.overallStatus === FrameJobGroupStatus.Queued) {
            return NAME_TONE_CLASS_NAMES.queued;
        }

        return '';
    }, [group.overallStatus, showCompletedHighlight, statusPresentation]);

    return (
        <button
            ref={ref}
            type='button'
            className={TOGGLE_CLASS_NAMES}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${group.trajectoryName}. ${statusLabel}. ${summaryLabel}`}
            {...buttonProps}
        >
            <div className='flex flex-row items-center justify-between gap-2 p-4 w-full'>
                <div className='flex flex-col gap-2'>
                    <h3 className={cn('text-xs font-semibold text-foreground truncate', NAME_CLASS_NAMES, nameToneClassName)}>
                        {group.trajectoryName}
                    </h3>
                    <p className='text-xs text-muted'>
                        {summaryLabel}
                    </p>
                </div>
                <div className='flex flex-row items-center gap-4'>
                    {statusPresentation === 'badge' && (
                        <JobStatusBadge status={group.overallStatus}>
                            {statusLabel}
                        </JobStatusBadge>
                    )}
                    <motion.i
                        className='text-xs text-muted'
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                        aria-hidden='true'
                    >
                        <ChevronRight />
                    </motion.i>
                </div>
            </div>
        </button>
    );
});

JobGroupHeader.displayName = 'JobGroupHeader';

export default JobGroupHeader;
