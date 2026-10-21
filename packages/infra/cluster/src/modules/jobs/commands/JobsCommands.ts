import { getJobControl } from '@modules/jobs/services/JobControl';
import type { RemoveRunningJobsRequest, RetryJobsRequest } from '@shared/contracts/types/http-analysis';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { JobControl } from '@modules/jobs/services/JobControl';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';

export class JobsCommands {
    constructor(
        private readonly jobControl: JobControl
    ) {}

    @Command(DaemonCommand.JobsRetry)
    retry(payload: RetryJobsRequest) {
        return this.jobControl.retryJobs(payload);
    }

    @Command(DaemonCommand.JobsRemoveRunning)
    removeRunning(payload: RemoveRunningJobsRequest) {
        return this.jobControl.removeRunningJobs(payload);
    }
}

export const getJobsCommands = commandGroupFactory(JobsCommands, () => new JobsCommands(getJobControl()));
