import { injectable, inject } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import IORedis from 'ioredis';
import type { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';

@injectable()
export default class RedisJobRepository implements IJobRepository {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    async removeFromTeamJobs(teamId: string, jobIds: string[]): Promise<void> {
        if (jobIds.length === 0) return;
        await this.redis.srem(`team:${teamId}:jobs`, ...jobIds);
    }

    async deleteTeamJobs(teamId: string): Promise<void> {
        await this.redis.del(`team:${teamId}:jobs`);
    }

    async getTeamJobIds(teamId: string): Promise<string[]> {
        return await this.redis.smembers(`team:${teamId}:jobs`);
    }

    async getJobStatus(statusKey: string): Promise<Record<string, unknown> | null> {
        const data = await this.redis.get(statusKey);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    async getJobStatuses(statusKeys: string[]): Promise<Array<Record<string, unknown> | null>> {
        if (statusKeys.length === 0) {
            return [];
        }

        const results = await this.redis.mget(statusKeys);

        return results.map((entry) => {
            if (!entry) {
                return null;
            }

            try {
                const parsedEntry = JSON.parse(entry);

                if (typeof parsedEntry !== 'object' || parsedEntry === null || Array.isArray(parsedEntry)) {
                    return null;
                }

                return parsedEntry;
            } catch {
                return null;
            }
        });
    }
};
