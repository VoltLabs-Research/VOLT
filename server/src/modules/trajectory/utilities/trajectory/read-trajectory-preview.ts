import { SYS_BUCKETS } from '@core/config/minio';
import { getTrajectoryRasterPreviewsPrefix } from '@modules/raster/utilities/raster-storage-paths';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import type { IStorageService } from '@shared/domain/port/IStorageService';

type PreviewOutputFactory = (
    buffer: Buffer
) => GetTrajectoryPreviewOutputDTO | Promise<GetTrajectoryPreviewOutputDTO>;

interface ReadTrajectoryPreviewInput {
    trajectoryId: string;
    storageClusterId?: string | null;
    storageService: IStorageService;
    objectGatewayClient: TeamClusterObjectGatewayClient;
    createOutput: PreviewOutputFactory;
}

const firstSortedPreviewKey = async (
    objectGatewayClient: TeamClusterObjectGatewayClient,
    teamClusterId: string,
    trajectoryId: string
): Promise<string | null> => {
    const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);
    const keys: string[] = [];

    for await (const key of objectGatewayClient.listAll(teamClusterId, {
        bucket: SYS_BUCKETS.RASTERIZER,
        prefix
    })) {
        if (key.endsWith('.png')) {
            keys.push(key);
        }
    }

    return keys.sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0] ?? null;
};

const readRemotePreview = async (
    input: ReadTrajectoryPreviewInput,
    teamClusterId: string
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
    const previewKey = await firstSortedPreviewKey(
        input.objectGatewayClient,
        teamClusterId,
        input.trajectoryId
    );

    if (!previewKey) {
        return null;
    }

    const buffer = await input.objectGatewayClient.getBuffer(
        teamClusterId,
        SYS_BUCKETS.RASTERIZER,
        previewKey
    );

    return input.createOutput(buffer);
};

const readLocalPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
    const prefix = getTrajectoryRasterPreviewsPrefix(input.trajectoryId);

    for await (const key of input.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
        if (!key.endsWith('.png')) {
            continue;
        }

        try {
            const buffer = await input.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, key);
            return await input.createOutput(buffer);
        } catch {
            continue;
        }
    }

    return null;
};

export const readTrajectoryPreview = async (
    input: ReadTrajectoryPreviewInput
): Promise<GetTrajectoryPreviewOutputDTO | null> => {
    if (input.storageClusterId) {
        return readRemotePreview(input, input.storageClusterId);
    }

    return readLocalPreview(input);
};
