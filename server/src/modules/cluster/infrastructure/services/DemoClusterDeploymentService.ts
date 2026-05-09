import TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import Docker from 'dockerode';

const DEMO_IMAGE_MONGODB = process.env.DEMO_CLUSTER_MONGODB_IMAGE || 'mongo:8.0.5';
const DEMO_IMAGE_REDIS = process.env.DEMO_CLUSTER_REDIS_IMAGE || 'redis:7.4.2-alpine';
const DEMO_IMAGE_MINIO = process.env.DEMO_CLUSTER_MINIO_IMAGE || 'minio/minio:RELEASE.2025-02-28T09-55-16Z';
const DEMO_IMAGE_DAEMON = process.env.DEMO_CLUSTER_DAEMON_IMAGE || 'voltcloud/cluster-daemon:latest';
const DEMO_NETWORK_PREFIX = process.env.DEMO_CLUSTER_NETWORK_PREFIX || 'volt-demo';
const DEMO_VOLUME_PREFIX = process.env.DEMO_CLUSTER_VOLUME_PREFIX || 'volt-demo';
const DEMO_CONTAINER_PREFIX = process.env.DEMO_CLUSTER_CONTAINER_PREFIX || 'volt-demo';
const DEMO_VOLT_CLOUD_URL = process.env.DEMO_CLUSTER_VOLT_CLOUD_URL || process.env.PUBLIC_URL || 'http://host.docker.internal:3000';
const DEMO_PULL_IMAGES = (process.env.DEMO_CLUSTER_PULL_IMAGES ?? 'true').toLowerCase() !== 'false';
const DEMO_SERVER_NETWORK = process.env.DEMO_CLUSTER_SERVER_NETWORK || '';
const DEMO_DAEMON_MEMORY_LIMIT_MB = readNumberEnv('DEMO_CLUSTER_DAEMON_MEMORY_MB', 1024);
const DEMO_SERVICE_MEMORY_LIMIT_MB = readNumberEnv('DEMO_CLUSTER_SERVICE_MEMORY_MB', 512);

const MEGABYTE = 1024 * 1024;

export interface DemoClusterPlaintextCredentials {
    minioUsername: string;
    minioPassword: string;
    redisUsername: string;
    redisPassword: string;
    mongodbUsername: string;
    mongodbPassword: string;
    daemonPassword: string;
    enrollmentToken: string;
}

interface DemoStackResourceNames {
    network: string;
    volumes: { mongodb: string; redis: string; minio: string; };
    containers: { mongodb: string; redis: string; minio: string; daemon: string; };
}

const buildResourceNames = (teamClusterId: string): DemoStackResourceNames => {
    return {
        network: `${DEMO_NETWORK_PREFIX}-${teamClusterId}`,
        volumes: {
            mongodb: `${DEMO_VOLUME_PREFIX}-${teamClusterId}-mongodb`,
            redis: `${DEMO_VOLUME_PREFIX}-${teamClusterId}-redis`,
            minio: `${DEMO_VOLUME_PREFIX}-${teamClusterId}-minio`
        },
        containers: {
            mongodb: `${DEMO_CONTAINER_PREFIX}-${teamClusterId}-mongodb`,
            redis: `${DEMO_CONTAINER_PREFIX}-${teamClusterId}-redis`,
            minio: `${DEMO_CONTAINER_PREFIX}-${teamClusterId}-minio`,
            daemon: `${DEMO_CONTAINER_PREFIX}-${teamClusterId}-daemon`
        }
    };
};

const buildResourceLabels = (teamCluster: TeamCluster): Record<string, string> => {
    return {
        'voltcloud.demo': 'true',
        'voltcloud.demo.teamClusterId': teamCluster.id,
        'voltcloud.demo.teamId': teamCluster.props.team
    };
};

@Singleton()
export default class DemoClusterDeploymentService {
    private readonly docker: Docker;

    constructor() {
        this.docker = new Docker();
    }

    async deployDemoStack(teamCluster: TeamCluster, credentials: DemoClusterPlaintextCredentials): Promise<void> {
        const names = buildResourceNames(teamCluster.id);
        const labels = buildResourceLabels(teamCluster);

        logger.info(`[DemoClusterDeploymentService] Deploying demo stack teamClusterId=${teamCluster.id}`);

        if (DEMO_PULL_IMAGES) {
            await Promise.all([
                this.ensureImage(DEMO_IMAGE_MONGODB),
                this.ensureImage(DEMO_IMAGE_REDIS),
                this.ensureImage(DEMO_IMAGE_MINIO),
                this.ensureImage(DEMO_IMAGE_DAEMON)
            ]);
        }

        await this.ensureNetwork(names.network, labels);
        await Promise.all([
            this.ensureVolume(names.volumes.mongodb, labels),
            this.ensureVolume(names.volumes.redis, labels),
            this.ensureVolume(names.volumes.minio, labels)
        ]);

        await this.ensureMongoContainer(names, labels, credentials);
        await this.ensureRedisContainer(names, labels, credentials);
        await this.ensureMinioContainer(names, labels, credentials);
        await this.ensureDaemonContainer(teamCluster, names, labels, credentials);

        logger.info(`[DemoClusterDeploymentService] Demo stack deployed teamClusterId=${teamCluster.id}`);
    }

