import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient, {
    type TeamClusterObjectGatewayStreamResponse
} from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { buildTrajectoryDumpObjectName } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { Singleton } from '@shared/infrastructure/di/decorators';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Readable } from 'node:stream';

export interface TrajectoryDumpStreamResponse {
    stream: Readable;
    objectName: string;
    contentLength?: number;
    contentEncoding?: string;
}

@Singleton()
export default class TrajectoryDumpStorageService implements ITrajectoryDumpStorageService {
    constructor(
        private readonly trajectoryRepo: TrajectoryRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    private async requireStorageClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (!storageClusterId) {
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                `Trajectory ${trajectoryId} does not have a storage cluster assigned`
            );
        }

        return storageClusterId;
    }

    getObjectName(trajectoryId: string, timestep: string): string {
        return buildTrajectoryDumpObjectName(trajectoryId, timestep);
    }

    getPrefix(trajectoryId: string): string {
        return `trajectory-${trajectoryId}/`;
    }

    async getDumpResponse(trajectoryId: string, timestep: string): Promise<TrajectoryDumpStreamResponse> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);

        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);
        const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);
        return this.toDumpStreamResponse(objectName, response);
    }

    async getDumpStream(trajectoryId: string, timestep: string): Promise<Readable> {
        const response = await this.getDumpResponse(trajectoryId, timestep);
        return response.stream;
    }

    async existsDump(trajectoryId: string, timestep: string): Promise<boolean> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

        return this.objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.DUMPS, objectName);
    }

    async listDumps(trajectoryId: string): Promise<string[]> {
        const storageClusterId = await this.requireStorageClusterId(trajectoryId);
        const prefix = this.getPrefix(trajectoryId);
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

    private toDumpStreamResponse(
        objectName: string,
        response: TeamClusterObjectGatewayStreamResponse
    ): TrajectoryDumpStreamResponse {
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
}
