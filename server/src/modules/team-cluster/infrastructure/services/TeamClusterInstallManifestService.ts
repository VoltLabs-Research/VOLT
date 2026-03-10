import {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestFileDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/team-cluster/application/dtos/GenerateTeamClusterInstallManifestDTO';
import TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard, { DecryptedTeamClusterServiceCredentials } from '@shared/application/team-cluster/DaemonCredentialGuard';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { inject, injectable } from 'tsyringe';

interface DaemonManifestFile {
    relativePath: string;
    contents: string;
};

enum DaemonDistributionMode {
    Build = 'build',
    Image = 'image'
};

const TEAM_CLUSTER_INSTALL_MANIFEST_VERSION = '1.0.0';

const TAR_BLOCK_SIZE = 512;

const TEAM_CLUSTER_IMAGES = {
    minio: 'minio/minio:RELEASE.2025-02-28T09-55-16Z',
    redis: 'redis:7.4.2-alpine',
    mongodb: 'mongo:8.0.5',
    daemon: 'ghcr.io/voltlabs-research/volt-cluster-daemon:main'
};

const sanitizeComposeProjectName = (teamClusterId: string): string => {
    const alphanumericOnly = teamClusterId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const suffix = alphanumericOnly.slice(0, 12) || 'cluster';

    return `voltcluster${suffix}`;
};

const buildComposeFile = (daemonDistributionMode: DaemonDistributionMode): string => {
    let daemonBuildConfiguration: string[] = [];
    if (daemonDistributionMode === DaemonDistributionMode.Build) {
        daemonBuildConfiguration = [
            '    build:',
            '      context: ./cluster-daemon',
            '    pull_policy: build'
        ];
    }

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
        '    restart: unless-stopped',
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

const getDaemonPackageRoot = (): string => {
    return path.resolve(process.cwd(), '..', 'cluster-daemon');
};

const readDaemonManifestFiles = async (): Promise<DaemonManifestFile[]> => {
    const daemonRoot = getDaemonPackageRoot();
    const daemonFiles: DaemonManifestFile[] = [];

    const walk = async (currentPath: string): Promise<void> => {
        const entries = await readdir(currentPath, {
            withFileTypes: true
        });

        for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === 'dist') {
                continue;
            }

            const absolutePath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await walk(absolutePath);
                continue;
            }

            const contents = await readFile(absolutePath, 'utf8');
            daemonFiles.push({
                relativePath: path.relative(daemonRoot, absolutePath),
                contents
            });
        }
    };

    await walk(daemonRoot);

    return daemonFiles.sort((left, right) => {
        return left.relativePath.localeCompare(right.relativePath);
    });
};

const getDaemonDistributionMode = (): DaemonDistributionMode => {
    const rawDistributionMode = process.env.TEAM_CLUSTER_DAEMON_DISTRIBUTION_MODE?.trim().toLowerCase();
    if (rawDistributionMode === DaemonDistributionMode.Build) {
        return DaemonDistributionMode.Build;
    }

    return DaemonDistributionMode.Image;
};

const writeTarString = (buffer: Buffer, value: string, offset: number, length: number): void => {
    buffer.write(value.slice(0, length), offset, 'ascii');
};

const writeTarOctal = (buffer: Buffer, value: number, offset: number, length: number): void => {
    const octal = value.toString(8).padStart(length - 1, '0');
    buffer.write(octal, offset, length - 1, 'ascii');
    buffer[offset + length - 1] = 0;
};

const createTarHeader = (filePath: string, size: number, mode: string): Buffer => {
    const header = Buffer.alloc(TAR_BLOCK_SIZE, 0);
    writeTarString(header, filePath, 0, 100);
    writeTarOctal(header, parseInt(mode, 8), 100, 8);
    writeTarOctal(header, 0, 108, 8);
    writeTarOctal(header, 0, 116, 8);
    writeTarOctal(header, size, 124, 12);
    writeTarOctal(header, Math.floor(Date.now() / 1000), 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);
    writeTarString(header, 'ustar', 257, 6);
    writeTarString(header, '00', 263, 2);

    let checksum = 0;
    for (const value of header.values()) {
        checksum += value;
    }

    const checksumValue = checksum.toString(8).padStart(6, '0');
    header.write(checksumValue, 148, 6, 'ascii');
    header[154] = 0;
    header[155] = 0x20;

    return header;
};

