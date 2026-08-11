import { ErrorCodes } from '@core/constants/error-codes';
import daemonAnalysisCompletionService from '@modules/cluster/services/daemon/DaemonAnalysisCompletionService';
import teamClusterInstallManifestService from '@modules/cluster/services/install-manifest/TeamClusterInstallManifestService';
import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import type {
    TeamClusterInstallManifestPortsView,
    TeamClusterInstallManifestView
} from '@modules/cluster/services/install-manifest/TeamClusterInstallManifest';
import type { TeamClusterView } from '@modules/cluster/services/team-cluster/TeamClusterView';
import type {
    ProcessDaemonJobCompletionInput,
    ProcessDaemonJobCompletionOutput
} from '@modules/cluster/contracts/daemon-job-completion';
import type {
    ClusterRuntimeDeleteCompletedCommand,
    ClusterRuntimeHeartbeatCommand,
    ClusterRuntimeLifecycleCommand
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';

export interface ProcessHealthcheckInput {
    teamClusterId: string;
    enrollmentToken: string;
    installedVersion?: string;
}

export interface GenerateInstallManifestInput {
    teamClusterId: string;
    daemonPassword: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPortsView;
}

/**
 * The RPC surface a cluster daemon calls on the control plane: enrollment,
 * heartbeat, lifecycle transitions and the job reports it produces. Each frame is
 * authenticated before it is routed to the service that owns the state it touches.
 */
class ClusterDaemonLifecycleService {
    async processHealthcheck(input: ProcessHealthcheckInput): Promise<{
        teamCluster: TeamClusterView;
        daemonPassword: string;
    }> {
        return teamClusterLifecycleService.processHealthcheck(
            input.teamClusterId,
            input.enrollmentToken,
            input.installedVersion
        );
    }

    async generateInstallManifest(input: GenerateInstallManifestInput): Promise<{
        manifest: TeamClusterInstallManifestView;
    }> {
        return {
            manifest: await teamClusterInstallManifestService.generateInstallManifest(
                input.teamClusterId,
                input.daemonPassword,
                input.installRoot,
                input.ports
            )
        };
    }

    async recordHeartbeat(input: ClusterRuntimeHeartbeatCommand): Promise<{ teamCluster: TeamClusterView }> {
        return {
            teamCluster: await teamClusterLifecycleService.recordHeartbeat({
                teamClusterId: input.teamClusterId,
                daemonPassword: input.daemonPassword,
                installedVersion: input.installedVersion,
                roleConfig: input.runtime?.roleConfig,
                metrics: input.metrics,
                hostCapabilities: input.hostCapabilities
            })
        };
    }

    async updateLifecycle(input: ClusterRuntimeLifecycleCommand): Promise<{ teamCluster: TeamClusterView }> {
        if (input.status === TeamClusterStatus.Connected) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_SOCKET_LIFECYCLE_ONLY, 'Connected status is managed by daemon socket registration');
        }

        if (input.status === TeamClusterStatus.WaitingForConnection) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_LIFECYCLE_STATUS_INVALID, 'Waiting-for-connection is managed by the control plane');
        }

        return {
            teamCluster: await teamClusterLifecycleService.updateLifecycleStatus(
                input.teamClusterId,
                input.daemonPassword,
                input.status,
                input.installedVersion
            )
        };
    }

    /** A cluster already gone from the control plane is an acceptable end state. */
    async completeDeletion(input: ClusterRuntimeDeleteCompletedCommand): Promise<{ success: boolean }> {
        try {
            await teamClusterLifecycleService.completeDeletion(input.teamClusterId, input.daemonPassword);
        } catch (error: unknown) {
            if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
                throw error;
            }
        }

        return { success: true };
    }

    async processDaemonJobCompletion(input: ProcessDaemonJobCompletionInput): Promise<ProcessDaemonJobCompletionOutput> {
        await teamClusterLifecycleService.authenticateDaemonConnection(input.teamClusterId, input.daemonPassword);

        switch (input.type) {
            case 'analysis-stage-status':
                await daemonAnalysisCompletionService.handleAnalysisStageStatus(input);
                break;

            case 'analysis-job-status':
                await daemonAnalysisCompletionService.handleAnalysisJobStatus(input);
                break;

            case 'analysis-job-completion':
                await daemonAnalysisCompletionService.handleJobCompletion(input);
                break;

            case 'trajectory-glb-job-status':
                await daemonAnalysisCompletionService.handleGlbJobStatus(input);
                break;

            case 'artifact-upload-job-status':
                await daemonAnalysisCompletionService.handleArtifactUploadJobStatus(input);
                break;

            case 'trajectory-raster-job-status':
                await daemonAnalysisCompletionService.handleRasterJobStatus(input);
                break;
        }

        return { acknowledged: true };
    }
}

export default new ClusterDaemonLifecycleService();
