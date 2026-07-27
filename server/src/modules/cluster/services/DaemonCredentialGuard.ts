import type { TeamCluster } from '@modules/cluster/models/TeamClusterModel';
import { findTeamClusterByIdWithSensitiveData } from '@modules/cluster/models/TeamClusterModel';
import TeamClusterCredentialService from '@modules/cluster/services/TeamClusterCredentialService';
import { hashEnrollmentToken } from '@modules/cluster/services/TeamClusterCredentialService';
import { secureCompare } from '@modules/cluster/services/TeamClusterCredentialService';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface DecryptedTeamClusterServiceCredentials {
    minioUsername: string;
    minioPassword: string;
    redisUsername: string;
    redisPassword: string;
    mongodbUsername: string;
    mongodbPassword: string;
    daemonPassword: string;
}

export default class DaemonCredentialGuard {
    private readonly teamClusterCredentialService = new TeamClusterCredentialService();

    async requireByDaemonPassword(teamClusterId: string, daemonPassword: string): Promise<TeamCluster> {
        const teamCluster = await this.requireSensitiveCluster(teamClusterId);
        const persistedDaemonPassword = this.requireEncryptedDaemonPassword(teamCluster);

        if (!secureCompare(await this.teamClusterCredentialService.decrypt(persistedDaemonPassword), daemonPassword)) {
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

    async getDecryptedDaemonPassword(teamCluster: TeamCluster): Promise<string> {
        return this.teamClusterCredentialService.decrypt(this.requireEncryptedDaemonPassword(teamCluster));
    }

    async getDecryptedServiceCredentials(teamCluster: TeamCluster): Promise<DecryptedTeamClusterServiceCredentials> {
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
            minioUsername: await this.teamClusterCredentialService.decrypt(minioUsername),
            minioPassword: await this.teamClusterCredentialService.decrypt(minioPassword),
            redisUsername: await this.teamClusterCredentialService.decrypt(redisUsername),
            redisPassword: await this.teamClusterCredentialService.decrypt(redisPassword),
            mongodbUsername: await this.teamClusterCredentialService.decrypt(mongodbUsername),
            mongodbPassword: await this.teamClusterCredentialService.decrypt(mongodbPassword),
            daemonPassword: await this.teamClusterCredentialService.decrypt(daemonPassword)
        };
    }

    private async requireSensitiveCluster(teamClusterId: string): Promise<TeamCluster> {
        const teamCluster = await findTeamClusterByIdWithSensitiveData(teamClusterId);
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
