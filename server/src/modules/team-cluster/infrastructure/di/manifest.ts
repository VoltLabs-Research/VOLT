import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import TeamClusterSocketModule from '@modules/team-cluster/socket/TeamClusterSocketModule';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterCredentialsCipher from '@modules/team-cluster/infrastructure/services/TeamClusterCredentialsCipher';
import TeamClusterExposureRegistryService from '@modules/team-cluster/infrastructure/services/TeamClusterExposureRegistryService';
import TeamClusterInstallManifestService from '@modules/team-cluster/infrastructure/services/TeamClusterInstallManifestService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterDirectAccessTokenService from '@modules/team-cluster/infrastructure/services/TeamClusterDirectAccessTokenService';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import RemoteExplorerDaemonGateway from '@modules/team-cluster/infrastructure/services/RemoteExplorerDaemonGateway';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import TeamClusterTcpExposureRelayService from '@modules/team-cluster/infrastructure/services/TeamClusterTcpExposureRelayService';
import VoltServerObjectGatewayService from '@modules/team-cluster/infrastructure/services/VoltServerObjectGatewayService';
import ClusterTransferRunner from '@modules/team-cluster/infrastructure/services/ClusterTransferRunner';
import DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import ClusterTransferCoordinator from '@modules/team-cluster/application/services/ClusterTransferCoordinator';
import CompleteTeamClusterDeletionUseCase from '@modules/team-cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import CreateTeamClusterRemoteAccessSessionUseCase from '@modules/team-cluster/application/use-cases/CreateTeamClusterRemoteAccessSessionUseCase';
import GetClusterResourceLimitsUseCase from '@modules/team-cluster/application/use-cases/GetClusterResourceLimitsUseCase';
import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import ProcessDaemonSceneArtifactUpsertUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonTrajectoryImportUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonTrajectoryImportUseCase';
import GetTeamClusterRemoteExplorerNodeUseCase from '@modules/team-cluster/application/use-cases/GetTeamClusterRemoteExplorerNodeUseCase';
import ListTeamClusterRemoteExplorerEntriesUseCase from '@modules/team-cluster/application/use-cases/ListTeamClusterRemoteExplorerEntriesUseCase';
import ProcessTeamClusterHealthcheckUseCase from '@modules/team-cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import RegenerateTeamClusterEnrollmentTokenUseCase from '@modules/team-cluster/application/use-cases/RegenerateTeamClusterEnrollmentTokenUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/team-cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import UpdateTeamClusterQueueConcurrencyUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterQueueConcurrencyUseCase';
import UpdateTeamClusterRoleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterRoleUseCase';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const teamClusterDIManifest: ModuleManifest = {
    name: 'team-cluster',
    singletons: [
        [TEAM_CLUSTER_TOKENS.TeamClusterRepository, TeamClusterRepository],
        [TEAM_CLUSTER_TOKENS.StoragePlacementRepository, StoragePlacementRepository],
        [TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository, ClusterTransferJobRepository],
        [TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher, TeamClusterCredentialsCipher],
        [TEAM_CLUSTER_TOKENS.TeamClusterInstallManifestService, TeamClusterInstallManifestService],
        [TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService, TeamClusterLifecycleService],
        [TEAM_CLUSTER_TOKENS.TeamClusterHeartbeatMonitor, TeamClusterHeartbeatMonitor],
        [TEAM_CLUSTER_TOKENS.TeamClusterExposureRegistryService, TeamClusterExposureRegistryService],
        TeamClusterDirectAccessTokenService,
        VoltServerObjectGatewayService,
        [TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService, TeamClusterReverseChannelService],
        [TEAM_CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService, TeamClusterRemoteAccessSessionService],
        [TEAM_CLUSTER_TOKENS.RemoteExplorerDaemonGateway, RemoteExplorerDaemonGateway],
        [TEAM_CLUSTER_TOKENS.TeamClusterTcpExposureRelayService, TeamClusterTcpExposureRelayService],
        [TEAM_CLUSTER_TOKENS.TeamClusterSocketModule, TeamClusterSocketModule],
        [TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService, DaemonAnalysisCompletionService],
        [TEAM_CLUSTER_TOKENS.StoragePlacementService, StoragePlacementService],
        [TEAM_CLUSTER_TOKENS.ClusterTransferCoordinator, ClusterTransferCoordinator],
        [TEAM_CLUSTER_TOKENS.ClusterTransferRunner, ClusterTransferRunner],
        CompleteTeamClusterDeletionUseCase,
        CreateTeamClusterRemoteAccessSessionUseCase,
        GetClusterResourceLimitsUseCase,
        GetTeamClusterRemoteExplorerNodeUseCase,
        ListTeamClusterRemoteExplorerEntriesUseCase,
        ProcessDaemonJobCompletionUseCase,
        ProcessDaemonSceneArtifactUpsertUseCase,
        ProcessDaemonTrajectoryImportUseCase,
        ProcessTeamClusterHealthcheckUseCase,
        RegenerateTeamClusterEnrollmentTokenUseCase,
        RecordTeamClusterHeartbeatUseCase,
        UpdateTeamClusterLifecycleUseCase,
        UpdateTeamClusterQueueConcurrencyUseCase,
        UpdateTeamClusterRoleUseCase
    ],
    aliases: [
        [SOCKET_TOKENS.SocketModule, TEAM_CLUSTER_TOKENS.TeamClusterSocketModule],
        [TeamClusterTcpExposureRelayService, TEAM_CLUSTER_TOKENS.TeamClusterTcpExposureRelayService]
    ]
};
