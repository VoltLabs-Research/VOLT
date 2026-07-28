import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';

export const frameGroupStatusClassNames: Record<FrameJobGroupStatus, string> = {
    [FrameJobGroupStatus.Queued]: 'status-queued',
    [FrameJobGroupStatus.Running]: 'status-running',
    [FrameJobGroupStatus.Completed]: 'status-completed',
    [FrameJobGroupStatus.Failed]: 'status-failed',
    [FrameJobGroupStatus.Partial]: 'status-partial'
};
