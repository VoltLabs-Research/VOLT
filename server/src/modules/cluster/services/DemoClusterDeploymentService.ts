import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import Docker from 'dockerode';

const DEMO_IMAGE_POSTGRES = process.env.DEMO_CLUSTER_POSTGRES_IMAGE || 'postgres:17-alpine';
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
    postgresUsername: string;
    postgresPassword: string;
    daemonPassword: string;
    enrollmentToken: string;
}

interface DemoStackResourceNames {
    network: string;
    volumes: { postgres: string; daemon: string; };
    containers: { postgres: string; daemon: string; };
}

const buildResourceNames = (teamClusterId: string): DemoStackResourceNames => {
    return {
        network: `${DEMO_NETWORK_PREFIX}-${teamClusterId}`,
        volumes: {
            postgres: `${DEMO_VOLUME_PREFIX}-${teamClusterId}-postgres`,
            daemon: `${DEMO_VOLUME_PREFIX}-${teamClusterId}-daemon`
        },
        containers: {
            postgres: `${DEMO_CONTAINER_PREFIX}-${teamClusterId}-postgres`,
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

class DemoClusterDeploymentService {
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
                this.ensureImage(DEMO_IMAGE_POSTGRES),
                this.ensureImage(DEMO_IMAGE_DAEMON)
            ]);
        }

        await this.ensureNetwork(names.network, labels);
        await Promise.all([
            this.ensureVolume(names.volumes.postgres, labels),
            this.ensureVolume(names.volumes.daemon, labels)
        ]);

        await this.ensurePostgresContainer(names, labels, credentials);
        await this.ensureDaemonContainer(teamCluster, names, labels, credentials);

        logger.info(`[DemoClusterDeploymentService] Demo stack deployed teamClusterId=${teamCluster.id}`);
    }

    async teardownDemoStack(teamCluster: TeamCluster): Promise<void> {
        const names = buildResourceNames(teamCluster.id);
        logger.info(`[DemoClusterDeploymentService] Tearing down demo stack teamClusterId=${teamCluster.id}`);

        await Promise.all([
            this.removeContainer(names.containers.daemon),
            this.removeContainer(names.containers.postgres),
        ]);

        await Promise.all([
            this.removeVolume(names.volumes.postgres),
            this.removeVolume(names.volumes.daemon)
        ]);

        await this.removeNetwork(names.network);

        logger.info(`[DemoClusterDeploymentService] Demo stack teardown complete teamClusterId=${teamCluster.id}`);
    }

    private async ensureImage(image: string): Promise<void> {
        try {
            await this.docker.getImage(image).inspect();
            return;
        } catch {
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

    private async ensurePostgresContainer(
        names: DemoStackResourceNames,
        labels: Record<string, string>,
        credentials: DemoClusterPlaintextCredentials
    ): Promise<void> {
        await this.removeContainer(names.containers.postgres);

        const container = await this.docker.createContainer({
            name: names.containers.postgres,
            Image: DEMO_IMAGE_POSTGRES,
            Labels: labels,
            Env: [
                `POSTGRES_USER=${credentials.postgresUsername}`,
                `POSTGRES_PASSWORD=${credentials.postgresPassword}`,
                'POSTGRES_DB=volt-cluster'
            ],
            HostConfig: {
                NetworkMode: names.network,
                RestartPolicy: { Name: 'unless-stopped' },
                Memory: DEMO_SERVICE_MEMORY_LIMIT_MB * MEGABYTE,
                Binds: [`${names.volumes.postgres}:/var/lib/postgresql/data`]
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

        const postgresUri = `postgres://${encodeURIComponent(credentials.postgresUsername)}:${encodeURIComponent(credentials.postgresPassword)}@${names.containers.postgres}:5432/volt-cluster`;

        const env = [
            `TEAM_ID=${teamCluster.props.team}`,
            `VOLT_TEAM_ID=${teamCluster.props.team}`,
            `TEAM_CLUSTER_ID=${teamCluster.id}`,
            `TEAM_CLUSTER_DAEMON_PASSWORD=${credentials.daemonPassword}`,
            `VOLT_CLOUD_URL=${DEMO_VOLT_CLOUD_URL}`,
            `DATABASE_URL=${postgresUri}`,
            'DAEMON_DATA_DIR=/var/lib/volt-daemon',
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
            await container.remove({
                force: true,
                v: true
            });
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

export default new DemoClusterDeploymentService();
