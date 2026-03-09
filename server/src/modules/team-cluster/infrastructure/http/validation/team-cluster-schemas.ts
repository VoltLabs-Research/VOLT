import { createPaginationQuerySchema, createTeamScopedParamsSchema, teamParamsSchema } from '@shared/infrastructure/http/validation/shared-schemas';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { createValidationMiddleware } from '@shared/infrastructure/http/middleware/validation';
import { z } from 'zod/v4';

const requiredTextSchema = z.string().trim().min(1);

const teamClusterParamsSchema = createTeamScopedParamsSchema('teamClusterId');

const publicTeamClusterParamsSchema = z.object({
    teamClusterId: requiredTextSchema
}).strict();

const createTeamClusterSchema = z.object({
    name: requiredTextSchema.min(2).max(64)
}).strict();

const passwordConfirmationSchema = z.object({
    password: requiredTextSchema
}).strict();

const daemonPasswordSchema = z.object({
    daemonPassword: requiredTextSchema
}).strict();

const listTeamClustersQuerySchema = createPaginationQuerySchema({
    maxLimit: 100
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

export const teamClusterValidation = {
    create: createValidationMiddleware({
        params: teamParamsSchema,
        body: createTeamClusterSchema
    }),
    listByTeamId: createValidationMiddleware({
        params: teamParamsSchema,
        query: listTeamClustersQuerySchema
    }),
    getById: createValidationMiddleware({
        params: teamClusterParamsSchema
    }),
    deleteById: createValidationMiddleware({
        params: teamClusterParamsSchema,
        body: passwordConfirmationSchema
    }),
    revealCredentials: createValidationMiddleware({
        params: teamClusterParamsSchema,
        body: passwordConfirmationSchema
    }),
    processHealthcheck: createValidationMiddleware({
        params: publicTeamClusterParamsSchema,
        body: teamClusterHealthcheckSchema
    }),
    updateLifecycle: createValidationMiddleware({
        params: publicTeamClusterParamsSchema,
        body: teamClusterLifecycleSchema
    }),
    recordHeartbeat: createValidationMiddleware({
        params: publicTeamClusterParamsSchema,
        body: teamClusterHeartbeatSchema
    }),
    completeDeletion: createValidationMiddleware({
        params: publicTeamClusterParamsSchema,
        body: daemonPasswordSchema
    }),
    generateInstallManifest: createValidationMiddleware({
        params: publicTeamClusterParamsSchema,
        body: teamClusterInstallManifestSchema
    })
};
