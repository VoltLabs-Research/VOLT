import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type {
    ResolvedTeamClusterMinioConnection,
    ResolvedTeamClusterRedisConnection,
    ResolvedTeamClusterServices
} from '@shared/infrastructure/contracts/team-cluster';

@injectable()
export default class TeamClusterServiceResolver {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher)
        private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher
    ) {}

    async resolve(teamClusterId: string): Promise<ResolvedTeamClusterServices> {
        const teamCluster = await this.teamClusterRepository.findByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        return {
            daemon: {
                teamClusterId: teamCluster.id
            },
            redis: await this.resolveRedisConnection(teamCluster),
            minio: await this.resolveMinioConnection(teamCluster),
            services: teamCluster.props.services
        };
    }

    private async resolveRedisConnection(teamCluster: TeamCluster): Promise<ResolvedTeamClusterRedisConnection> {
        const redis = teamCluster.props.services.redis;
        if (redis.port === null || !redis.username || !redis.password) {
            throw ApplicationError.conflict(
                'TeamCluster::RedisUnavailable',
                'Team cluster Redis connection is not ready yet'
            );
        }

        return {
            teamClusterId: teamCluster.id,
            host: this.resolveClusterHost(teamCluster.id),
            port: redis.port,
            username: await this.teamClusterCredentialsCipher.decrypt(redis.username),
            password: await this.teamClusterCredentialsCipher.decrypt(redis.password),
            db: 0
        };
    }

    private async resolveMinioConnection(teamCluster: TeamCluster): Promise<ResolvedTeamClusterMinioConnection> {
        const minio = teamCluster.props.services.minio;
        if (minio.port === null || !minio.username || !minio.password) {
            throw ApplicationError.conflict(
                'TeamCluster::MinioUnavailable',
                'Team cluster MinIO connection is not ready yet'
            );
        }

        return {
            teamClusterId: teamCluster.id,
            endPoint: this.resolveClusterHost(teamCluster.id),
            port: minio.port,
            useSSL: false,
            accessKey: await this.teamClusterCredentialsCipher.decrypt(minio.username),
            secretKey: await this.teamClusterCredentialsCipher.decrypt(minio.password)
        };
    }

    private resolveClusterHost(teamClusterId: string): string {
        const configuredHost = process.env.TEAM_CLUSTER_PUBLIC_HOST?.trim();
        if (configuredHost) {
            return configuredHost;
        }

        return `team-cluster-${teamClusterId}`;
    }
};