    async teardownDemoStack(teamCluster: TeamCluster): Promise<void> {
        const names = buildResourceNames(teamCluster.id);
        logger.info(`[DemoClusterDeploymentService] Tearing down demo stack teamClusterId=${teamCluster.id}`);

        await Promise.all([
            this.removeContainer(names.containers.daemon),
            this.removeContainer(names.containers.mongodb),
            this.removeContainer(names.containers.redis),
            this.removeContainer(names.containers.minio)
        ]);

        await Promise.all([
            this.removeVolume(names.volumes.mongodb),
            this.removeVolume(names.volumes.redis),
            this.removeVolume(names.volumes.minio)
        ]);

        await this.removeNetwork(names.network);

        logger.info(`[DemoClusterDeploymentService] Demo stack teardown complete teamClusterId=${teamCluster.id}`);
    }

    private async ensureImage(image: string): Promise<void> {
        try {
            await this.docker.getImage(image).inspect();
            return;
        } catch {
            // image not present locally — pull
        }

        logger.info(`[DemoClusterDeploymentService] Pulling image image=${image}`);

        await new Promise<void>((resolve, reject) => {
            this.docker.pull(image, {}, (pullError: Error | null, stream?: NodeJS.ReadableStream) => {
                if (pullError) {
                    reject(pullError);
                    return;
                }
                if (!stream) {
                    reject(new Error(`Docker pull returned no stream for image ${image}`));
                    return;
                }

                this.docker.modem.followProgress(stream, (followError: Error | null) => {
                    if (followError) {
                        reject(followError);
                        return;
                    }
                    resolve();
                });
            });
        });
    }

    private async ensureNetwork(name: string, labels: Record<string, string>): Promise<void> {
        try {
            await this.docker.getNetwork(name).inspect();
            return;
        } catch {
            // create below
        }

        await this.docker.createNetwork({
            Name: name,
            Driver: 'bridge',
            Labels: labels
        });
    }

    private async ensureVolume(name: string, labels: Record<string, string>): Promise<void> {
        await this.docker.createVolume({
            Name: name,
            Labels: labels
        });
    }

    private async ensureMongoContainer(
        names: DemoStackResourceNames,
        labels: Record<string, string>,
        credentials: DemoClusterPlaintextCredentials
    ): Promise<void> {
        await this.removeContainer(names.containers.mongodb);

        const container = await this.docker.createContainer({
            name: names.containers.mongodb,
            Image: DEMO_IMAGE_MONGODB,
            Labels: labels,
            Env: [
                `MONGO_INITDB_ROOT_USERNAME=${credentials.mongodbUsername}`,
                `MONGO_INITDB_ROOT_PASSWORD=${credentials.mongodbPassword}`
            ],
            HostConfig: {
                NetworkMode: names.network,
                RestartPolicy: { Name: 'unless-stopped' },
                Memory: DEMO_SERVICE_MEMORY_LIMIT_MB * MEGABYTE,
                Binds: [`${names.volumes.mongodb}:/data/db`]
            }
        });
        await container.start();
    }

    private async ensureRedisContainer(
        names: DemoStackResourceNames,
        labels: Record<string, string>,
        credentials: DemoClusterPlaintextCredentials
    ): Promise<void> {
        await this.removeContainer(names.containers.redis);

        const aclLine = `printf 'user default off\\nuser %s on >%s ~* &* +@all\\n' "$REDIS_USERNAME" "$REDIS_PASSWORD" > /tmp/users.acl && exec redis-server --appendonly yes --aclfile /tmp/users.acl`;

        const container = await this.docker.createContainer({
            name: names.containers.redis,
            Image: DEMO_IMAGE_REDIS,
            Labels: labels,
            Env: [
                `REDIS_USERNAME=${credentials.redisUsername}`,
                `REDIS_PASSWORD=${credentials.redisPassword}`
            ],
            Entrypoint: ['sh', '-c'],
            Cmd: [aclLine],
            HostConfig: {
                NetworkMode: names.network,
                RestartPolicy: { Name: 'unless-stopped' },
                Memory: DEMO_SERVICE_MEMORY_LIMIT_MB * MEGABYTE,
                Binds: [`${names.volumes.redis}:/data`]
            }
        });
        await container.start();
    }

