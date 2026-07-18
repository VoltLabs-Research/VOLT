import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import type { ITeamClusterRemoteAccessSessionService } from '@modules/cluster/ports/ITeamClusterRemoteAccessSessionService';
import type { IRemoteExplorerDaemonGateway } from '@modules/cluster/ports/IRemoteExplorerDaemonGateway';
import {
    ListTeamClusterRemoteExplorerEntriesInputDTO,
    ListTeamClusterRemoteExplorerEntriesOutputDTO
} from '@modules/cluster/dtos/ListTeamClusterRemoteExplorerEntriesDTO';
import { preflightRemoteExplorerAccess } from '@modules/cluster/utilities/remote-explorer-access';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class ListTeamClusterRemoteExplorerEntriesUseCase implements IUseCase<ListTeamClusterRemoteExplorerEntriesInputDTO, ListTeamClusterRemoteExplorerEntriesOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService) private readonly sessionService: ITeamClusterRemoteAccessSessionService,
        @inject(CLUSTER_TOKENS.RemoteExplorerDaemonGateway) private readonly remoteExplorerDaemonGateway: IRemoteExplorerDaemonGateway
    ) {}

    async execute(
        input: ListTeamClusterRemoteExplorerEntriesInputDTO
    ): Promise<ListTeamClusterRemoteExplorerEntriesOutputDTO> {
        const preflight = await preflightRemoteExplorerAccess(
            this.teamClusterRepository,
            this.sessionService,
            input
        );
        if (preflight instanceof ApplicationError) {
            throw preflight;
        }

        try {
            const entries = await this.remoteExplorerDaemonGateway.listEntries({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            return {
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path,
                entries
            };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerListFailed',
                error instanceof Error ? error.message : 'Failed to load remote explorer entries'
            );
        }
    }
}
