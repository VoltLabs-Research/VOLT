import { TeamClusterRemoteAccessTargetDTO } from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

import type {
    TeamClusterRemoteExplorerEntryDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';

interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};

@injectable()
export default class RemoteExplorerDaemonGateway {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async listEntries(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerEntryDTO[]> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerEntryDTO[]>(
            request.teamClusterId,
            TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.list,
            this.createPayload(request)
        );
    }

    async getNode(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerNodeDTO> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerNodeDTO>(
            request.teamClusterId,
            TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.node,
            this.createPayload(request)
        );
    }

    async downloadObject(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        return this.teamClusterDaemonClient.commandResponseStream(
            request.teamClusterId,
            TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.download,
            this.createPayload(request)
        );
    }

    private createPayload(request: RemoteExplorerDaemonRequest): Record<string, string> {
        return {
            target: request.target,
            path: request.path
        };
    }
};
