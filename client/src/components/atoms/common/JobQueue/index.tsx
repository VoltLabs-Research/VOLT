import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes, FaRedo } from 'react-icons/fa';
import type { Job } from '@/types/jobs';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { toast } from 'sonner';
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
    const isFailed = job.status === 'failed';
    const isAnalysisJob = job.queueType === 'analysis';

    // Extract analysisId from jobId (format: analysisId-index)
    const analysisId = job.jobId?.split('-').slice(0, -1).join('-');

    const handleRetry = async () => {
        if (!analysisId) {
            toast.error('Cannot retry: Invalid job ID');
            return;
        }

        try {
            const response = await analysisConfigApi.retryFailedFrames(analysisId);
            if (response.retriedFrames === 0) {
                toast.info('No failed frames found to retry');
            } else {
                toast.success(
                    `Queued ${response.retriedFrames} failed frame${response.retriedFrames > 1 ? 's' : ''} for retry`
                );
            }
        } catch (e: any) {
            console.error('Failed to retry frames', e);
            toast.error(e?.response?.data?.message || 'Failed to retry frames');
        }
    };

    const jobContent = (
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

    // If job is failed and is an analysis job, wrap with popover
    if (isFailed && isAnalysisJob && analysisId) {
        return (
            <Popover
                id={`job-popover-${job.jobId}`}
                trigger={jobContent}
                triggerAction="click"
            >
                {(close) => (
                    <PopoverMenuItem
                        icon={<FaRedo />}
                        onClick={() => {
                            handleRetry();
                            close();
                        }}
                    >
                        Retry
                    </PopoverMenuItem>
                )}
            </Popover>
        );
    }

    return jobContent;
};

export default JobQueue;



