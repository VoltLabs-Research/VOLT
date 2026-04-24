import { getFrameGroupStatusLabel } from '@/modules/jobs/utilities/job-status-label';
import { FrameJobGroupStatus } from '@/modules/jobs/api/entities/job';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusBadge from '@/shared/presentation/primitives/StatusBadge';
import Text from '@/shared/presentation/primitives/Text';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/api/entities/job';

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
    const statusLabel = getFrameGroupStatusLabel(group.overallStatus);
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
            className={`job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''} job-group-toggle u-select-none`}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={`${group.trajectoryName}. ${statusLabel}. ${summaryLabel}`}
            {...buttonProps}
        >
            <Row width='max' justify='between' gap='05' p='1'>
                <Stack gap='05'>
                    <Heading level={3} size='sm' weight='bold' truncate className={`job-group-name ${nameToneClassName}`}>
                        {group.trajectoryName}
                    </Heading>
                    <Text as='p' size='sm' tone='secondary'>
                        {summaryLabel}
                    </Text>
                </Stack>
                <Row gap='1'>
                    {statusPresentation === 'badge' && (
                        <StatusBadge status={group.overallStatus} size='compact'>
                            {statusLabel}
                        </StatusBadge>
                    )}
                    <motion.i
                        className='chevron-icon font-size-1 color-secondary'
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                        aria-hidden='true'
                    >
                        <IoChevronForward />
                    </motion.i>
                </Row>
            </Row>
        </button>
    );
});

JobGroupHeader.displayName = 'JobGroupHeader';

export default JobGroupHeader;
