import type { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type {
    TeamClusterRemoteExplorerEntryDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/cluster/infrastructure/services/TeamClusterReverseChannelService';

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
