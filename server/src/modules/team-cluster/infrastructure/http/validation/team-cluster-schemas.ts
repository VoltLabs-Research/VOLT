import { createPaginationQuerySchema, createTeamScopedParamsSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { TeamClusterStatus, TeamClusterRole } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TeamClusterRemoteAccessTargetDTO } from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import { createResourceValidation } from '@shared/infrastructure/http/validation/create-resource-validation';
import { requiredTextSchema } from '@shared/infrastructure/http/validation/resource-schemas';
import { z } from 'zod/v4';

const teamClusterParamsSchema = createTeamScopedParamsSchema('teamClusterId');

const publicTeamClusterParamsSchema = z.object({
    teamClusterId: requiredTextSchema
}).strict();

const teamClusterRoleSchema = z.nativeEnum(TeamClusterRole);

const updateRoleSchema = z.object({
    role: teamClusterRoleSchema
}).strict();

const createTeamClusterSchema = z.object({
    name: requiredTextSchema.min(2).max(64),
    role: teamClusterRoleSchema.optional()
}).strict();

const passwordConfirmationSchema = z.object({
    password: requiredTextSchema
}).strict();

const remoteAccessTargetSchema = z.union([
    z.literal(TeamClusterRemoteAccessTargetDTO.HostTerminal),
    z.literal(TeamClusterRemoteAccessTargetDTO.MongoDocuments),
    z.literal(TeamClusterRemoteAccessTargetDTO.RedisData),
    z.literal(TeamClusterRemoteAccessTargetDTO.Minio)
]);

const createRemoteAccessSessionSchema = z.object({
    password: requiredTextSchema,
    target: remoteAccessTargetSchema
}).strict();

const remoteExplorerRequestSchema = z.object({
    sessionId: requiredTextSchema,
    target: remoteAccessTargetSchema,
    path: z.string()
}).strict();

const daemonPasswordSchema = z.object({
    daemonPassword: requiredTextSchema
}).strict();

const listTeamClustersQuerySchema = createPaginationQuerySchema({
    maxLimit: 100,
    includeSearch: true
}).extend({
    roles: z.string().optional()
});

const publicStatusSchema = z.union([
    z.literal(TeamClusterStatus.PreparingEnvironment),
    z.literal(TeamClusterStatus.DependenciesInstallationFailed),
    z.literal(TeamClusterStatus.OperatingSystemNotSupported),
    z.literal(TeamClusterStatus.Deleting),
    z.literal(TeamClusterStatus.DeleteFailed),
    z.literal(TeamClusterStatus.Disconnected)
]);

const installedVersionSchema = z.string().trim().min(1).max(64).optional();

const daemonMetricsSnapshotSchema = z.object({
    timestamp: requiredTextSchema,
    hostname: requiredTextSchema,
    uptimeSeconds: z.number().nonnegative(),
    cpuUsagePercent: z.number().min(0).max(100),
    cpuLoadAverage: z.array(z.number()),
    cpuPerCoreUsagePercent: z.array(z.number().min(0).max(100)),
    memory: z.object({
        totalBytes: z.number().nonnegative(),
        freeBytes: z.number().nonnegative(),
        usedBytes: z.number().nonnegative(),
        usagePercent: z.number().min(0).max(100)
    }).strict(),
    disk: z.object({
        totalBytes: z.number().nonnegative(),
        freeBytes: z.number().nonnegative(),
        usedBytes: z.number().nonnegative(),
        usagePercent: z.number().min(0).max(100)
    }).strict(),
    diskOperations: z.object({
        readMegabytesPerSecond: z.number().nonnegative(),
        writeMegabytesPerSecond: z.number().nonnegative(),
        readIOPS: z.number().nonnegative(),
        writeIOPS: z.number().nonnegative(),
        totalIOPS: z.number().nonnegative()
    }).strict(),
    network: z.object({
        incomingKilobytesPerSecond: z.number().nonnegative(),
        outgoingKilobytesPerSecond: z.number().nonnegative(),
        totalKilobytesPerSecond: z.number().nonnegative(),
        receivedBytes: z.number().nonnegative(),
        sentBytes: z.number().nonnegative()
    }).strict(),
    cloudLatencyMs: z.number().nonnegative().nullable(),
    connectedToCloud: z.boolean()
}).strict();

