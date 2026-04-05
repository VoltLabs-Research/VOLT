import { JobStatus } from '@/modules/jobs/api/entities/job';
import { getJobStatusLabel } from '@/modules/jobs/utilities/job-status-label';
import useRetryJobAnalysis from '@/modules/jobs/hooks/use-retry-job-analysis';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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
    'analysis_processing': 'Analysis',
    'trajectory_rasterization': 'Rasterization',
    'trajectory_glb_conversion': 'GLB Conversion',
    'trajectory_compression': 'Compression',
    'cloud_upload': 'Uploading to Cluster',
    'ssh_import': 'SSH Import',
    'cluster_transfer': 'Storage Transfer'
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
    const isAnalysisJob = job.queueType === 'analysis_processing';
    const hasFrameTimestep = typeof job.timestep === 'number' && job.timestep >= 0;
    const retryJobAnalysis = useRetryJobAnalysis();
    const statusLabel = getJobStatusLabel(job.status);

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

    const showRetryAction = isFailed && isAnalysisJob && Boolean(analysisId);

    return (
        <Container className={containerClass + ' d-flex content-between items-center gap-075'}>
            <span className='job-status-icon font-size-3' aria-hidden='true'>{statusConfig[job.status]?.icon}</span>
            <Container className='d-flex column gap-025 flex-1 min-w-0'>
                <Container className='d-flex items-center content-between gap-05 flex-wrap'>
                    <Title className='font-size-1 job-name font-weight-6 color-primary'>
                        {getJobDisplayName(job)}
                    </Title>
                    <span className={`job-status-badge ${job.status} p-025 radius-full font-size-1`} aria-label={`Status: ${statusLabel}`}>
                        {statusLabel}
                    </span>
                </Container>
                <Container className='d-flex items-center gap-05 flex-wrap'>
                    <Paragraph className='job-message color-secondary font-size-1 d-flex items-center gap-05'>
                        {hasFrameTimestep && <span>Frame {job.timestep}</span>}
                        {hasFrameTimestep && job.timestamp && <span>&middot;</span>}
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
            <Container className='d-flex items-center gap-075'>
                {(job.progress !== undefined && job.progress > 0 && job.status === JobStatus.Running) && (
                    <Container className='job-progress-bar p-relative overflow-hidden radius-xs' aria-label={`Progress ${Math.round(job.progress)} percent`}>
                        <Container
                            className='job-progress-fill p-absolute h-max top-0 left-0'
                            style={{ width: `${Math.min(100, job.progress)}%` }}
                        />
                        <span className='job-progress-text p-absolute font-weight-6 color-primary font-size-1'>{Math.round(job.progress)}%</span>
                    </Container>
                )}
                {showRetryAction && (
                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        onClick={handleRetry}
                        leftIcon={<CiRedo />}
                        className='job-retry-button'
                    >
                        Retry
                    </Button>
                )}
            </Container>
        </Container>
    );
};

export default JobQueue;
