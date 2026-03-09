import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterSocketModule from '@modules/team-cluster/socket/TeamClusterSocketModule';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterCredentialsCipher from '@modules/team-cluster/infrastructure/services/TeamClusterCredentialsCipher';
import TeamClusterInstallManifestService from '@modules/team-cluster/infrastructure/services/TeamClusterInstallManifestService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { container } from 'tsyringe';

export const registerTeamClusterDependencies = () => {
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterRepository, TeamClusterRepository);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher, TeamClusterCredentialsCipher);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterInstallManifestService, TeamClusterInstallManifestService);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService, TeamClusterLifecycleService);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterHeartbeatMonitor, TeamClusterHeartbeatMonitor);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService, TeamClusterReverseChannelService);
    container.registerSingleton(TEAM_CLUSTER_TOKENS.TeamClusterSocketModule, TeamClusterSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: TEAM_CLUSTER_TOKENS.TeamClusterSocketModule });
};
