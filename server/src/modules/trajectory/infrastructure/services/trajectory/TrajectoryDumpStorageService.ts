import { SYS_BUCKETS } from '@core/config/minio';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import {
    buildTrajectoryDumpObjectName,
    createZstdDecompressionStream
} from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Readable } from 'node:stream';
import { inject } from 'tsyringe';

@Singleton()
export default class TrajectoryDumpStorageService implements ITrajectoryDumpStorageService {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,


        private readonly trajectoryRepo: TrajectoryRepository,


        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    getObjectName(trajectoryId: string, timestep: string): string {
        return buildTrajectoryDumpObjectName(trajectoryId, timestep);
    }

    getPrefix(trajectoryId: string): string {
        return `trajectory-${trajectoryId}/`;
    }

    async getDumpStream(trajectoryId: string, timestep: string): Promise<Readable> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

        if (storageClusterId) {
            const response = await this.objectGatewayClient.getStream(storageClusterId, SYS_BUCKETS.DUMPS, objectName);
            const decompressed = createZstdDecompressionStream(response.stream);
            return decompressed.stream;
        }

        const remoteStream = await this.storageService.getStream(SYS_BUCKETS.DUMPS, objectName);
        const decompressed = createZstdDecompressionStream(remoteStream);
        return decompressed.stream;
    }

    async existsDump(trajectoryId: string, timestep: string): Promise<boolean> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

        return storageClusterId
            ? this.objectGatewayClient.exists(storageClusterId, SYS_BUCKETS.DUMPS, objectName)
            : this.storageService.exists(SYS_BUCKETS.DUMPS, objectName);
    }

    async listDumps(trajectoryId: string): Promise<string[]> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        const prefix = this.getPrefix(trajectoryId);
        const timesteps = new Set<string>();
        const source = storageClusterId
            ? this.objectGatewayClient.listAll(storageClusterId, {
                bucket: SYS_BUCKETS.DUMPS,
                prefix
            })
            : this.storageService.listByPrefix(SYS_BUCKETS.DUMPS, prefix);

        for await (const name of source) {
            const match = name.match(/timestep-(\d+)\.dump\.zst$/);
            if (!match) continue;
            timesteps.add(match[1]);
        }

        return Array.from(timesteps).sort((a, b) => Number(a) - Number(b));
    }
}
