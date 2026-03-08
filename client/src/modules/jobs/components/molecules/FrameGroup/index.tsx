import { frameGroupStatusClassNames } from '@/modules/jobs/utilities/frame-group-status';
import JobQueue from '@/modules/jobs/components/atoms/JobQueue';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { AnimatePresence, motion } from 'framer-motion';
import { IoChevronForward } from 'react-icons/io5';
import { useState } from 'react';
import type { FrameJobGroup, Job } from '@/modules/jobs/api/entities/job';

interface FrameGroupProps {
    frame: FrameJobGroup;
};

const FrameGroup = ({ frame }: FrameGroupProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const statusClassName = frameGroupStatusClassNames[frame.overallStatus];
    const label = `Frame ${frame.timestep}`;

    return (
        <Container className='frame-job-group'>
            <Container
                className={`frame-job-group-header ${statusClassName} u-select-none cursor-pointer`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <Container className='d-flex items-center content-between w-max'>
                    <Paragraph className='font-size-1 color-secondary'>{label}</Paragraph>
                    <Container className='d-flex items-center gap-05'>
                        <span className={`frame-status-badge ${statusClassName} font-weight-6`}>{frame.jobs.length}</span>
                        <motion.i
                            className='chevron-icon font-size-1 color-secondary'
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <IoChevronForward />
                        </motion.i>
                    </Container>
                </Container>
            </Container>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {frame.jobs.map((job: Job, index: number) => (
                            <JobQueue key={job.jobId || `job-${index}`} job={job} isChild />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </Container>
    );
};

export default FrameGroup;
