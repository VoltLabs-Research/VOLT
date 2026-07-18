import teamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import type {
    TeamClusterRemoteExplorerEntryDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/services/TeamClusterReverseChannelService';

interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
}

export class RemoteExplorerDaemonGateway {
        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

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

export default new RemoteExplorerDaemonGateway();
