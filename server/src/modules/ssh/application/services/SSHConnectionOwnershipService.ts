import { ErrorCodes } from '@core/constants/error-codes';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import SSHConnectionRepository from '@modules/ssh/infrastructure/persistence/mongo/repositories/SSHConnectionRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

enum SSHConnectionLoadMode {
    Plain = 'plain',
    WithCredentials = 'with-credentials'
}

@Singleton()
export class SSHConnectionOwnershipService {
    constructor(
        private readonly repository: SSHConnectionRepository
    ){}

    async getOwnedByTeam(sshConnectionId: string, teamId: string): Promise<Result<SSHConnection, ApplicationError>> {
        return this.getOwnedConnection(sshConnectionId, teamId, SSHConnectionLoadMode.Plain);
    }

    async getOwnedByTeamWithCredentials(sshConnectionId: string, teamId: string): Promise<Result<SSHConnection, ApplicationError>> {
        return this.getOwnedConnection(sshConnectionId, teamId, SSHConnectionLoadMode.WithCredentials);
    }

    private async getOwnedConnection(
        sshConnectionId: string,
        teamId: string,
        loadMode: SSHConnectionLoadMode
    ): Promise<Result<SSHConnection, ApplicationError>> {
        const sshConnection = loadMode === SSHConnectionLoadMode.WithCredentials
            ? await this.repository.findByIdWithCredentials(sshConnectionId)
            : await this.repository.findById(sshConnectionId);

        if (!sshConnection || sshConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        return Result.ok(sshConnection);
    }
}
