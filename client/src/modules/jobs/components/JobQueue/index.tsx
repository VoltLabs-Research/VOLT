import { Button, Spinner, cn } from '@heroui/react';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { JOB_STATUS_LABELS } from '@/modules/jobs/utils/job-status-label';
import JobStatusBadge from '@/modules/jobs/components/JobStatusBadge';
import useRetryJobAnalysis from '@/modules/jobs/hooks/use-retry-job-analysis';
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

    toneClassName: string;
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
    const retryJobAnalysis = useRetryJobAnalysis();

    const statusConfig: Partial<Record<JobStatus, StatusConfigEntry>> = {
        [JobStatus.Completed]: {
            icon: <Check />,
            toneClassName: 'text-success'
        },
        [JobStatus.Running]: {
            icon: <Spinner size='sm' color='current' />,
            toneClassName: 'text-info'
        },
        [JobStatus.Queued]: {
            icon: <Clock />,
            toneClassName: 'text-warning'
        },
        [JobStatus.Retrying]: {
            icon: <Redo2 />,
            toneClassName: 'text-warning'
        },
        [JobStatus.QueuedAfterFailure]: {
            icon: <TriangleAlert />,
            toneClassName: 'text-danger'
        },
        [JobStatus.Failed]: {
            icon: <X />,
            toneClassName: 'text-danger'
        }
    };

    const statusEntry = statusConfig[job.status];
    if (!statusEntry) return null;

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
        <div
            className={cn(
                'flex flex-row items-center justify-between gap-3 min-h-[3.25rem] p-3 rounded-2xl focus-within:shadow-[0_0_0_1px_var(--border),0_0_0_4px_color-mix(in_srgb,var(--focus)_28%,transparent)]',
                isChild && 'ml-3 border-l border-border rounded-none'
            )}
        >
            <span className={cn('inline-flex items-center justify-center shrink-0 text-base', statusEntry.toneClassName)} aria-hidden='true'>
                {statusEntry.icon}
            </span>
            <div className='flex flex-col gap-1 flex-1 min-w-0'>
                <div className='flex flex-row items-center justify-between flex-wrap gap-2'>
                    <h3 className='text-xs font-semibold text-foreground truncate tracking-[0.15px] leading-[1.2]'>
                        {getJobDisplayName(job)}
                    </h3>
                    <JobStatusBadge status={job.status}>{statusLabel}</JobStatusBadge>
                </div>
                <div className='flex flex-row items-center flex-wrap gap-2'>
                    <p className={cn('flex items-center gap-2 text-xs leading-[1.3]', statusEntry.toneClassName)}>
                        {hasFrameTimestep && <span>Frame {job.timestep}</span>}
                        {hasFrameTimestep && job.timestamp && <span>&middot;</span>}
                        {job.timestamp && <span>{formatDistanceToNow(new Date(job.timestamp), { addSuffix: true })}</span>}
                    </p>
                    {job.processingTimeMs && job.status === JobStatus.Completed && (
                        <span className='text-xs text-muted opacity-70 whitespace-nowrap'>• {formatDuration(job.processingTimeMs)}</span>
                    )}
                </div>
                {job.error && (
                    <p className='text-xs text-danger leading-[1.3] mt-1'>{job.error}</p>
                )}
            </div>
            <div className='flex flex-row items-center gap-3'>
                {showRetryAction && (
                    <Button
                        variant='outline'
                        size='sm'
                        onPress={handleRetry}
                        className='min-w-20'
                    >
                        <Redo2 />
                        Retry
                    </Button>
                )}
            </div>
        </div>
    );
};

export default JobQueue;
