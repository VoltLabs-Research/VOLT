import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterRemoteAccessSessionService } from '@modules/cluster/domain/port/ITeamClusterRemoteAccessSessionService';
import type { IRemoteExplorerDaemonGateway } from '@modules/cluster/domain/port/IRemoteExplorerDaemonGateway';
import {
    ListTeamClusterRemoteExplorerEntriesInputDTO,
    ListTeamClusterRemoteExplorerEntriesOutputDTO
} from '@modules/cluster/application/dtos/ListTeamClusterRemoteExplorerEntriesDTO';
import { preflightRemoteExplorerAccess } from '@modules/cluster/application/utilities/remote-explorer-access';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class ListTeamClusterRemoteExplorerEntriesUseCase implements IUseCase<
    ListTeamClusterRemoteExplorerEntriesInputDTO,
    ListTeamClusterRemoteExplorerEntriesOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService) private readonly sessionService: ITeamClusterRemoteAccessSessionService,
        @inject(CLUSTER_TOKENS.RemoteExplorerDaemonGateway) private readonly remoteExplorerDaemonGateway: IRemoteExplorerDaemonGateway
    ) {}

    async execute(
        input: ListTeamClusterRemoteExplorerEntriesInputDTO
    ): Promise<Result<ListTeamClusterRemoteExplorerEntriesOutputDTO, ApplicationError>> {
        const preflight = await preflightRemoteExplorerAccess(
            this.teamClusterRepository,
            this.sessionService,
            input
        );
        if (preflight instanceof ApplicationError) {
            return Result.fail(preflight);
        }

        try {
            const entries = await this.remoteExplorerDaemonGateway.listEntries({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            return Result.ok({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path,
                entries
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerListFailed',
                error instanceof Error ? error.message : 'Failed to load remote explorer entries'
            ));
        }
    }
}
