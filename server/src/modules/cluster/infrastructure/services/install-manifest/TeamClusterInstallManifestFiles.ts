import { DaemonDistributionMode } from '@modules/cluster/infrastructure/services/install-manifest/TeamClusterDaemonManifestSource';
import type {
    TeamClusterInstallManifestFileDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import type { DecryptedTeamClusterServiceCredentials } from '@shared/application/team-cluster/DaemonCredentialGuard';

export const TEAM_CLUSTER_INSTALL_MANIFEST_VERSION = '1.0.0';

export const TEAM_CLUSTER_IMAGES = {
    minio: 'minio/minio:RELEASE.2025-02-28T09-55-16Z',
    redis: 'redis:7.4.2-alpine',
    mongodb: 'mongo:8.0.5',
    daemon: 'ghcr.io/voltlabs-research/volt-cluster-daemon:main'
};

interface BuildInstallManifestFilesInput {
    teamId: string;
    teamClusterId: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPortsDTO;
    cloudUrl: string;
    credentials: DecryptedTeamClusterServiceCredentials;
    daemonDistributionMode: DaemonDistributionMode;
    daemonFiles: TeamClusterInstallManifestFileDTO[];
}

export const sanitizeComposeProjectName = (teamClusterId: string): string => {
    const alphanumericOnly = teamClusterId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const suffix = alphanumericOnly.slice(0, 12) || 'cluster';

    return `voltcluster${suffix}`;
};

const buildComposeFile = (daemonDistributionMode: DaemonDistributionMode): string => {
    const daemonBuildConfiguration = daemonDistributionMode === DaemonDistributionMode.Build
        ? [
            '    build:',
            '      context: ./cluster-daemon',
            '    pull_policy: build'
        ]
        : [];

    return [
        'services:',
        '  minio:',
        '    image: ${MINIO_IMAGE}',
        '    restart: unless-stopped',
        '    env_file:',
        '      - ./minio.env',
        '    command: server /data --address ":9000"',
        '    ports:',
        '      - "${MINIO_PORT}:9000"',
        '    volumes:',
        '      - minio-data:/data',
        '  mongodb:',
        '    image: ${MONGODB_IMAGE}',
        '    restart: unless-stopped',
        '    env_file:',
        '      - ./mongodb.env',
        '    ports:',
        '      - "${MONGODB_PORT}:27017"',
        '    volumes:',
        '      - mongodb-data:/data/db',
        '  redis:',
        '    image: ${REDIS_IMAGE}',
        '    restart: unless-stopped',
        '    command:',
        '      - redis-server',
        '      - --aclfile',
        '      - /usr/local/etc/redis/users.acl',
        '    ports:',
        '      - "${REDIS_PORT}:6379"',
        '    volumes:',
        '      - redis-data:/data',
        '      - ./redis.acl:/usr/local/etc/redis/users.acl:ro',
        '  daemon:',
        '    image: ${VOLT_CLUSTER_DAEMON_IMAGE}',
        ...daemonBuildConfiguration,
        '    restart: always',
        '    env_file:',
        '      - ./.env',
        '      - ./daemon.env',
        '    depends_on:',
        '      - minio',
        '      - mongodb',
        '      - redis',
        '    volumes:',
        '      - /var/run/docker.sock:/var/run/docker.sock',
        'volumes:',
        '  minio-data:',
        '  mongodb-data:',
        '  redis-data:'
    ].join('\n');
};

const buildRootEnvFile = (
    teamClusterId: string,
    installRoot: string,
    ports: TeamClusterInstallManifestPortsDTO,
    cloudUrl: string
): string => {
    return [
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${sanitizeComposeProjectName(teamClusterId)}`,
        `TEAM_CLUSTER_INSTALL_ROOT=${installRoot}`,
        `VOLT_CLOUD_URL=${cloudUrl}`,
        `VOLT_CLUSTER_INSTALL_MANIFEST_VERSION=${TEAM_CLUSTER_INSTALL_MANIFEST_VERSION}`,
        `MINIO_IMAGE=${TEAM_CLUSTER_IMAGES.minio}`,
        `REDIS_IMAGE=${TEAM_CLUSTER_IMAGES.redis}`,
        `MONGODB_IMAGE=${TEAM_CLUSTER_IMAGES.mongodb}`,
        `VOLT_CLUSTER_DAEMON_IMAGE=${TEAM_CLUSTER_IMAGES.daemon}`,
        `MINIO_PORT=${ports.minio}`,
        `REDIS_PORT=${ports.redis}`,
        `MONGODB_PORT=${ports.mongodb}`
    ].join('\n');
};

const buildMinioEnvFile = (credentials: DecryptedTeamClusterServiceCredentials): string => {
    return [
        `MINIO_ROOT_USER=${credentials.minioUsername}`,
        `MINIO_ROOT_PASSWORD=${credentials.minioPassword}`
    ].join('\n');
};

const buildMongoEnvFile = (credentials: DecryptedTeamClusterServiceCredentials): string => {
    return [
        `MONGO_INITDB_ROOT_USERNAME=${credentials.mongodbUsername}`,
        `MONGO_INITDB_ROOT_PASSWORD=${credentials.mongodbPassword}`,
        'MONGO_INITDB_DATABASE=volt'
    ].join('\n');
};

const buildRedisEnvFile = (credentials: DecryptedTeamClusterServiceCredentials): string => {
    return [
        `REDIS_USERNAME=${credentials.redisUsername}`,
        `REDIS_PASSWORD=${credentials.redisPassword}`
    ].join('\n');
};

const buildRedisAclFile = (credentials: DecryptedTeamClusterServiceCredentials): string => {
    return [
        'user default off',
        `user ${credentials.redisUsername} on >${credentials.redisPassword} ~* &* +@all`
    ].join('\n');
};

const buildDaemonEnvFile = (
    teamId: string,
    teamClusterId: string,
    installRoot: string,
    credentials: DecryptedTeamClusterServiceCredentials,
    cloudUrl: string
): string => {
    return [
        `TEAM_ID=${teamId}`,
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${sanitizeComposeProjectName(teamClusterId)}`,
        `TEAM_CLUSTER_INSTALL_ROOT=${installRoot}`,
        `VOLT_CLOUD_URL=${cloudUrl}`,
        `TEAM_CLUSTER_DAEMON_PASSWORD=${credentials.daemonPassword}`,
        `TEAM_CLUSTER_HEALTHCHECK_PATH=/api/team-clusters/${teamClusterId}/healthcheck`,
        'MINIO_ENDPOINT=http://minio:9000',
        `MINIO_ACCESS_KEY=${credentials.minioUsername}`,
        `MINIO_SECRET_KEY=${credentials.minioPassword}`,
        `MONGODB_URI=mongodb://${credentials.mongodbUsername}:${credentials.mongodbPassword}@mongodb:27017/volt?authSource=admin`,
        'REDIS_HOST=redis',
        'REDIS_PORT=6379',
        `REDIS_USERNAME=${credentials.redisUsername}`,
        `REDIS_PASSWORD=${credentials.redisPassword}`,
        'PORT=8080',
        `VOLT_CLOUD_DAEMON_SOCKET_URL=${cloudUrl}`
    ].join('\n');
};

export const buildTeamClusterInstallManifestFiles = ({
    teamId,
    teamClusterId,
    installRoot,
    ports,
    cloudUrl,
    credentials,
    daemonDistributionMode,
    daemonFiles
}: BuildInstallManifestFilesInput): TeamClusterInstallManifestFileDTO[] => {
    return [
        {
            path: 'docker-compose.yml',
            contents: buildComposeFile(daemonDistributionMode),
            mode: '0644'
        },
        {
            path: '.env',
            contents: buildRootEnvFile(teamClusterId, installRoot, ports, cloudUrl),
            mode: '0600'
        },
        {
            path: 'minio.env',
            contents: buildMinioEnvFile(credentials),
            mode: '0600'
        },
        {
            path: 'mongodb.env',
            contents: buildMongoEnvFile(credentials),
            mode: '0600'
        },
        {
            path: 'redis.env',
            contents: buildRedisEnvFile(credentials),
            mode: '0600'
        },
        {
            path: 'redis.acl',
            contents: buildRedisAclFile(credentials),
            mode: '0644'
        },
        {
            path: 'daemon.env',
            contents: buildDaemonEnvFile(teamId, teamClusterId, installRoot, credentials, cloudUrl),
            mode: '0600'
        },
        ...daemonFiles
    ];
};
