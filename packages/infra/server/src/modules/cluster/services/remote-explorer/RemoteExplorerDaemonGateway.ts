import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import {
    TeamClusterRemoteAccessTarget,
    type TeamClusterRemoteExplorerEntry,
    type TeamClusterRemoteExplorerNode
} from '@volt/contracts/modules/cluster/domain';

interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

class RemoteExplorerDaemonGateway {
    async listEntries(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerEntry[]> {
        return teamClusterDaemonClient.command<TeamClusterRemoteExplorerEntry[]>(
            request.teamClusterId,
            DaemonCommand.RemoteExplorerList,
            this.createPayload(request)
        );
    }

    async getNode(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterRemoteExplorerNode> {
        return teamClusterDaemonClient.command<TeamClusterRemoteExplorerNode>(
            request.teamClusterId,
            DaemonCommand.RemoteExplorerNode,
            this.createPayload(request)
        );
    }

    async downloadObject(
        request: RemoteExplorerDaemonRequest
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        return teamClusterDaemonClient.commandResponseStream(
            request.teamClusterId,
            DaemonCommand.RemoteExplorerDownload,
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