const portSchema = z.number().int().min(1).max(65535);

const installRootSchema = requiredTextSchema.min(1).max(512);

const teamClusterHealthcheckSchema = z.object({
    enrollmentToken: requiredTextSchema,
    installedVersion: installedVersionSchema
}).strict();

const teamClusterLifecycleSchema = z.object({
    daemonPassword: requiredTextSchema,
    status: publicStatusSchema,
    installedVersion: installedVersionSchema
}).strict();

const teamClusterHeartbeatSchema = z.object({
    daemonPassword: requiredTextSchema,
    installedVersion: installedVersionSchema,
    metrics: daemonMetricsSnapshotSchema.optional()
}).strict();

const teamClusterInstallManifestSchema = z.object({
    daemonPassword: requiredTextSchema,
    installRoot: installRootSchema,
    ports: z.object({
        minio: portSchema,
        redis: portSchema,
        mongodb: portSchema,
        daemon: portSchema
    }).strict().refine((ports) => {
        const uniquePorts = new Set(Object.values(ports));
        return uniquePorts.size === Object.keys(ports).length;
    }, {
        message: 'Ports must be unique'
    })
}).strict();

const requestUpdateSchema = z.object({
    targetVersion: requiredTextSchema.max(128),
    isEdge: z.boolean().default(false),
    password: requiredTextSchema
}).strict();

export const teamClusterValidation = createResourceValidation({
    regenerateEnrollmentToken: {
        params: teamClusterParamsSchema
    },
    create: {
        params: teamParamsSchema,
        body: createTeamClusterSchema
    },
    listByTeamId: {
        params: teamParamsSchema,
        query: listTeamClustersQuerySchema
    },
    getById: {
        params: teamClusterParamsSchema
    },
    fetchAvailableVersions: {
        params: teamClusterParamsSchema
    },
    getResourceLimits: {
        params: teamClusterParamsSchema
    },
    deleteById: {
        params: teamClusterParamsSchema,
        body: passwordConfirmationSchema
    },
    requestUpdate: {
        params: teamClusterParamsSchema,
        body: requestUpdateSchema
    },
    createRemoteAccessSession: {
        params: teamClusterParamsSchema,
        body: createRemoteAccessSessionSchema
    },
    listRemoteExplorerEntries: {
        params: teamClusterParamsSchema,
        body: remoteExplorerRequestSchema
    },
    getRemoteExplorerNode: {
        params: teamClusterParamsSchema,
        body: remoteExplorerRequestSchema
    },
    downloadRemoteExplorerObject: {
        params: teamClusterParamsSchema,
        body: remoteExplorerRequestSchema
    },
    revealCredentials: {
        params: teamClusterParamsSchema,
        body: passwordConfirmationSchema
    },
    processHealthcheck: {
        params: publicTeamClusterParamsSchema,
        body: teamClusterHealthcheckSchema
    },
    updateLifecycle: {
        params: publicTeamClusterParamsSchema,
        body: teamClusterLifecycleSchema
    },
    recordHeartbeat: {
        params: publicTeamClusterParamsSchema,
        body: teamClusterHeartbeatSchema
    },
    completeDeletion: {
        params: publicTeamClusterParamsSchema,
        body: daemonPasswordSchema
    },
    generateInstallManifest: {
        params: publicTeamClusterParamsSchema,
        body: teamClusterInstallManifestSchema
    },
    updateRole: {
        params: teamClusterParamsSchema,
        body: updateRoleSchema
    }
});
