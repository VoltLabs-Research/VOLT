import type { RedisConnectionService } from '@/modules/platform/services';

const AUTO_PREVIEW_CLAIM_TTL_SECONDS = 30 * 60;

const buildAutoPreviewRasterKey = (trajectoryId: string): string => {
    return `trajectory:${trajectoryId}:auto-preview-raster`;
};

export class TrajectoryAutoPreviewClaimStore {
    constructor(
        private readonly redisConnectionService: RedisConnectionService
    ) {
    }

    async claimRasterization(trajectoryId: string): Promise<boolean> {
        return this.redisConnectionService.setKeyIfAbsent(
            buildAutoPreviewRasterKey(trajectoryId),
            new Date().toISOString(),
            AUTO_PREVIEW_CLAIM_TTL_SECONDS
        );
    }

    async releaseRasterization(trajectoryId: string): Promise<void> {
        await this.redisConnectionService.deleteKey(buildAutoPreviewRasterKey(trajectoryId));
    }
};
