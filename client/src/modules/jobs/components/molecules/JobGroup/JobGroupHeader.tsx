import { getFrameGroupStatusLabel } from '@/modules/jobs/utilities/job-status-label';
import Container from '@/shared/presentation/components/Container';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Title from '@/shared/presentation/components/Title';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { forwardRef } from 'react';
import type { TrajectoryJobGroup } from '@/modules/jobs/api/entities/job';

interface JobGroupHeaderProps {
    group: TrajectoryJobGroup;
    statusClassName: string;
    isExpanded: boolean;
    contentId: string;
    onToggle: () => void;
};

const JobGroupHeader = forwardRef<HTMLButtonElement, JobGroupHeaderProps>(({ 
    group,
    statusClassName,
    isExpanded,
    contentId,
    onToggle
}, ref) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const statusLabel = getFrameGroupStatusLabel(group.overallStatus);

    return (
        <button
            ref={ref}
            type='button'
            className={`job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''} job-group-toggle u-select-none`}
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
        >
            <Container className='d-flex w-max items-center content-between gap-05 p-1'>
                <Container className='d-flex column gap-05'>
                    <Title className='font-size-1 font-weight-6 color-primary job-group-name text-truncate'>
                        {group.trajectoryName}
                    </Title>
                    <Paragraph className='font-size-1 color-secondary'>
                        {group.completedCount}/{group.totalCount} jobs • {formatDistanceToNow(group.latestTimestamp, { addSuffix: true })}
                    </Paragraph>
                </Container>
                <Container className='d-flex items-center gap-1'>
                    <StatusBadge status={group.overallStatus} size='compact'>
                        {statusLabel}
                    </StatusBadge>
                    <motion.i
                        className='chevron-icon font-size-1 color-secondary'
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                        aria-hidden='true'
                    >
                        <IoChevronForward />
                    </motion.i>
                </Container>
            </Container>
        </button>
    );
});

JobGroupHeader.displayName = 'JobGroupHeader';

export default JobGroupHeader;
