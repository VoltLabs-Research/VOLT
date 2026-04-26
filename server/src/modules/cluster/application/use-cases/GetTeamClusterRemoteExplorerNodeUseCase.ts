import {
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO
} from '@modules/cluster/application/dtos/GetTeamClusterRemoteExplorerNodeDTO';
import { preflightRemoteExplorerAccess } from '@modules/cluster/application/utilities/remote-explorer-access';
import RemoteExplorerDaemonGateway from '@modules/cluster/infrastructure/services/RemoteExplorerDaemonGateway';
import TeamClusterRemoteAccessSessionService from '@modules/cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';

@Singleton()
export default class GetTeamClusterRemoteExplorerNodeUseCase implements IUseCase<
    GetTeamClusterRemoteExplorerNodeInputDTO,
    GetTeamClusterRemoteExplorerNodeOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly sessionService: TeamClusterRemoteAccessSessionService,

        
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