const createBuildContextArchiveBase64 = (files: TeamClusterInstallManifestFileDTO[]): string => {
    const chunks: Buffer[] = [];

    for (const file of files) {
        if (!file.path.startsWith('cluster-daemon/')) {
            continue;
        }

        const relativePath = file.path.replace(/^cluster-daemon\//, '');
        const contentBuffer = Buffer.from(`${file.contents}\n`, 'utf8');
        const header = createTarHeader(relativePath, contentBuffer.length, file.mode);
        chunks.push(header, contentBuffer);

        const remainder = contentBuffer.length % TAR_BLOCK_SIZE;
        if (remainder !== 0) {
            chunks.push(Buffer.alloc(TAR_BLOCK_SIZE - remainder, 0));
        }
    }

    chunks.push(Buffer.alloc(TAR_BLOCK_SIZE, 0), Buffer.alloc(TAR_BLOCK_SIZE, 0));

    return gzipSync(Buffer.concat(chunks)).toString('base64');
};

const buildRootEnvFile = (
    teamClusterId: string,
    ports: TeamClusterInstallManifestPortsDTO,
    cloudUrl: string
): string => {
    const composeProjectName = sanitizeComposeProjectName(teamClusterId);

    return [
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${composeProjectName}`,
        'TEAM_CLUSTER_INSTALL_ROOT=/opt/volt/team-clusters',
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
    teamClusterId: string,
    credentials: DecryptedTeamClusterServiceCredentials,
    cloudUrl: string
): string => {
    return [
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${sanitizeComposeProjectName(teamClusterId)}`,
        'TEAM_CLUSTER_INSTALL_ROOT=/opt/volt/team-clusters',
        `VOLT_CLOUD_URL=${cloudUrl}`,
        `TEAM_CLUSTER_DAEMON_PASSWORD=${credentials.daemonPassword}`,
        `TEAM_CLUSTER_HEARTBEAT_PATH=/api/team-clusters/${teamClusterId}/heartbeats`,
        `TEAM_CLUSTER_LIFECYCLE_PATH=/api/team-clusters/${teamClusterId}/lifecycle`,
        `TEAM_CLUSTER_HEALTHCHECK_PATH=/api/team-clusters/${teamClusterId}/healthcheck`,
        `TEAM_CLUSTER_DELETE_COMPLETION_PATH=/api/team-clusters/${teamClusterId}/delete-completions`,
        `TEAM_CLUSTER_INSTALL_MANIFEST_PATH=/api/team-clusters/${teamClusterId}/install-manifest`,
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

@injectable()
export default class TeamClusterInstallManifestService {
    constructor(
        @inject(SHARED_TOKENS.DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async generateInstallManifest(
        teamClusterId: string,
        daemonPassword: string,
        ports: TeamClusterInstallManifestPortsDTO
    ): Promise<TeamClusterInstallManifestDTO> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        const cloudUrl = this.requireCloudUrl();
        const credentials = this.daemonCredentialGuard.getDecryptedServiceCredentials(teamCluster);
        const daemonDistributionMode = getDaemonDistributionMode();

        await this.persistPorts(teamCluster, ports);

        let daemonFiles: TeamClusterInstallManifestFileDTO[] = [];
        if (daemonDistributionMode === DaemonDistributionMode.Build) {
            const daemonManifestFiles = await readDaemonManifestFiles();
            daemonFiles = daemonManifestFiles.map((file): TeamClusterInstallManifestFileDTO => ({
                path: path.posix.join('cluster-daemon', file.relativePath.split(path.sep).join(path.posix.sep)),
                contents: file.contents,
                mode: '0644'
            }));
        }

        const files: TeamClusterInstallManifestFileDTO[] = [
            {
                path: 'docker-compose.yml',
                contents: buildComposeFile(daemonDistributionMode),
                mode: '0644'
            },
            {
                path: '.env',
                contents: buildRootEnvFile(teamCluster.id, ports, cloudUrl),
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
                contents: buildDaemonEnvFile(teamCluster.id, credentials, cloudUrl),
                mode: '0600'
            },
            ...daemonFiles
        ];

        let buildContextArchiveBase64: string | undefined;
        if (daemonDistributionMode === DaemonDistributionMode.Build) {
            buildContextArchiveBase64 = createBuildContextArchiveBase64(files);
        }

        return {
            manifestVersion: TEAM_CLUSTER_INSTALL_MANIFEST_VERSION,
            composeProjectName: sanitizeComposeProjectName(teamCluster.id),
            ...(buildContextArchiveBase64 ? { buildContextArchiveBase64 } : {}),
            files,
            images: TEAM_CLUSTER_IMAGES
        };
    }

    private requireCloudUrl(): string {
        const rawCloudUrl = process.env.SERVER_ENDPOINT?.trim();
        if (!rawCloudUrl) {
            throw ApplicationError.internalServerError('SERVER_ENDPOINT is required to generate the team cluster install manifest');
        }

        return rawCloudUrl.replace(/\/+$/g, '');
    }

    private async persistPorts(teamCluster: TeamCluster, ports: TeamClusterInstallManifestPortsDTO): Promise<void> {
        const updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
            services: {
                minio: {
                    ...teamCluster.props.services.minio,
                    port: ports.minio
                },
                redis: {
                    ...teamCluster.props.services.redis,
                    port: ports.redis
                },
                mongodb: {
                    ...teamCluster.props.services.mongodb,
                    port: ports.mongodb
                },
                daemon: {
                    ...teamCluster.props.services.daemon,
                    port: ports.daemon
                }
            }
        });

        if (!updatedTeamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
    }
};
