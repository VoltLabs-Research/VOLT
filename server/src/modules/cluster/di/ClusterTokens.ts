import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens/ClusterServiceTokens';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';

export const CLUSTER_TOKENS = Object.freeze({
    ClusterHttpService: Symbol.for('ClusterHttpService'),
    TeamClusterRepository: CLUSTER_SERVICE_TOKENS.TeamClusterRepository,
    ClusterTransferJobRepository: CLUSTER_SERVICE_TOKENS.ClusterTransferJobRepository,
    StoragePlacementRepository: CLUSTER_SERVICE_TOKENS.StoragePlacementRepository,
    ClusterTransferRunner: Symbol.for('ClusterTransferRunner'),
    DaemonAnalysisCompletionService: CLUSTER_SERVICE_TOKENS.DaemonAnalysisCompletionService,
    DemoClusterDeploymentService: Symbol.for('DemoClusterDeploymentService'),
    RemoteExplorerDaemonGateway: Symbol.for('RemoteExplorerDaemonGateway'),
    TeamClusterCredentialsCipher: Symbol.for('TeamClusterCredentialsCipher'),
    TeamClusterInstallManifestService: Symbol.for('TeamClusterInstallManifestService'),
    TeamClusterLifecycleService: Symbol.for('TeamClusterLifecycleService'),
    TeamClusterRemoteAccessSessionService: Symbol.for('TeamClusterRemoteAccessSessionService'),
    ClusterObjectArchiveService: CLUSTER_ACCESS_TOKENS.ClusterObjectArchiveService,
    ClusterObjectSignedUrlService: CLUSTER_ACCESS_TOKENS.ClusterObjectSignedUrlService,
    TeamClusterReverseChannelService: CLUSTER_SERVICE_TOKENS.TeamClusterReverseChannelService
});
