import TeamCluster, {
    createDefaultTeamClusterRoleConfig,
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    TeamClusterProps,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import crypto from 'node:crypto';

export interface GeneratedServiceCredentials {
    username: string;
    password: string;
}

export interface PlaintextTeamClusterServices {
    minio: GeneratedServiceCredentials;
    redis: GeneratedServiceCredentials;
    mongodb: GeneratedServiceCredentials;
    daemon: {
        password: string;
    };
}

type TeamClusterEncryptor = {
    encrypt(value: string): Promise<string>;
};

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
    cipher: TeamClusterEncryptor,
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
        cipher.encrypt(services.minio.username),
        cipher.encrypt(services.minio.password),
        cipher.encrypt(services.redis.username),
        cipher.encrypt(services.redis.password),
        cipher.encrypt(services.mongodb.username),
        cipher.encrypt(services.mongodb.password),
        cipher.encrypt(services.daemon.password)
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

export const buildTeamClusterEntity = (params: {
    name: string;
    teamId: string;
    createdBy: string;
    enrollmentTokenHash: string;
    services: TeamClusterProps['services'];
    isDemo: boolean;
    demoExpiresAt: Date | null;
    now?: Date;
}): TeamCluster => {
    const now = params.now ?? new Date();

    return new TeamCluster('', {
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
        queueConcurrency: DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
        queueScopeLimits: DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
        roleConfig: createDefaultTeamClusterRoleConfig(),
        isDemo: params.isDemo,
        demoExpiresAt: params.demoExpiresAt,
        createdAt: now,
        updatedAt: now
    });
};
