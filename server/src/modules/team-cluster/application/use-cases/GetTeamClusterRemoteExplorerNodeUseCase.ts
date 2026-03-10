import {
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO
} from '@modules/team-cluster/application/dtos/GetTeamClusterRemoteExplorerNodeDTO';
import { TeamClusterRemoteAccessTargetDTO, type TeamClusterRemoteExplorerNodeDTO } from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

const isExplorerTarget = (target: TeamClusterRemoteAccessTargetDTO): boolean => {
    return target !== TeamClusterRemoteAccessTargetDTO.HostTerminal;
};

@injectable()
export default class GetTeamClusterRemoteExplorerNodeUseCase implements IUseCase<
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TeamClusterRemoteAccessSessionService)
        private readonly sessionService: TeamClusterRemoteAccessSessionService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(
        input: GetTeamClusterRemoteExplorerNodeInputDTO
    ): Promise<Result<GetTeamClusterRemoteExplorerNodeOutputDTO, ApplicationError>> {
        if (!isExplorerTarget(input.target)) {
            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerUnsupportedTarget',
                'The selected remote target does not support explorer navigation'
            ));
        }

        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster || teamCluster.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found'
            ));
        }

        const sessionResult = this.sessionService.validateSession({
            sessionId: input.sessionId,
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });
        if (sessionResult instanceof Error) {
            return Result.fail(sessionResult);
        }

        try {
            const node = await this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerNodeDTO>(
                input.teamClusterId,
                'remote.explorer.node',
                {
                    target: input.target,
                    path: input.path
                }
            );

            return Result.ok({
                teamClusterId: input.teamClusterId,
                target: input.target,
                node
            });
        } catch (error: unknown) {
            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::RemoteExplorerNodeFailed',
                error instanceof Error ? error.message : 'Failed to load remote explorer node'
            ));
        }
    }
}
