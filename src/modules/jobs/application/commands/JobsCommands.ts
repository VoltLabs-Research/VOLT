import type { RemoveRunningJobsRequest, RetryJobsRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { JobControl } from '@/modules/jobs/application/control/JobControl';

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
