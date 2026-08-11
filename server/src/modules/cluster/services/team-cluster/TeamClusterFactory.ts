import { ErrorCodes } from '@core/constants/error-codes';
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
    postgres: GeneratedServiceCredentials;
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
        encryptedPostgresUsername,
        encryptedPostgresPassword,
        encryptedDaemonPassword
    ] = await Promise.all([
        encrypt(services.postgres.username),
        encrypt(services.postgres.password),
        encrypt(services.daemon.password)
    ]);

    return {
        postgres: {
            port: null,
            username: encryptedPostgresUsername,
            password: encryptedPostgresPassword
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
        /* Nothing is known about the host until its daemon connects and reports. */
        hostCapabilities: null,
        createdAt: now,
        updatedAt: now
    };
};


export const TEAM_CLUSTER_NAME_CONFLICT_CODE = ErrorCodes.TEAM_CLUSTER_ALREADY_EXISTS;

/**
 * Persists freshly built props, translating the (team, name) unique index
 * into a conflict the caller can branch on.
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
