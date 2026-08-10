import { cn } from '@heroui/react';
import { FRAME_GROUP_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { StatusBadge } from '@voltstack/bravais';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import type { TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

interface JobGroupHeaderProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    group: TrajectoryJobGroup;
    statusClassName: string;
    isExpanded: boolean;
    contentId: string;
    statusPresentation: 'badge' | 'trajectory-name';
    onToggle: () => void;
};

const JobGroupHeader = forwardRef<HTMLButtonElement, JobGroupHeaderProps>(({ 
    group,
    statusClassName,
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
            return 'job-group-name--completed';
        }

        if (group.overallStatus === FrameJobGroupStatus.Running) {
            return 'job-group-name--running';
        }

        if (group.overallStatus === FrameJobGroupStatus.Queued) {
            return 'job-group-name--queued';
        }

        return '';
    }, [group.overallStatus, showCompletedHighlight, statusPresentation]);

    return (
        <button
            ref={ref}
            type='button'
            className={`job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''} job-group-toggle select-none`}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${group.trajectoryName}. ${statusLabel}. ${summaryLabel}`}
            {...buttonProps}
        >
            <div className='flex flex-row items-center justify-between gap-2 p-4 w-full'>
                <div className='flex flex-col gap-2'>
                    <h3 className={cn('text-xs font-semibold text-foreground truncate', `job-group-name ${nameToneClassName}`)}>
                        {group.trajectoryName}
                    </h3>
                    <p className='text-xs text-muted'>
                        {summaryLabel}
                    </p>
                </div>
                <div className='flex flex-row items-center gap-4'>
                    {statusPresentation === 'badge' && (
                        <StatusBadge status={group.overallStatus} size='compact'>
                            {statusLabel}
                        </StatusBadge>
                    )}
                    <motion.i
                        className='chevron-icon text-xs text-muted'
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
