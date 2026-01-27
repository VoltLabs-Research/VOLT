import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes, FaRedo } from 'react-icons/fa';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Popover from '@/shared/presentation/components/molecules/common/Popover';
import PopoverMenuItem from '@/shared/presentation/components/atoms/common/PopoverMenuItem';
import { useRetryFailedFrames } from '@/modules/analysis/presentation/hooks/use-analysis-queries';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import type { Job } from '../../../../domain/entities/Job';
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

const queueTypeNames: Record<string, string> = {
    'trajectory_processing': 'Processing',
    'cloud-upload': 'Cloud Upload',
    'rasterizer': 'Rasterizer',
    'analysis': 'Analysis'
};

const getJobDisplayName = (job: Job): string => {
    if (job.name) return job.name;
    if (job.queueType && queueTypeNames[job.queueType]) return queueTypeNames[job.queueType];
    if (job.queueType) return job.queueType;
    return 'Job';
};

const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
};

interface JobQueueProps {
    job: Job;
    isChild?: boolean;
}

const JobQueue = ({ job, isChild = false }: JobQueueProps) => {
    const { showSuccess, showError, showInfo } = useToast();
    const retryFailedFrames = useRetryFailedFrames();

    if (!(job.status in statusConfig)) return null;

    const containerClass = `job-container ${job.status}${isChild ? ' is-child' : ''}`;
    const isFailed = job.status === 'failed';
    const isAnalysisJob = job.queueType === 'analysis';
    const analysisId = job.jobId?.split('-').slice(0, -1).join('-');

    const handleRetry = async () => {
        if (!analysisId) {
            showError('Cannot retry: Invalid job ID');
            return;
        }

        try {
            const response = await retryFailedFrames.mutateAsync(analysisId);
            if (response && response.retriedFrames === 0) {
                showInfo('No failed frames found to retry');
            } else if (response) {
                showSuccess(
                    `Queued ${response.retriedFrames} failed frame${response.retriedFrames > 1 ? 's' : ''} for retry`
                );
            }
        } catch (e: any) {
            console.error('Failed to retry frames', e);
            showError(e?.message || 'Failed to retry frames');
        }
    };

    const jobContent = (
        <Container className={containerClass}>
            <Container className='d-flex column gap-025 flex-1'>
                <Container className='d-flex items-center content-between gap-05'>
                    <Title className='font-size-1 job-name font-weight-6 color-primary'>
                        {getJobDisplayName(job)}
                    </Title>
                    <span className={`job-status-badge ${job.status}`}>
                        {job.status}
                    </span>
                </Container>
                <Container className='d-flex items-center gap-05'>
                    <Paragraph className='job-message color-secondary font-size-1'>
                        {job.message || job.status}
                    </Paragraph>
                    {job.processingTimeMs && job.status === 'completed' && (
                        <span className='job-meta color-muted'>• {formatDuration(job.processingTimeMs)}</span>
                    )}
                </Container>
                {job.error && (
                    <Paragraph className='job-error'>{job.error}</Paragraph>
                )}
            </Container>
            {(job.progress !== undefined && job.progress > 0 && job.status === 'running') && (
                <Container className='job-progress-bar p-relative overflow-hidden'>
                    <Container
                        className='job-progress-fill p-absolute h-max'
                        style={{ width: `${Math.min(100, job.progress)}%` }}
                    />
                    <span className='job-progress-text p-absolute font-weight-6 color-primary'>{Math.round(job.progress)}%</span>
                </Container>
            )}
        </Container>
    );

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