    private async ensureMinioContainer(
        names: DemoStackResourceNames,
        labels: Record<string, string>,
        credentials: DemoClusterPlaintextCredentials
    ): Promise<void> {
        await this.removeContainer(names.containers.minio);

        const container = await this.docker.createContainer({
            name: names.containers.minio,
            Image: DEMO_IMAGE_MINIO,
            Labels: labels,
            Env: [
                `MINIO_ROOT_USER=${credentials.minioUsername}`,
                `MINIO_ROOT_PASSWORD=${credentials.minioPassword}`
            ],
            Cmd: ['server', '/data', '--console-address', ':9001'],
            HostConfig: {
                NetworkMode: names.network,
                RestartPolicy: { Name: 'unless-stopped' },
                Memory: DEMO_SERVICE_MEMORY_LIMIT_MB * MEGABYTE,
                Binds: [`${names.volumes.minio}:/data`]
            }
        });
        await container.start();
    }

    private async ensureDaemonContainer(
        teamCluster: TeamCluster,
        names: DemoStackResourceNames,
        labels: Record<string, string>,
        credentials: DemoClusterPlaintextCredentials
    ): Promise<void> {
        await this.removeContainer(names.containers.daemon);

        const mongodbUri = `mongodb://${encodeURIComponent(credentials.mongodbUsername)}:${encodeURIComponent(credentials.mongodbPassword)}@${names.containers.mongodb}:27017/volt?authSource=admin`;

        const env = [
            `TEAM_ID=${teamCluster.props.team}`,
            `VOLT_TEAM_ID=${teamCluster.props.team}`,
            `TEAM_CLUSTER_ID=${teamCluster.id}`,
            `TEAM_CLUSTER_DAEMON_PASSWORD=${credentials.daemonPassword}`,
            `ENROLLMENT_TOKEN=${credentials.enrollmentToken}`,
            `VOLT_CLOUD_URL=${DEMO_VOLT_CLOUD_URL}`,
            `VOLT_CLOUD_DAEMON_SOCKET_URL=${DEMO_VOLT_CLOUD_URL}`,
            `MONGODB_URI=${mongodbUri}`,
            `REDIS_HOST=${names.containers.redis}`,
            `REDIS_PORT=6379`,
            `REDIS_USERNAME=${credentials.redisUsername}`,
            `REDIS_PASSWORD=${credentials.redisPassword}`,
            `MINIO_ENDPOINT=http://${names.containers.minio}:9000`,
            `MINIO_ACCESS_KEY=${credentials.minioUsername}`,
            `MINIO_SECRET_KEY=${credentials.minioPassword}`,
            `MINIO_USE_SSL=false`,
            `DEMO_MODE=true`
        ];

        const container = await this.docker.createContainer({
            name: names.containers.daemon,
            Image: DEMO_IMAGE_DAEMON,
            Labels: labels,
            Env: env,
            HostConfig: {
                NetworkMode: names.network,
                RestartPolicy: { Name: 'unless-stopped' },
                Memory: DEMO_DAEMON_MEMORY_LIMIT_MB * MEGABYTE,
                Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
                ExtraHosts: ['host.docker.internal:host-gateway']
            }
        });

        if (DEMO_SERVER_NETWORK) {
            try {
                await this.docker.getNetwork(DEMO_SERVER_NETWORK).connect({ Container: container.id });
            } catch (error: unknown) {
                logger.warn(`[DemoClusterDeploymentService] Failed to attach daemon to server network ${DEMO_SERVER_NETWORK}: ${(error as Error).message}`);
            }
        }

        await container.start();
    }

    private async removeContainer(name: string): Promise<void> {
        try {
            const container = this.docker.getContainer(name);
            await container.remove({ force: true, v: true });
        } catch (error: unknown) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404) {
                return;
            }
            logger.warn(`[DemoClusterDeploymentService] Failed to remove container name=${name} error=${(error as Error).message}`);
        }
    }

    private async removeVolume(name: string): Promise<void> {
        try {
            await this.docker.getVolume(name).remove();
        } catch (error: unknown) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404) {
                return;
            }
            logger.warn(`[DemoClusterDeploymentService] Failed to remove volume name=${name} error=${(error as Error).message}`);
        }
    }

    private async removeNetwork(name: string): Promise<void> {
        try {
            await this.docker.getNetwork(name).remove();
        } catch (error: unknown) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404) {
                return;
            }
            logger.warn(`[DemoClusterDeploymentService] Failed to remove network name=${name} error=${(error as Error).message}`);
        }
    }
}
