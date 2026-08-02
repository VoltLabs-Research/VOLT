import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import { findTeamClusterByIdWithSensitiveData } from '@modules/cluster/contracts/team-cluster';
import { hashEnrollmentToken, secureCompare } from '@modules/cluster/services/TeamClusterCredentialService';
import { decrypt } from '@shared/infrastructure/utilities/crypto';
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
    async requireByDaemonPassword(teamClusterId: string, daemonPassword: string): Promise<TeamCluster> {
        const teamCluster = await this.requireSensitiveCluster(teamClusterId);
        const persistedDaemonPassword = this.requireEncryptedDaemonPassword(teamCluster);

        if (!secureCompare(await decrypt(persistedDaemonPassword), daemonPassword)) {
            throw ApplicationError.unauthorized(ErrorCodes.TEAM_CLUSTER_DAEMON_UNAUTHORIZED, 'Invalid daemon credentials');
        }

        return teamCluster;
    }

    async requireByEnrollment(teamClusterId: string, enrollmentToken: string): Promise<TeamCluster> {
        const teamCluster = await this.requireSensitiveCluster(teamClusterId);

        if (!teamCluster.props.enrollmentTokenHash) {
            throw ApplicationError.conflict(
                ErrorCodes.TEAM_CLUSTER_ENROLLMENT_ALREADY_COMPLETED,
                'Team cluster enrollment has already been completed'
            );
        }

        const hashedEnrollmentToken = hashEnrollmentToken(enrollmentToken);
        if (!secureCompare(teamCluster.props.enrollmentTokenHash, hashedEnrollmentToken)) {
            throw ApplicationError.unauthorized(
                ErrorCodes.TEAM_CLUSTER_ENROLLMENT_INVALID,
                'Invalid enrollment credentials'
            );
        }

        return teamCluster;
    }

    async getDecryptedDaemonPassword(teamCluster: TeamCluster): Promise<string> {
        return decrypt(this.requireEncryptedDaemonPassword(teamCluster));
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
            minioUsername: await decrypt(minioUsername),
            minioPassword: await decrypt(minioPassword),
            redisUsername: await decrypt(redisUsername),
            redisPassword: await decrypt(redisPassword),
            mongodbUsername: await decrypt(mongodbUsername),
            mongodbPassword: await decrypt(mongodbPassword),
            daemonPassword: await decrypt(daemonPassword)
        };
    }

    private async requireSensitiveCluster(teamClusterId: string): Promise<TeamCluster> {
        const teamCluster = await findTeamClusterByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
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
