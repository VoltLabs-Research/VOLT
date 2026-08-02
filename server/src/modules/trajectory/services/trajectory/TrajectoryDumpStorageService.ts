import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import objectGatewayClientSingleton from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Readable } from 'node:stream';

interface TrajectoryDumpStreamResponse {
    stream: Readable;
    objectName: string;
    contentLength?: number;
    contentEncoding?: string;
}

export class TrajectoryDumpStorageService {
    private readonly objectGatewayClient = objectGatewayClientSingleton;

    private async requireStorageClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_STORAGE_CLUSTER_REQUIRED,
                `Trajectory ${trajectoryId} does not have a storage cluster assigned`
            );
        }

        return trajectory.storageClusterId;
    }

    async getDumpResponse(trajectoryId: string, timestep: string): Promise<TrajectoryDumpStreamResponse> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);
        const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);

        return {
            stream: response.stream,
            objectName,
            contentLength: response.contentLength,
            contentEncoding: response.contentEncoding || (
                objectName.endsWith('.zst')
                    ? 'zstd'
                    : undefined
            )
        };
    }

    async existsDump(trajectoryId: string, timestep: string): Promise<boolean> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

        return this.objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);
    }

    async listDumps(trajectoryId: string): Promise<string[]> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);
        const prefix = `trajectory-${trajectoryId}/`;
        const timesteps = new Set<string>();
        const source = this.objectGatewayClient.listAll(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.DUMPS,
            prefix
        });

        for await (const name of source) {
            const match = name.match(/timestep-(\d+)\.dump\.zst$/);
            if (!match) continue;
            timesteps.add(match[1]);
        }

        return Array.from(timesteps).sort((a, b) => Number(a) - Number(b));
    }
}

export default new TrajectoryDumpStorageService();
