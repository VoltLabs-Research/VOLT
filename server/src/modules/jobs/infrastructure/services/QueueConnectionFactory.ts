import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { createQueueConnectionFromRedisClient } from '@modules/jobs/infrastructure/services/redis-queue-connection';
import Redis from 'ioredis';
import { inject, injectable } from 'tsyringe';
import type TeamClusterRedisFactory from '@shared/infrastructure/services/TeamClusterRedisFactory';
import type { ConnectionOptions } from 'bullmq';

export enum QueueExecutionTarget {
    Cloud = 'cloud',
    TeamCluster = 'team-cluster'
};

export interface QueueConnectionContext {
    target: QueueExecutionTarget;
    teamClusterId?: string;
};

export interface QueueConnectionBundle {
    redisClient: Redis;
    connection: ConnectionOptions;
};

@injectable()
export default class QueueConnectionFactory {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly cloudRedisClient: Redis,

        @inject(SHARED_TOKENS.TeamClusterRedisFactory)
        private readonly teamClusterRedisFactory: TeamClusterRedisFactory
    ) {}

    async create(context: QueueConnectionContext): Promise<QueueConnectionBundle> {
        if (context.target === QueueExecutionTarget.Cloud) {
            return {
                redisClient: this.cloudRedisClient,
                connection: createQueueConnectionFromRedisClient(this.cloudRedisClient)
            };
        }

        if (!context.teamClusterId) {
            throw new Error('teamClusterId is required for team-cluster queue connections');
        }

        const redisClient = await this.teamClusterRedisFactory.create(context.teamClusterId);

        return {
            redisClient,
            connection: createQueueConnectionFromRedisClient(redisClient)
        };
    }

};
