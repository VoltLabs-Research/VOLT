import { FrameJobGroupStatus, JobStatus } from '@/modules/jobs/api/entities/job';

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
    [JobStatus.Queued]: 'Queued',
    [JobStatus.Running]: 'Running',
    [JobStatus.Completed]: 'Completed',
    [JobStatus.Failed]: 'Failed',
    [JobStatus.Retrying]: 'Retrying',
    [JobStatus.Unknown]: 'Unknown',
    [JobStatus.QueuedAfterFailure]: 'Queued after failure'
};

const FRAME_GROUP_STATUS_LABELS: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'Queued',
    [FrameJobGroupStatus.Running]: 'Running',
    [FrameJobGroupStatus.Completed]: 'Completed',
    [FrameJobGroupStatus.Failed]: 'Failed',
    [FrameJobGroupStatus.Partial]: 'Partially complete'
};

export const getJobStatusLabel = (status: JobStatus): string => {
    return JOB_STATUS_LABELS[status];
};

export const getFrameGroupStatusLabel = (status: FrameJobGroupStatus): string => {
    return FRAME_GROUP_STATUS_LABELS[status];
};
