import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes, FaRedo } from 'react-icons/fa';
import type { Job } from '@/types/jobs';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './JobQueue.css';

const statusConfig = {
    completed: { icon: <FaCheck /> },
    running: { icon: <UseAnimations animation={activity} /> },
    queued: { icon: <FaClock /> },
    retrying: { icon: <FaRedo /> },
    queued_after_failure: { icon: <FaExclamationTriangle /> },
    failed: { icon: <FaTimes /> },
    unknown: { icon: <FaExclamationTriangle /> }
};

const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
};

const JobQueue = ({ job, isChild = false }: { job: Job; isChild?: boolean }) => {
    if (!(job.status in statusConfig)) return null;

    const containerClass = `job-container ${job.status}${isChild ? ' is-child' : ''}`;

    return (
        <Container className={containerClass}>
            <Container className='d-flex column gap-025 flex-1'>
                <Container className='d-flex items-center content-between gap-05'>
                    <Title className='font-size-1 job-name font-weight-6 color-primary'>
                        {job.name || 'Job'}
                    </Title>
                    <span className={`job-status-badge ${job.status}`}>
                        {job.status}
                    </span>
                </Container>
                <Container className='d-flex items-center gap-05'>
                    <Paragraph className='job-message color-secondary'>
                        {job.message || job.status}
                    </Paragraph>
                    {job.processingTimeMs && job.status === 'completed' && (
                        <span className='job-meta'>• {formatDuration(job.processingTimeMs)}</span>
                    )}
                </Container>
                {job.error && (
                    <Paragraph className='job-error'>{job.error}</Paragraph>
                )}
            </Container>
            {(job.progress !== undefined && job.progress > 0 && job.status === 'running') && (
                <Container className='job-progress-bar'>
                    <Container
                        className='job-progress-fill'
                        style={{ width: `${Math.min(100, job.progress)}%` }}
                    />
                    <span className='job-progress-text'>{Math.round(job.progress)}%</span>
                </Container>
            )}
        </Container>
    );
};

export default JobQueue;



