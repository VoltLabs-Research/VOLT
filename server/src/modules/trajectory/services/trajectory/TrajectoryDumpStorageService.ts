import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { TeamClusterObjectGatewayStreamResponse } from '@shared/contracts/types';
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
    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    private get objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= objectGatewayClientSingleton);
    }

    private async requireStorageClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId })
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

export default new TrajectoryDumpStorageService();
