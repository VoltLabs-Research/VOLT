import { clearJobsHistory, removeRunningJobs, retryJobs } from '../../core/runtimeActions';
import type { QueueService } from '../../infrastructure/redis/QueueService';
import type { RedisConnectionService } from '../../infrastructure/redis/RedisConnectionService';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';
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
                    data: jobs.map((job) => ({
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
            data: await retryJobs(payload as never, deps.queueService, deps.redisConnectionService)
        })
    },
    {
        command: 'jobs.remove-running',
        execute: async (payload) => ({
            data: await removeRunningJobs(payload as never, deps.queueService, deps.redisConnectionService)
        })
    },
    {
        command: 'jobs.clear-history',
        execute: async (payload) => ({
            data: await clearJobsHistory(payload as never, deps.redisConnectionService)
        })
    }
];
