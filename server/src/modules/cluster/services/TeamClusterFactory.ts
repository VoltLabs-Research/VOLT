import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { encrypt } from '@shared/infrastructure/utilities/crypto';
import {
    TeamClusterStatus,
    type TeamClusterProps,
    type TeamClusterQueueConcurrencyProps,
    type TeamClusterQueueScopeLimitsProps,
    type TeamClusterRole,
    type TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import crypto from 'node:crypto';
import { isUniqueViolation } from '@shared/infrastructure/persistence/unique-violation';

const createDefaultTeamClusterQueueConcurrency = (): TeamClusterQueueConcurrencyProps => ({
    analysis: 8,
    rasterizer: 8,
    glbPreprocessing: 16,
    artifactUpload: 16,
    pluginWarmup: 4
});

export const createDefaultTeamClusterQueueScopeLimits = (): TeamClusterQueueScopeLimitsProps => ({
    analysisProcessing: {
        maxRunningPerTrajectory: 0
    },
    artifactUpload: {
        maxRunningPerTrajectory: 0
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: 0
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: 0
    }
});

export const DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY: TeamClusterQueueConcurrencyProps = createDefaultTeamClusterQueueConcurrency();

export const DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS: TeamClusterQueueScopeLimitsProps = createDefaultTeamClusterQueueScopeLimits();

const DEFAULT_TEAM_CLUSTER_ROLE: TeamClusterRole = 'cluster';

const createDefaultTeamClusterRoleConfig = (
    role: TeamClusterRole = DEFAULT_TEAM_CLUSTER_ROLE
): TeamClusterRuntimeRoleConfigProps => {
    return {
        desiredRole: role,
        effectiveRole: role,
        runtimeVersion: 1,
        draining: {
            compute: false,
            storage: false
        },
        lastAppliedAt: null
    };
};

interface GeneratedServiceCredentials {
    username: string;
    password: string;
}

interface PlaintextTeamClusterServices {
    minio: GeneratedServiceCredentials;
    redis: GeneratedServiceCredentials;
    mongodb: GeneratedServiceCredentials;
    daemon: {
        password: string;
    };
}

export const createServiceCredentials = (serviceName: string): GeneratedServiceCredentials => {
    const suffix = crypto.randomBytes(4).toString('hex');

    return {
        username: `volt_${serviceName}_${suffix}`,
        password: crypto.randomBytes(24).toString('hex')
    };
};

export const createDaemonPassword = (): string => {
    return crypto.randomBytes(24).toString('hex');
};

export const encryptTeamClusterServices = async (
    services: PlaintextTeamClusterServices
): Promise<TeamClusterProps['services']> => {
    const [
        encryptedMinioUsername,
        encryptedMinioPassword,
        encryptedRedisUsername,
        encryptedRedisPassword,
        encryptedMongodbUsername,
        encryptedMongodbPassword,
        encryptedDaemonPassword
    ] = await Promise.all([
        encrypt(services.minio.username),
        encrypt(services.minio.password),
        encrypt(services.redis.username),
        encrypt(services.redis.password),
        encrypt(services.mongodb.username),
        encrypt(services.mongodb.password),
        encrypt(services.daemon.password)
    ]);

    return {
        minio: {
            port: null,
            username: encryptedMinioUsername,
            password: encryptedMinioPassword
        },
        redis: {
            port: null,
            username: encryptedRedisUsername,
            password: encryptedRedisPassword
        },
        mongodb: {
            port: null,
            username: encryptedMongodbUsername,
            password: encryptedMongodbPassword
        },
        daemon: {
            port: null,
            password: encryptedDaemonPassword
        }
    };
};

export const buildTeamClusterProps = (params: {
    name: string;
    teamId: string;
    createdBy: string;
    enrollmentTokenHash: string;
    services: TeamClusterProps['services'];
    isDemo: boolean;
    demoExpiresAt: Date | null;
    now?: Date;
}): TeamClusterProps => {
    const now = params.now ?? new Date();

    return {
        name: params.name,
        team: params.teamId,
        createdBy: params.createdBy,
        status: TeamClusterStatus.WaitingForConnection,
        enrollmentTokenHash: params.enrollmentTokenHash,
        installedVersion: null,
        installRoot: null,
        lastHeartbeatAt: null,
        lastDisconnectAt: null,
        services: params.services,
        queueConcurrency: createDefaultTeamClusterQueueConcurrency(),
        queueScopeLimits: createDefaultTeamClusterQueueScopeLimits(),
        roleConfig: createDefaultTeamClusterRoleConfig(),
        isDemo: params.isDemo,
        demoExpiresAt: params.demoExpiresAt,
        createdAt: now,
        updatedAt: now
    };
};


export const TEAM_CLUSTER_NAME_CONFLICT_CODE = 'TeamCluster::AlreadyExists';

/**
 * Persists freshly built props, translating the (team, name) and one-demo-per-team
 * unique indexes into a conflict the caller can branch on.
 */
export const insertTeamCluster = async (props: TeamClusterProps): Promise<TeamClusterEntity> => {
    const {
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        effectiveCapabilities: _effectiveCapabilities,
        ...columns
    } = props;

    try {
        return await TeamClusterEntity.create({ ...columns }).save();
    } catch (error: unknown) {
        if (isUniqueViolation(error)) {
            throw ApplicationError.conflict(
                TEAM_CLUSTER_NAME_CONFLICT_CODE,
                'A team cluster with this name already exists'
            );
        }

        throw error;
    }
};
