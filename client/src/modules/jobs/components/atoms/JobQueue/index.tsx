import { JobStatus } from '@/modules/jobs/api/entities/job';
import useRetryJobAnalysis from '@/modules/jobs/hooks/use-retry-job-analysis';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Title from '@/shared/presentation/components/Title';
import '@/modules/jobs/components/atoms/JobQueue/JobQueue.css';
import { formatDistanceToNow } from 'date-fns';
import { sileo } from 'sileo';
import { CiRedo } from 'react-icons/ci';
import { IoCheckmark, IoCloseOutline, IoTimeOutline, IoWarningOutline } from 'react-icons/io5';
import activity from 'react-useanimations/lib/activity';
import UseAnimations from 'react-useanimations';
import type { ReactNode } from 'react';
import type { Job } from '@/modules/jobs/api/entities/job';

interface JobQueueProps {
    job: Job;
    isChild?: boolean;
};

interface StatusConfigEntry {
    icon: ReactNode;
};

const statusConfig: Partial<Record<JobStatus, StatusConfigEntry>> = {
    [JobStatus.Completed]: { icon: <IoCheckmark /> },
    [JobStatus.Running]: { icon: <UseAnimations animation={activity} /> },
    [JobStatus.Queued]: { icon: <IoTimeOutline /> },
    [JobStatus.Retrying]: { icon: <CiRedo /> },
    [JobStatus.QueuedAfterFailure]: { icon: <IoWarningOutline /> },
    [JobStatus.Failed]: { icon: <IoCloseOutline /> },
    [JobStatus.Unknown]: { icon: <IoWarningOutline /> }
};

const queueTypeNames: Record<string, string> = {
    'trajectory_processing': 'Processing',
    'cloud-upload': 'Cloud Upload',
    'rasterizer': 'Rasterizer',
    'analysis': 'Analysis',
    'analysis_processing': 'Analysis'
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

const JobQueue = ({ job, isChild = false }: JobQueueProps) => {
    if (!statusConfig[job.status]) return null;

    const containerClass = `job-container ${job.status}${isChild ? ' is-child' : ''}`;
    const isFailed = job.status === JobStatus.Failed;
    const isAnalysisJob = job.queueType === 'analysis' || job.queueType === 'analysis_processing';
    const retryJobAnalysis = useRetryJobAnalysis();

    const analysisId = job.jobId?.split('-').slice(0, -1).join('-');

    const handleRetry = async () => {
        if (!analysisId) {
            sileo.error({ title: 'Cannot retry: Invalid job ID' });
            return;
        }

        try {
            await retryJobAnalysis(analysisId);
        } catch {
        }
    };

    const jobContent = (
        <Container className={containerClass + ' d-flex content-between items-center'}>
            <Container className='d-flex column gap-025 flex-1'>
                <Container className='d-flex items-center content-between gap-05'>
                    <Title className='font-size-1 job-name font-weight-6 color-primary'>
                        {getJobDisplayName(job)}
                    </Title>
                    <span className={`job-status-badge ${job.status} p-025 radius-full font-size-1`}>
                        {job.status}
                    </span>
                </Container>
                <Container className='d-flex items-center gap-05'>
                    <Paragraph className='job-message color-secondary font-size-1 d-flex items-center gap-05'>
                        {job.timestep !== undefined && <span>Frame {job.timestep}</span>}
                        {job.timestep !== undefined && job.timestamp && <span>&middot;</span>}
                        {job.timestamp && <span>{formatDistanceToNow(new Date(job.timestamp), { addSuffix: true })}</span>}
                    </Paragraph>
                    {job.processingTimeMs && job.status === JobStatus.Completed && (
                        <span className='job-meta color-muted font-size-1'>• {formatDuration(job.processingTimeMs)}</span>
                    )}
                </Container>
                {job.error && (
                    <Paragraph className='job-error font-size-1 mt-025'>{job.error}</Paragraph>
                )}
            </Container>
            {(job.progress !== undefined && job.progress > 0 && job.status === JobStatus.Running) && (
                <Container className='job-progress-bar p-relative overflow-hidden radius-xs'>
                    <Container
                        className='job-progress-fill p-absolute h-max top-0 left-0'
                        style={{ width: `${Math.min(100, job.progress)}%` }}
                    />
                    <span className='job-progress-text p-absolute font-weight-6 color-primary font-size-1'>{Math.round(job.progress)}%</span>
                </Container>
            )}
        </Container>
    );

    if (isFailed && isAnalysisJob && analysisId) {
        return (
            <Popover
                id={`job-popover-${job.jobId}`}
                trigger={jobContent}
                triggerAction='click'
            >
                {(close) => (
                    <PopoverMenuItem
                        icon={<CiRedo />}
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
