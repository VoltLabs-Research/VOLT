import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import { findTeamClusterByIdWithSensitiveData } from '@modules/cluster/contracts/team-cluster';
import { hashEnrollmentToken, secureCompare } from '@modules/cluster/services/TeamClusterCredentialService';
import { decrypt } from '@shared/infrastructure/utilities/crypto';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

export interface DecryptedTeamClusterServiceCredentials {
    minioUsername: string;
    minioPassword: string;
    postgresUsername: string;
    postgresPassword: string;
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
        return this.#decryptOrFail(this.requireEncryptedDaemonPassword(teamCluster), teamCluster.id);
    }

    async getDecryptedServiceCredentials(teamCluster: TeamCluster): Promise<DecryptedTeamClusterServiceCredentials> {
        const minioUsername = teamCluster.props.services.minio.username;
        const minioPassword = teamCluster.props.services.minio.password;
        const postgresUsername = teamCluster.props.services.postgres.username;
        const postgresPassword = teamCluster.props.services.postgres.password;
        const daemonPassword = teamCluster.props.services.daemon.password;

        if (!minioUsername || !minioPassword || !postgresUsername || !postgresPassword || !daemonPassword) {
            throw ApplicationError.internalServerError(`Missing service credentials for team cluster ${teamCluster.id}`);
        }

        const [
            decryptedMinioUsername,
            decryptedMinioPassword,
            decryptedPostgresUsername,
            decryptedPostgresPassword,
            decryptedDaemonPassword
        ] = await Promise.all([
            this.#decryptOrFail(minioUsername, teamCluster.id),
            this.#decryptOrFail(minioPassword, teamCluster.id),
            this.#decryptOrFail(postgresUsername, teamCluster.id),
            this.#decryptOrFail(postgresPassword, teamCluster.id),
            this.#decryptOrFail(daemonPassword, teamCluster.id)
        ]);

        return {
            minioUsername: decryptedMinioUsername,
            minioPassword: decryptedMinioPassword,
            postgresUsername: decryptedPostgresUsername,
            postgresPassword: decryptedPostgresPassword,
            daemonPassword: decryptedDaemonPassword
        };
    }

    /**
     * Decrypts a stored credential, reporting a key mismatch as a recoverable
     * conflict rather than letting it surface as a 500.
     *
     * A cluster row can outlive the encryption key it was written with — the
     * database volume survives while `VOLT_SECRET_ENCRYPTION_KEY` is regenerated —
     * and AES-GCM then fails authentication. That is a state the caller can act on
     * (provision a fresh cluster), so it gets its own code instead of being
     * indistinguishable from a server defect.
     */
    async #decryptOrFail(value: string, teamClusterId: string): Promise<string> {
        try {
            return await decrypt(value);
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    teamClusterId
                },
                'Stored team cluster credentials could not be decrypted with the current encryption key'
            );

            throw ApplicationError.conflict(
                ErrorCodes.TEAM_CLUSTER_CREDENTIALS_UNREADABLE,
                'This cluster\'s stored credentials cannot be read with the current encryption key. Provision a new cluster.'
            );
        }
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
