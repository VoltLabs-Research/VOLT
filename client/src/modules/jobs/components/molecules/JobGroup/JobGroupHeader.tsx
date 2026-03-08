import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import type { TrajectoryJobGroup } from '@/modules/jobs/api/entities/job';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusBadge from '@/shared/presentation/components/StatusBadge';

interface JobGroupHeaderProps {
    group: TrajectoryJobGroup;
    statusClassName: string;
    isExpanded: boolean;
    onToggle: () => void;
}

const JobGroupHeader = forwardRef<HTMLDivElement, JobGroupHeaderProps>(({
    group,
    statusClassName,
    isExpanded,
    onToggle
}, ref) => {
    return (
        <Container
            ref={ref}
            className={`job-group-header ${statusClassName} ${isExpanded ? 'expanded' : ''} u-select-none cursor-pointer`}
            onClick={onToggle}
        >
            <Container className='d-flex w-max items-center content-between gap-05 p-1'>
                <Container className='d-flex column gap-01'>
                    <Title className='font-size-1 font-weight-6 color-primary job-group-name text-truncate'>
                        {group.trajectoryName}
                    </Title>
                    <Paragraph className='font-size-1 color-secondary'>
                        {group.completedCount}/{group.totalCount} jobs • {formatDistanceToNow(group.latestTimestamp, { addSuffix: true })}
                    </Paragraph>
                </Container>
                <Container className='d-flex items-center gap-1'>
                    <StatusBadge status={group.overallStatus} size='compact' />
                    <motion.i
                        className='chevron-icon font-size-1 color-secondary'
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <IoChevronForward />
                    </motion.i>
                </Container>
            </Container>
        </Container>
    );
});

JobGroupHeader.displayName = 'JobGroupHeader';

export default JobGroupHeader;
