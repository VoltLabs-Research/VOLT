import { createRedisClientConfig } from '@core/config/redis';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterServiceResolver from '@shared/infrastructure/services/TeamClusterServiceResolver';
import Redis from 'ioredis';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class TeamClusterRedisFactory {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterServiceResolver)
        private readonly teamClusterServiceResolver: TeamClusterServiceResolver
    ) {}

    async create(teamClusterId: string): Promise<Redis> {
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);

        return new Redis(createRedisClientConfig({
            host: resolvedServices.redis.host,
            port: resolvedServices.redis.port,
            username: resolvedServices.redis.username,
            password: resolvedServices.redis.password,
            db: resolvedServices.redis.db
        }));
    }
};
