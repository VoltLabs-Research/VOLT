import TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { hashEnrollmentToken } from '@modules/team-cluster/utilities/enrollmentToken';
import { secureCompare } from '@modules/team-cluster/utilities/secureCompare';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';

export interface DecryptedTeamClusterServiceCredentials {
    minioUsername: string;
    minioPassword: string;
    redisUsername: string;
    redisPassword: string;
    mongodbUsername: string;
    mongodbPassword: string;
    daemonPassword: string;
}

@injectable()
export default class DaemonCredentialGuard {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher)
        private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher
    ) {}

    async requireByDaemonPassword(teamClusterId: string, daemonPassword: string): Promise<TeamCluster> {
        const teamCluster = await this.requireSensitiveCluster(teamClusterId);
        const persistedDaemonPassword = this.requireEncryptedDaemonPassword(teamCluster);

        if (!secureCompare(this.teamClusterCredentialsCipher.decrypt(persistedDaemonPassword), daemonPassword)) {
            throw ApplicationError.unauthorized('TeamCluster::DaemonUnauthorized', 'Invalid daemon credentials');
        }

        return teamCluster;
    }

    async requireByEnrollment(teamClusterId: string, enrollmentToken: string): Promise<TeamCluster> {
        const teamCluster = await this.requireSensitiveCluster(teamClusterId);

        if (!teamCluster.props.enrollmentTokenHash) {
            throw ApplicationError.conflict(
                'TeamCluster::EnrollmentAlreadyCompleted',
                'Team cluster enrollment has already been completed'
            );
        }

        const hashedEnrollmentToken = hashEnrollmentToken(enrollmentToken);
        if (!secureCompare(teamCluster.props.enrollmentTokenHash, hashedEnrollmentToken)) {
            throw ApplicationError.unauthorized(
                'TeamCluster::EnrollmentInvalid',
                'Invalid enrollment credentials'
            );
        }

        return teamCluster;
    }

    getDecryptedDaemonPassword(teamCluster: TeamCluster): string {
        return this.teamClusterCredentialsCipher.decrypt(this.requireEncryptedDaemonPassword(teamCluster));
    }

    getDecryptedServiceCredentials(teamCluster: TeamCluster): DecryptedTeamClusterServiceCredentials {
        const minioUsername = teamCluster.props.services.minio.username;
        const minioPassword = teamCluster.props.services.minio.password;
        const redisUsername = teamCluster.props.services.redis.username;
        const redisPassword = teamCluster.props.services.redis.password;
        const mongodbUsername = teamCluster.props.services.mongodb.username;
        const mongodbPassword = teamCluster.props.services.mongodb.password;
        const daemonPassword = teamCluster.props.services.daemon.password;

        if (!minioUsername || !minioPassword || !redisUsername || !redisPassword || !mongodbUsername || !mongodbPassword || !daemonPassword) {
            throw ApplicationError.internalServerError(`Missing service credentials for team cluster ${teamCluster.id}`);
        }

        return {
            minioUsername: this.teamClusterCredentialsCipher.decrypt(minioUsername),
            minioPassword: this.teamClusterCredentialsCipher.decrypt(minioPassword),
            redisUsername: this.teamClusterCredentialsCipher.decrypt(redisUsername),
            redisPassword: this.teamClusterCredentialsCipher.decrypt(redisPassword),
            mongodbUsername: this.teamClusterCredentialsCipher.decrypt(mongodbUsername),
            mongodbPassword: this.teamClusterCredentialsCipher.decrypt(mongodbPassword),
            daemonPassword: this.teamClusterCredentialsCipher.decrypt(daemonPassword)
        };
    }

    private async requireSensitiveCluster(teamClusterId: string): Promise<TeamCluster> {
        const teamCluster = await this.teamClusterRepository.findByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        return teamCluster;
    }

    private requireEncryptedDaemonPassword(teamCluster: TeamCluster): string {
        const daemonPassword = teamCluster.props.services.daemon.password;
        if (!daemonPassword) {
            throw ApplicationError.internalServerError(`Missing daemon password for team cluster ${teamCluster.id}`);
        }

        return daemonPassword;
    }
}
