import ConfiguredMinioStorageService from '@shared/infrastructure/services/ConfiguredMinioStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterServiceResolver from '@shared/infrastructure/services/TeamClusterServiceResolver';
import { inject, injectable } from 'tsyringe';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class TeamClusterStorageResolver {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterServiceResolver)
        private readonly teamClusterServiceResolver: TeamClusterServiceResolver
    ) {}

    async resolve(teamClusterId: string): Promise<IStorageService> {
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);

        return new ConfiguredMinioStorageService({
            endPoint: resolvedServices.minio.endPoint,
            port: resolvedServices.minio.port,
            useSSL: resolvedServices.minio.useSSL,
            accessKey: resolvedServices.minio.accessKey,
            secretKey: resolvedServices.minio.secretKey
        });
    }
};
