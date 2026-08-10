import { cn } from '@heroui/react';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { JOB_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import useRetryJobAnalysis from '@/modules/jobs/hooks/use-retry-job-analysis';
import { Button, Loader, StatusBadge } from '@voltstack/bravais';
import '@/modules/jobs/components/JobQueue/JobQueue.css';
import { formatDistanceToNow } from 'date-fns';
import { sileo } from 'sileo';
import { Check, Clock, Redo2, TriangleAlert, X } from 'lucide-react';
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
    [JobStatus.Completed]: { icon: <Check /> },
    [JobStatus.Running]: { icon: <Loader scale={0.3} isFixed={false} /> },
    [JobStatus.Queued]: { icon: <Clock /> },
    [JobStatus.Retrying]: { icon: <Redo2 /> },
    [JobStatus.QueuedAfterFailure]: { icon: <TriangleAlert /> },
    [JobStatus.Failed]: { icon: <X /> }
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
        <div className={cn('flex flex-row items-center justify-between gap-3', containerClass)}>
            <span className='job-status-icon text-base' aria-hidden='true'>{statusEntry.icon}</span>
            <div className='flex flex-col gap-1 flex-1 min-w-0'>
                <div className='flex flex-row items-center justify-between flex-wrap gap-2'>
                    <h3 className='text-xs font-semibold text-foreground job-name'>
                        {getJobDisplayName(job)}
                    </h3>
                    <StatusBadge status={job.status} size='compact'>{statusLabel}</StatusBadge>
                </div>
                <div className='flex flex-row items-center flex-wrap gap-2'>
                    <p className='text-xs text-muted job-message flex items-center gap-2'>
                        {hasFrameTimestep && <span>Frame {job.timestep}</span>}
                        {hasFrameTimestep && job.timestamp && <span>&middot;</span>}
                        {job.timestamp && <span>{formatDistanceToNow(new Date(job.timestamp), { addSuffix: true })}</span>}
                    </p>
                    {job.processingTimeMs && job.status === JobStatus.Completed && (
                        <span className='text-xs text-muted job-meta'>• {formatDuration(job.processingTimeMs)}</span>
                    )}
                </div>
                {job.error && (
                    <p className='text-xs job-error mt-1'>{job.error}</p>
                )}
            </div>
            <div className='flex flex-row items-center gap-3'>
                {showRetryAction && (
                    <Button
                        variant='outline'
                        intent='neutral'
                        size='sm'
                        onClick={handleRetry}
                        leftIcon={<Redo2 />}
                        className='job-retry-button'
                    >
                        Retry
                    </Button>
                )}
            </div>
        </div>
    );
};

export default JobQueue;
