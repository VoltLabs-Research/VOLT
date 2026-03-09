import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import {
    EnqueueSSHImportJobInput,
    EnqueueSSHImportJobOutput,
    ISSHImportQueue
} from '@modules/ssh/domain/port/ISSHImportQueue';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import Job from '@modules/jobs/domain/entities/Job';
import path from 'path';
import { v4 } from 'uuid';

@injectable()
export default class SSHImportQueue extends BaseProcessingQueue implements ISSHImportQueue {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry
    ) {
        super(
            {
                queueName: 'ssh_import',
                workerPath: path.join(__dirname, '../workers/SSHImportWorker.ts'),
                maxConcurrentJobs: 2,
                withWorker: false
            },
            {
                redis,
                eventBus,
                queueRegistry
            }
        );
    }

    async enqueueImportJob(input: EnqueueSSHImportJobInput): Promise<EnqueueSSHImportJobOutput> {
        const jobId = v4();
        const queueId = v4();
        const trajectoryName = `Import: ${input.remotePath.split('/').pop() || input.remotePath}`;

        const job = Job.create({
            jobId,
            teamId: input.teamId,
            queueType: 'ssh_import',
            message: `From ${input.username}@${input.host}`,
            metadata: {
                trajectoryId: `import-${queueId}`,
                trajectoryName,
                timestep: 0,
                name: 'Import Trajectory',
                sshConnectionId: input.sshConnectionId,
                remotePath: input.remotePath,
                userId: input.userId
            }
        });

        const { sessionId } = await this.addJobsWithSession([job]);

        return {
            jobId,
            sessionId
        };
    }
}
