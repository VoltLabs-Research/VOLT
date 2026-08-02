import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
    [JobStatus.Queued]: 'Queued',
    [JobStatus.Running]: 'Running',
    [JobStatus.Completed]: 'Completed',
    [JobStatus.Failed]: 'Failed',
    [JobStatus.Retrying]: 'Retrying',
    [JobStatus.QueuedAfterFailure]: 'Queued after failure'
};

export const FRAME_GROUP_STATUS_LABELS: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'Queued',
    [FrameJobGroupStatus.Running]: 'Running',
    [FrameJobGroupStatus.Completed]: 'Completed',
    [FrameJobGroupStatus.Failed]: 'Failed',
    [FrameJobGroupStatus.Partial]: 'Partially complete'
};
