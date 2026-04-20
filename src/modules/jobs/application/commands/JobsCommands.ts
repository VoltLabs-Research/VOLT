import type { RemoveRunningJobsRequest, RetryJobsRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import type { JobControl } from '@/modules/jobs/application/control/JobControl';

interface JobsListRequest {
    teamId: string;
}

@CommandGroup('jobs')
export class JobsCommands {
    constructor(
        private readonly redisConnection: RedisConnection,
        private readonly jobControl: JobControl
    ) {}

    @Command('list')
    async list(payload: JobsListRequest) {
        return {
            data: await this.redisConnection.getTeamJobs(payload.teamId)
        };
    }

    @Command('retry')
    retry(payload: RetryJobsRequest) {
        return this.jobControl.retryJobs(payload);
    }

    @Command('remove-running')
    removeRunning(payload: RemoveRunningJobsRequest) {
        return this.jobControl.removeRunningJobs(payload);
    }
}
