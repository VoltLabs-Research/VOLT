import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';

export const FRAME_GROUP_STATUS_LABELS: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'Queued',
    [FrameJobGroupStatus.Running]: 'Running',
    [FrameJobGroupStatus.Completed]: 'Completed',
    [FrameJobGroupStatus.Failed]: 'Failed',
    [FrameJobGroupStatus.Partial]: 'Partially complete'
};
