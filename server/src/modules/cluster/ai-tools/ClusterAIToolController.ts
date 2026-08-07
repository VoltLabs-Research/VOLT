import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import ClusterService from '@modules/cluster/services/ClusterService';
import clusterDaemonLifecycleService from '@modules/cluster/services/ClusterDaemonLifecycleService';
import clusterDemoService from '@modules/cluster/services/ClusterDemoService';
import clusterRemoteExplorerService from '@modules/cluster/services/ClusterRemoteExplorerService';
import clusterRuntimeSettingsService from '@modules/cluster/services/ClusterRuntimeSettingsService';
import type {
    ClusterRefInput,
    GenerateClusterInstallManifestInput,
    ListClusterTransferJobsInput,
    ListClustersInput,
    ListRemoteClusterFilesInput,
    ManageDemoClusterInput,
    RevealClusterCredentialsInput,
    UpdateClusterQueueConcurrencyInput,
    UpdateClusterRoleInput
} from '@volt/contracts/modules/cluster/ai-tools';

const MASKED = '••••••••';

@AIToolProvider()
export default class ClusterAIToolController extends AIToolController {
    #service = new ClusterService();

    @AITool({
        name: 'list_clusters',
        description: 'List the team compute clusters.',
        parameters: typia.llm.parameters<ListClustersInput>(),
        validate: typia.createValidate<ListClustersInput>()
    })
    async listClusters(input: ListClustersInput & AIToolScope) {
        // typia validates but does not transform, so the documented defaults are
        // applied here; an absent key does not override them on spread.
        const { total, data } = await this.#service.listByTeamId({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} clusters.`,
            data
        };
    }

    @AITool({
        name: 'get_cluster',
        description: 'Get detailed information about a specific cluster.',
        parameters: typia.llm.parameters<ClusterRefInput>(),
        validate: typia.createValidate<ClusterRefInput>()
    })
    async getCluster(input: ClusterRefInput & AIToolScope) {
        const { teamCluster } = await this.#service.getById(input);
        return {
            summary: `Cluster "${teamCluster.name}" is ${teamCluster.status}.`,
            data: teamCluster
        };
    }

    @AITool({
        name: 'get_cluster_health_summary',
        description: 'Summarize a cluster\'s health: connectivity status, installed version, heartbeat, capabilities, and live queue runtime.',
        parameters: typia.llm.parameters<ClusterRefInput>(),
        validate: typia.createValidate<ClusterRefInput>()
    })
    async getClusterHealthSummary(input: ClusterRefInput & AIToolScope) {
        const [{ teamCluster }, snapshot] = await Promise.all([
            this.#service.getById(input),
            clusterRuntimeSettingsService.getRuntimeSnapshot(input)
        ]);

        return {
            summary: `Cluster "${teamCluster.name}" is ${teamCluster.status} with ${snapshot.daemonQueues.length} live daemon queue(s).`,
            data: {
                teamClusterId: teamCluster._id,
                name: teamCluster.name,
                status: teamCluster.status,
                installedVersion: teamCluster.installedVersion,
                lastHeartbeatAt: teamCluster.lastHeartbeatAt,
                lastDisconnectAt: teamCluster.lastDisconnectAt,
                effectiveCapabilities: teamCluster.effectiveCapabilities,
                runtime: {
                    capturedAt: snapshot.capturedAt,
                    queueConcurrency: snapshot.queueConcurrency,
                    daemonQueues: snapshot.daemonQueues
                }
            }
        };
    }

    @AITool({
        name: 'get_cluster_resource_limits',
        description: 'Get the CPU and memory resource limits for a cluster.',
        parameters: typia.llm.parameters<ClusterRefInput>(),
        validate: typia.createValidate<ClusterRefInput>()
    })
    async getClusterResourceLimits(input: ClusterRefInput & AIToolScope) {
        const { resourceLimits } = await clusterRuntimeSettingsService.getResourceLimits(input);
        return {
            summary: `Cluster limits: ${resourceLimits.maxCpus ?? 'unknown'} CPUs, ${resourceLimits.maxMemoryMB ?? 'unknown'} MB.`,
            data: resourceLimits
        };
    }

    @AITool({
        name: 'get_cluster_runtime_snapshot',
        description: 'Get the live queue runtime snapshot for a cluster.',
        parameters: typia.llm.parameters<ClusterRefInput>(),
        validate: typia.createValidate<ClusterRefInput>()
    })
    async getClusterRuntimeSnapshot(input: ClusterRefInput & AIToolScope) {
        const snapshot = await clusterRuntimeSettingsService.getRuntimeSnapshot(input);
        return {
            summary: `Captured ${snapshot.daemonQueues.length} daemon queues at ${snapshot.capturedAt}.`,
            data: snapshot
        };
    }

    @AITool({
        name: 'list_cluster_transfer_jobs',
        description: 'List data transfer jobs for a cluster.',
        parameters: typia.llm.parameters<ListClusterTransferJobsInput>(),
        validate: typia.createValidate<ListClusterTransferJobsInput>()
    })
    async listClusterTransferJobs(input: ListClusterTransferJobsInput & AIToolScope) {
        const { total, data } = await this.#service.listTransferJobs({
            page: 1,
            limit: 50,
            ...input
        });
        return {
            summary: `Found ${total} transfer jobs.`,
            data
        };
    }

    @AITool({
        name: 'list_remote_cluster_files',
        description: 'List the entries at a path inside a cluster\'s remote storage target (the object store or daemon tables). Requires an active password-confirmed remote-access session id.',
        parameters: typia.llm.parameters<ListRemoteClusterFilesInput>(),
        validate: typia.createValidate<ListRemoteClusterFilesInput>()
    })
    async listRemoteClusterFiles(input: ListRemoteClusterFilesInput & AIToolScope) {
        const result = await clusterRemoteExplorerService.listRemoteExplorerEntries(input);
        return {
            summary: `Found ${result.entries.length} entr${result.entries.length === 1 ? 'y' : 'ies'} at "${result.path || '/'}" in ${result.target}.`,
            data: result
        };
    }

    @AITool({
        name: 'update_cluster_role',
        description: 'Update the desired role of a cluster.',
        parameters: typia.llm.parameters<UpdateClusterRoleInput>(),
        validate: typia.createValidate<UpdateClusterRoleInput>()
    })
    async updateClusterRole(input: UpdateClusterRoleInput & AIToolScope) {
        return clusterRuntimeSettingsService.updateRole(input);
    }

    @AITool({
        name: 'update_cluster_queue_concurrency',
        description: 'Update the queue concurrency and scope limits of a cluster.',
        parameters: typia.llm.parameters<UpdateClusterQueueConcurrencyInput>(),
        validate: typia.createValidate<UpdateClusterQueueConcurrencyInput>()
    })
    async updateClusterQueueConcurrency(input: UpdateClusterQueueConcurrencyInput & AIToolScope) {
        return clusterRuntimeSettingsService.updateQueueConcurrency(input);
    }

    @AITool({
        name: 'generate_cluster_install_manifest',
        description: 'Generate the Docker Compose enrollment install manifest (files + pinned images) a user runs on their machine to bring a cluster online.',
        parameters: typia.llm.parameters<GenerateClusterInstallManifestInput>(),
        validate: typia.createValidate<GenerateClusterInstallManifestInput>()
    })
    async generateClusterInstallManifest(input: GenerateClusterInstallManifestInput) {
        const { manifest } = await clusterDaemonLifecycleService.generateInstallManifest(input);
        return {
            summary: `Generated install manifest v${manifest.manifestVersion} (${manifest.files.length} files) for project "${manifest.composeProjectName}".`,
            data: manifest
        };
    }

    @AITool({
        name: 'regenerate_cluster_token',
        description: 'Rotate a cluster\'s enrollment token. Only valid while the cluster is waiting for connection or disconnected.',
        parameters: typia.llm.parameters<ClusterRefInput>(),
        validate: typia.createValidate<ClusterRefInput>(),
        needsApproval: true
    })
    async regenerateClusterToken(input: ClusterRefInput & AIToolScope) {
        const { enrollmentToken } = await this.#service.regenerateEnrollmentToken(input);
        return {
            summary: 'Cluster enrollment token regenerated.',
            data: { enrollmentToken }
        };
    }

    @AITool({
        name: 'reveal_cluster_credentials',
        description: 'Reveal which service credentials a cluster holds. Requires the requesting user\'s account password for confirmation. Secret values are NEVER returned in plaintext — only key names and masked references.',
        parameters: typia.llm.parameters<RevealClusterCredentialsInput>(),
        validate: typia.createValidate<RevealClusterCredentialsInput>(),
        needsApproval: true
    })
    async revealClusterCredentials(input: RevealClusterCredentialsInput & AIToolScope) {
        const { teamClusterId, services } = await this.#service.revealCredentials(input);

        return {
            summary: 'Cluster credentials confirmed for postgres and daemon (values masked).',
            data: {
                teamClusterId,
                credentialKeys: ['postgres.username', 'postgres.password', 'daemon.password'],
                services: {
                    postgres: {
                        port: services.postgres.port,
                        username: MASKED,
                        password: MASKED
                    },
                    daemon: {
                        port: services.daemon.port,
                        password: MASKED
                    }
                }
            }
        };
    }

    @AITool({
        name: 'manage_demo_cluster',
        description: 'Provision, check the status of, or delete the team\'s ephemeral demo cluster.',
        parameters: typia.llm.parameters<ManageDemoClusterInput>(),
        validate: typia.createValidate<ManageDemoClusterInput>(),
        needsApproval: (input) => input.action === 'delete'
    })
    async manageDemoCluster(input: ManageDemoClusterInput & AIToolScope) {
        if (input.action === 'provision') {
            const result = await clusterDemoService.provisionDemo(input);
            return {
                summary: `Demo cluster "${result.teamCluster.name}" provisioned.`,
                data: result
            };
        }

        if (input.action === 'delete') {
            const result = await clusterDemoService.deleteDemo(input);
            return {
                summary: result.teardownScheduled ? 'Demo cluster teardown scheduled.' : 'No active demo cluster to delete.',
                data: result
            };
        }

        const result = await clusterDemoService.getDemoStatus(input);
        return {
            summary: result.hasActiveDemo
                ? `Active demo cluster${result.remainingMs !== null ? ` (${Math.max(0, Math.round(result.remainingMs / 60000))} min remaining)` : ''}.`
                : 'No active demo cluster.',
            data: result
        };
    }
}
