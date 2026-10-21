import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import ApplicationError from '@shared/errors/ApplicationError';
import { encrypt } from '@shared/utilities/crypto';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    createDefaultTeamClusterRuntimeRoleConfig
} from '@voltstack/daemon-cluster-client';
import type { TeamClusterProps } from '@shared/contracts/types/TeamCluster';
import crypto from 'node:crypto';
import { isUniqueViolation } from '@shared/persistence/unique-violation';

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
        queueConcurrency: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY),
        queueScopeLimits: structuredClone(DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
        roleConfig: createDefaultTeamClusterRuntimeRoleConfig(),
        hostCapabilities: null,
        createdAt: now,
        updatedAt: now
    };
};


export const TEAM_CLUSTER_NAME_CONFLICT_CODE = ErrorCodes.TEAM_CLUSTER_ALREADY_EXISTS;

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
