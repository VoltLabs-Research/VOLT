import { ErrorCodes } from '@core/constants/error-codes';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import type { ISSHConnectionRepository } from '@modules/ssh/domain/port/ISSHConnectionRepository';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

enum SSHConnectionLoadMode {
    Plain = 'plain',
    WithCredentials = 'with-credentials'
};

@injectable()
export class SSHConnectionOwnershipService {
    constructor(
        @inject(SSH_TOKENS.SSHConnectionRepository)
        private readonly repository: ISSHConnectionRepository
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
        let sshConnection: SSHConnection | null;

        if (loadMode === SSHConnectionLoadMode.WithCredentials) {
            sshConnection = await this.repository.findByIdWithCredentials(sshConnectionId);
        } else {
            sshConnection = await this.repository.findById(sshConnectionId);
        }

        if (!sshConnection || sshConnection.props.team !== teamId) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.SSH_CONNECTION_NOT_FOUND,
                'SSH connection not found'
            ));
        }

        return Result.ok(sshConnection);
    }
};
