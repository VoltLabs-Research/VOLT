import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { TeamClusterRemoteAccessTarget } from '@modules/cluster/services/team-cluster/TeamClusterRemoteAccess';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import type {
    TeamClusterRemoteExplorerEntryView,
    TeamClusterRemoteExplorerNodeView
} from '@modules/cluster/services/team-cluster/TeamClusterRemoteAccess';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';

interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

class RemoteExplorerDaemonGateway {
        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    async listEntries(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerEntryView[]> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerEntryView[]>(
            request.teamClusterId,
            ChannelCommands.RemoteExplorerList,
            this.createPayload(request)
        );
    }

    async getNode(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerNodeView> {
        return this.teamClusterDaemonClient.command<TeamClusterRemoteExplorerNodeView>(
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
