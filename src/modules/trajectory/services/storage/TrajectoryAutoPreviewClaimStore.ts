import { singleton } from '@shared/application/utilities/singleton';
import { getRedisConnection } from '@shared/infrastructure/redis/RedisConnection';
import type { RedisConnection } from '@shared/infrastructure/redis/RedisConnection';

const AUTO_PREVIEW_CLAIM_TTL_SECONDS = 30 * 60;

const buildAutoPreviewRasterKey = (trajectoryId: string): string => {
    return `trajectory:${trajectoryId}:auto-preview-raster`;
};

export class TrajectoryAutoPreviewClaimStore {
    constructor(
        private readonly redisConnection: RedisConnection
    ) {
    }

    claimRasterization(trajectoryId: string): Promise<boolean> {
        return this.redisConnection.setKeyIfAbsent(
            buildAutoPreviewRasterKey(trajectoryId),
            new Date().toISOString(),
            AUTO_PREVIEW_CLAIM_TTL_SECONDS
        );
    }

    async releaseRasterization(trajectoryId: string): Promise<void> {
        await this.redisConnection.deleteKey(buildAutoPreviewRasterKey(trajectoryId));
    }
};

export const getTrajectoryAutoPreviewClaimStore = singleton((): TrajectoryAutoPreviewClaimStore => new TrajectoryAutoPreviewClaimStore(getRedisConnection()));
