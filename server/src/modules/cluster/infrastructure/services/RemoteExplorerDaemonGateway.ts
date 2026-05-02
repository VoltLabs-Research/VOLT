import { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type {
    TeamClusterRemoteExplorerEntryDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/infrastructure/services/TeamClusterReverseChannelService';

interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
}

@Singleton()
export default class RemoteExplorerDaemonGateway {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async listEntries(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerEntryDTO[]> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerEntryDTO[]>(
            request.teamClusterId,
            ChannelCommands.RemoteExplorerList,
            this.createPayload(request)
        );
    }

    async getNode(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerNodeDTO> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerNodeDTO>(
            request.teamClusterId,
            ChannelCommands.RemoteExplorerNode,
            this.createPayload(request)
        );
    }

    async downloadObject(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        return this.teamClusterDaemonClient.commandResponseStream(
            request.teamClusterId,
            ChannelCommands.RemoteExplorerDownload,
            this.createPayload(request)
        );
    }

    private createPayload(request: RemoteExplorerDaemonRequest): Record<string, string> {
        return {
            target: request.target,
            path: request.path
        };
    }
}
