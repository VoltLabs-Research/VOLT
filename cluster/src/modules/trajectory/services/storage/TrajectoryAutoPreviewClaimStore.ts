import { singleton } from '@shared/application/utilities/singleton';
import { getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';

const AUTO_PREVIEW_CLAIM_TTL_SECONDS = 30 * 60;

const buildAutoPreviewRasterKey = (trajectoryId: string): string => {
    return `trajectory:${trajectoryId}:auto-preview-raster`;
};

export class TrajectoryAutoPreviewClaimStore {
    constructor(
        private readonly stateStore: DaemonStateStore
    ) {
    }

    claimRasterization(trajectoryId: string): Promise<boolean> {
        return this.stateStore.setKeyIfAbsent(
            buildAutoPreviewRasterKey(trajectoryId),
            new Date().toISOString(),
            AUTO_PREVIEW_CLAIM_TTL_SECONDS
        );
    }

    async releaseRasterization(trajectoryId: string): Promise<void> {
        await this.stateStore.deleteKey(buildAutoPreviewRasterKey(trajectoryId));
    }
};

export const getTrajectoryAutoPreviewClaimStore = singleton((): TrajectoryAutoPreviewClaimStore => new TrajectoryAutoPreviewClaimStore(getDaemonStateStore()));
