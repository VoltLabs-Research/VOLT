import { createJobControlService } from '../../job-runtime/services';
import type { QueueService, RedisConnectionService } from '../../platform/services';
import type { ReverseChannelCommandHandler } from '../services';
import { readRecord, readString, toPayloadRecord } from './payloadValidation';

interface JobHandlersDependencies {
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
}

export const createJobHandlers = (deps: JobHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'queue.dispatch',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            await deps.queueService.enqueue(readString(body.queueName, 'queueName'), readRecord(body.payload, 'payload'));
            return { data: { queued: true } };
        }
    },
    {
        command: 'jobs.list',
        execute: async (payload) => {
            const body = readRecord(toPayloadRecord(payload), 'payload');
            const jobs = await deps.redisConnectionService.getTeamJobs(readString(body.teamId, 'teamId'));
            return {
                data: {
                    data: jobs.map((job: Record<string, unknown>) => ({
                        createdAt: typeof job.createdAt === 'string' ? job.createdAt : new Date().toISOString(),
                        updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : new Date().toISOString(),
                        ...job
                    }))
                }
            };
        }
    },
    {
        command: 'jobs.retry',
        execute: async (payload) => ({
            data: await createJobControlService(deps.queueService, deps.redisConnectionService).retryJobs(payload as never)
        })
    },
    {
        command: 'jobs.remove-running',
        execute: async (payload) => ({
            data: await createJobControlService(deps.queueService, deps.redisConnectionService).removeRunningJobs(payload as never)
        })
    },
    {
        command: 'jobs.clear-history',
        execute: async (payload) => ({
            data: await createJobControlService(deps.queueService, deps.redisConnectionService).clearJobsHistory(payload as never)
        })
    }
];
