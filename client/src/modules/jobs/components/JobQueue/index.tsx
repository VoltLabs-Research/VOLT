import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { JOB_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import useRetryJobAnalysis from '@/modules/jobs/hooks/use-retry-job-analysis';
import { Button, Heading, Loader, Row, Stack, StatusBadge, Text } from '@voltstack/bravais';
import '@/modules/jobs/components/JobQueue/JobQueue.css';
import { formatDistanceToNow } from 'date-fns';
import { sileo } from 'sileo';
import { CiRedo } from 'react-icons/ci';
import { IoCheckmark, IoCloseOutline, IoTimeOutline, IoWarningOutline } from 'react-icons/io5';
import type { ReactNode } from 'react';
import type { Job } from '@volt/contracts/modules/jobs/domain';

interface JobQueueProps {
    job: Job;
    isChild?: boolean;
};

interface StatusConfigEntry {
    icon: ReactNode;
};

const statusConfig: Partial<Record<JobStatus, StatusConfigEntry>> = {
    [JobStatus.Completed]: { icon: <IoCheckmark /> },
    [JobStatus.Running]: { icon: <Loader scale={0.3} isFixed={false} /> },
    [JobStatus.Queued]: { icon: <IoTimeOutline /> },
    [JobStatus.Retrying]: { icon: <CiRedo /> },
    [JobStatus.QueuedAfterFailure]: { icon: <IoWarningOutline /> },
    [JobStatus.Failed]: { icon: <IoCloseOutline /> }
};

const queueTypeNames: Record<string, string> = {
    'analysis_processing': 'Analysis',
    'trajectory_rasterization': 'Rasterization',
    'trajectory_glb_conversion': 'GLB Conversion',
    'trajectory_compression': 'Compression',
    'cloud_upload': 'Uploading to Cluster',
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
    // Every hook must run before any early return: `job.status` arrives over the
    // socket, so an unmapped status must not change the hook call order.
    const retryJobAnalysis = useRetryJobAnalysis();

    const statusEntry = statusConfig[job.status];
    if (!statusEntry) return null;

    const containerClass = `job-container ${job.status}${isChild ? ' is-child' : ''}`;
    const isFailed = job.status === JobStatus.Failed;
    const isAnalysisJob = job.queueType === 'analysis_processing';
    const hasFrameTimestep = job.timestep !== undefined && job.timestep >= 0;
    const statusLabel = JOB_STATUS_LABELS[job.status];

    const analysisId = job.jobId?.split('-').slice(0, -1).join('-');

    const handleRetry = async () => {
        if (!analysisId) {
            sileo.error({ title: 'Cannot retry: Invalid job ID' });
            return;
        }

        await retryJobAnalysis(analysisId);
    };

    const showRetryAction = isFailed && isAnalysisJob && Boolean(analysisId);

    return (
        <Row justify='between' gap='075' className={containerClass}>
            <span className='job-status-icon text-lg' aria-hidden='true'>{statusEntry.icon}</span>
            <Stack gap='025' flex='1' minW='0'>
                <Row justify='between' gap='05' wrap>
                    <Heading level={3} size='sm' weight='bold' className='job-name'>
                        {getJobDisplayName(job)}
                    </Heading>
                    <StatusBadge status={job.status} size='compact'>{statusLabel}</StatusBadge>
                </Row>
                <Row gap='05' wrap>
                    <Text as='p' size='sm' tone='secondary' className='job-message flex items-center gap-2'>
                        {hasFrameTimestep && <span>Frame {job.timestep}</span>}
                        {hasFrameTimestep && job.timestamp && <span>&middot;</span>}
                        {job.timestamp && <span>{formatDistanceToNow(new Date(job.timestamp), { addSuffix: true })}</span>}
                    </Text>
                    {job.processingTimeMs && job.status === JobStatus.Completed && (
                        <Text size='sm' tone='muted' className='job-meta'>• {formatDuration(job.processingTimeMs)}</Text>
                    )}
                </Row>
                {job.error && (
                    <Text as='p' size='sm' className='job-error mt-1'>{job.error}</Text>
                )}
            </Stack>
            <Row gap='075'>
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
            </Row>
        </Row>
    );
};

export default JobQueue;
