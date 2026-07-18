import type { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import type {
    TeamClusterRemoteExplorerEntryDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/contracts/TeamClusterReverseChannel';

export interface RemoteExplorerDaemonRequest {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
}

export interface IRemoteExplorerDaemonGateway {
    listEntries(request: RemoteExplorerDaemonRequest): Promise<TeamClusterRemoteExplorerEntryDTO[]>;
    getNode(request: RemoteExplorerDaemonRequest): Promise<TeamClusterRemoteExplorerNodeDTO>;
    downloadObject(request: RemoteExplorerDaemonRequest): Promise<TeamClusterReverseChannelStreamAttachment>;
}
