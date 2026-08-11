import { cn } from '@heroui/react';
import { FRAME_GROUP_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
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
    onToggle: () => void;
};

const JobGroupHeader = forwardRef<HTMLButtonElement, JobGroupHeaderProps>(({
    group,
    isExpanded,
    contentId,
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
        if (showCompletedHighlight) {
            return 'text-success text-shadow-[0_0_10px_color-mix(in_srgb,var(--success)_35%,transparent)]';
        }

        if (group.overallStatus === FrameJobGroupStatus.Running) {
            return 'text-foreground';
        }

        if (group.overallStatus === FrameJobGroupStatus.Queued) {
            return 'text-warning';
        }

        if (group.overallStatus === FrameJobGroupStatus.Completed) {
            return 'text-success';
        }

        if (group.overallStatus === FrameJobGroupStatus.Failed) {
            return 'text-danger';
        }

        return '';
    }, [group.overallStatus, showCompletedHighlight]);

    return (
        <button
            ref={ref}
            type='button'
            className='w-full min-h-[3.25rem] border-0 bg-transparent text-left select-none rounded-xl transition-colors duration-150 hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_30%,transparent)]'
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${group.trajectoryName}. ${statusLabel}. ${summaryLabel}`}
            {...buttonProps}
        >
            <div className='flex flex-row items-center justify-between gap-3 px-3 py-3 w-full'>
                <div className='flex min-w-0 flex-col gap-0.5'>
                    <h3 className={cn('text-sm font-medium text-foreground truncate [transition:color_140ms_ease,text-shadow_180ms_ease]', nameToneClassName)}>
                        {group.trajectoryName}
                    </h3>
                    <p className='text-xs text-muted tabular-nums'>
                        {summaryLabel}
                    </p>
                </div>
                <div className='flex shrink-0 flex-row items-center gap-2'>
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
