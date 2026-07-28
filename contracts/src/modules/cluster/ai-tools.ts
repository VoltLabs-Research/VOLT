import { z } from 'zod';
import { TeamClusterRemoteAccessTarget } from './domain';
import type { ClusterTransferJobState, TeamClusterRole } from './domain';

const clusterRoles = ['cluster', 'storage-server', 'compute-node'] as const satisfies readonly TeamClusterRole[];

const transferJobStates = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning',
    'completed',
    'failed',
    'cancelled'
] as const satisfies readonly ClusterTransferJobState[];

const queueScopeLimit = z.object({ maxRunningPerTrajectory: z.number() });

export const clusterRefSchema = z.object({ teamClusterId: z.string() });

export const listClustersSchema = z.object({
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    search: z.string().optional()
});

export const listClusterTransferJobsSchema = z.object({
    teamClusterId: z.string(),
    page: z.number().optional().default(1),
    limit: z.number().optional().default(50),
    state: z.enum(transferJobStates).optional()
});

export const listRemoteClusterFilesSchema = z.object({
    teamClusterId: z.string(),
    sessionId: z.string().describe('An active remote-access session id, obtained after password confirmation for the chosen storage target.'),
    target: z.nativeEnum(TeamClusterRemoteAccessTarget).describe('The remote storage target to browse: minio, mongo-documents, or redis-data.'),
    path: z.string().describe('The path within the target to list. Use an empty string for the root.')
});

export const updateClusterRoleSchema = z.object({
    teamClusterId: z.string(),
    role: z.enum(clusterRoles)
});

export const updateClusterQueueConcurrencySchema = z.object({
    teamClusterId: z.string(),
    queueConcurrency: z.object({
        analysis: z.number(),
        rasterizer: z.number(),
        glbPreprocessing: z.number(),
        artifactUpload: z.number(),
        pluginWarmup: z.number()
    }),
    queueScopeLimits: z.object({
        analysisProcessing: queueScopeLimit,
        artifactUpload: queueScopeLimit,
        trajectoryRasterization: queueScopeLimit,
        trajectoryGlbConversion: queueScopeLimit
    })
});

export const generateClusterInstallManifestSchema = z.object({
    teamClusterId: z.string().describe('The id of the cluster the manifest enrolls.'),
    daemonPassword: z.string().describe('The daemon password to embed in the generated manifest.'),
    installRoot: z.string().describe('Absolute filesystem path on the target machine where the cluster stack is installed.'),
    ports: z.object({
        minio: z.number(),
        redis: z.number(),
        mongodb: z.number(),
        daemon: z.number()
    }).describe('Host ports to bind each cluster service to.')
});

export const revealClusterCredentialsSchema = z.object({
    teamClusterId: z.string(),
    password: z.string().describe('The requesting user\'s account password, required to confirm the sensitive reveal operation.')
});

export const manageDemoClusterSchema = z.object({
    action: z.enum(['provision', 'status', 'delete'])
});

export type ClusterRefInput = z.infer<typeof clusterRefSchema>;
export type ListClustersInput = z.infer<typeof listClustersSchema>;
export type ListClusterTransferJobsInput = z.infer<typeof listClusterTransferJobsSchema>;
export type ListRemoteClusterFilesInput = z.infer<typeof listRemoteClusterFilesSchema>;
export type UpdateClusterRoleInput = z.infer<typeof updateClusterRoleSchema>;
export type UpdateClusterQueueConcurrencyInput = z.infer<typeof updateClusterQueueConcurrencySchema>;
export type GenerateClusterInstallManifestInput = z.infer<typeof generateClusterInstallManifestSchema>;
export type RevealClusterCredentialsInput = z.infer<typeof revealClusterCredentialsSchema>;
export type ManageDemoClusterInput = z.infer<typeof manageDemoClusterSchema>;
