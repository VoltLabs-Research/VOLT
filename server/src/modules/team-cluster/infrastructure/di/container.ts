import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterSocketModule from '@modules/team-cluster/socket/TeamClusterSocketModule';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterCredentialsCipher from '@modules/team-cluster/infrastructure/services/TeamClusterCredentialsCipher';
import TeamClusterInstallManifestService from '@modules/team-cluster/infrastructure/services/TeamClusterInstallManifestService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import CompleteTeamClusterDeletionUseCase from '@modules/team-cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import ProcessDaemonSceneArtifactUpsertUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonTrajectoryImportUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonTrajectoryImportUseCase';
import ProcessTeamClusterHealthcheckUseCase from '@modules/team-cluster/application/use-cases/ProcessTeamClusterHealthcheckUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/team-cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerTeamClusterDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [TEAM_CLUSTER_TOKENS.TeamClusterRepository, TeamClusterRepository],
            [TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher, TeamClusterCredentialsCipher],
            [TEAM_CLUSTER_TOKENS.TeamClusterInstallManifestService, TeamClusterInstallManifestService],
            [TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService, TeamClusterLifecycleService],
            [TEAM_CLUSTER_TOKENS.TeamClusterHeartbeatMonitor, TeamClusterHeartbeatMonitor],
            [TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService, TeamClusterReverseChannelService],
            [TEAM_CLUSTER_TOKENS.TeamClusterSocketModule, TeamClusterSocketModule],
            [TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService, DaemonAnalysisCompletionService],
            CompleteTeamClusterDeletionUseCase,
            ProcessDaemonJobCompletionUseCase,
            ProcessDaemonSceneArtifactUpsertUseCase,
            ProcessDaemonTrajectoryImportUseCase,
            ProcessTeamClusterHealthcheckUseCase,
            RecordTeamClusterHeartbeatUseCase,
            UpdateTeamClusterLifecycleUseCase
        ],
        aliases: [[SOCKET_TOKENS.SocketModule, TEAM_CLUSTER_TOKENS.TeamClusterSocketModule]]
    });
};
