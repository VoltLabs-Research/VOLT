import {
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO
} from '@modules/team-cluster/application/dtos/GetTeamClusterRemoteExplorerNodeDTO';
import { preflightRemoteExplorerAccess } from '@modules/team-cluster/application/utilities/remote-explorer-access';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import RemoteExplorerDaemonGateway from '@modules/team-cluster/infrastructure/services/RemoteExplorerDaemonGateway';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

@injectable()
export default class GetTeamClusterRemoteExplorerNodeUseCase implements IUseCase<
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService)
        private readonly sessionService: TeamClusterRemoteAccessSessionService,

        @inject(TEAM_CLUSTER_TOKENS.RemoteExplorerDaemonGateway)
        private readonly remoteExplorerDaemonGateway: RemoteExplorerDaemonGateway
    ) {}

    async execute(
        input: GetTeamClusterRemoteExplorerNodeInputDTO
    ): Promise<Result<GetTeamClusterRemoteExplorerNodeOutputDTO, ApplicationError>> {
        const preflight = await preflightRemoteExplorerAccess(
            this.teamClusterRepository,
            this.sessionService,
            input
        );
        if (preflight instanceof ApplicationError) {
            return Result.fail(preflight);
        }

        try {
            const node = await this.remoteExplorerDaemonGateway.getNode({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            return Result.ok({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                node
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerNodeFailed',
                error instanceof Error ? error.message : 'Failed to load remote explorer node'
            ));
        }
    }
}
