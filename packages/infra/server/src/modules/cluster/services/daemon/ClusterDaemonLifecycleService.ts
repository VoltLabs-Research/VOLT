import { ErrorCodes } from '@core/constants/error-codes';
import daemonAnalysisCompletionService from '@modules/cluster/services/daemon/DaemonAnalysisCompletionService';
import teamClusterInstallManifestService from '@modules/cluster/services/install-manifest/TeamClusterInstallManifestService';
import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import type {
    TeamClusterInstallManifestPortsView,
    TeamClusterInstallManifestView
} from '@modules/cluster/services/install-manifest/TeamClusterInstallManifest';
import type { TeamClusterView } from '@modules/cluster/services/team-cluster/TeamClusterView';
import type { ProcessDaemonJobCompletionOutput } from '@modules/cluster/contracts/daemon-job-completion';
import ApplicationError from '@shared/errors/ApplicationError';
import eventBus from '@shared/events/PostgresEventBus';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { PLUGIN_PROGRESS_TEXT_MAX_LENGTH } from '@volt/contracts/modules/plugin/progress';
import type {
    TeamClusterDaemonDeleteCompletedCommand,
    TeamClusterDaemonHeartbeatCommand,
    TeamClusterDaemonLifecycleCommand
} from '@voltstack/daemon-cluster-client';
import type { AnalysisJobProgressEvent, DaemonJobEvent } from '@volt/contracts/modules/cluster/daemon-events';

const TEAM_CLUSTER_STATUSES = new Set<string>(Object.values(TeamClusterStatus));

const isTeamClusterStatus = (status: string): status is TeamClusterStatus => TEAM_CLUSTER_STATUSES.has(status);

const isFraction = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

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

    async recordHeartbeat(input: TeamClusterDaemonHeartbeatCommand): Promise<{ teamCluster: TeamClusterView }> {
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

    async updateLifecycle(input: TeamClusterDaemonLifecycleCommand): Promise<{ teamCluster: TeamClusterView }> {
        if (!isTeamClusterStatus(input.status)) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_CLUSTER_LIFECYCLE_STATUS_INVALID, `Unknown lifecycle status: ${input.status}`);
        }

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

    async completeDeletion(input: TeamClusterDaemonDeleteCompletedCommand): Promise<{ success: boolean }> {
        try {
            await teamClusterLifecycleService.completeDeletion(input.teamClusterId, input.daemonPassword);
        } catch (error: unknown) {
            if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
                throw error;
            }
        }

        return { success: true };
    }

    async processDaemonJobCompletion(input: DaemonJobEvent): Promise<ProcessDaemonJobCompletionOutput> {
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

    /*
     * A plugin's progress comes every second for every running job, so it is not given a password
     * check and two lookups each time: a socket registered to the reporting cluster is already that
     * cluster, and the job's snapshot it is merged into is checked to be that cluster's running job.
     */
    async processDaemonJobProgress(input: AnalysisJobProgressEvent, fromRegisteredSocket: boolean): Promise<void> {
        if (!fromRegisteredSocket) {
            await teamClusterLifecycleService.authenticateDaemonConnection(input.teamClusterId, input.daemonPassword);
        }

        await eventBus.emit('job.progress.changed', {
            jobId: input.jobId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            analysisId: input.analysisId,
            ...(isFraction(input.progress) ? { progress: input.progress } : {}),
            ...(typeof input.progressText === 'string' && input.progressText ? { progressText: input.progressText.slice(0, PLUGIN_PROGRESS_TEXT_MAX_LENGTH) } : {})
        });
    }
}

export default new ClusterDaemonLifecycleService();
