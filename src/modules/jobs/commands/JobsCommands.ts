import { getJobControl } from '@modules/jobs/services/JobControl';
import type { RemoveRunningJobsRequest, RetryJobsRequest } from '@shared/contracts';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { JobControl } from '@modules/jobs/services/JobControl';

@CommandGroup('jobs')
export class JobsCommands {
    constructor(
        private readonly jobControl: JobControl
    ) {}

    @Command('retry')
    retry(payload: RetryJobsRequest) {
        return this.jobControl.retryJobs(payload);
    }

    @Command('remove-running')
    removeRunning(payload: RemoveRunningJobsRequest) {
        return this.jobControl.removeRunningJobs(payload);
    }
}

export const getJobsCommands = commandGroupFactory(JobsCommands, () => new JobsCommands(getJobControl()));
