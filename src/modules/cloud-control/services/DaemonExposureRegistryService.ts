import { EventType, type TeamClusterDaemonExposureSnapshotPayload, TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus, type TeamClusterServiceExposure } from '@/shared/contracts';
import type { DaemonConfig } from '@/core/config';
import type { ContainerInfo } from 'dockerode';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { VoltCloudConnection } from './VoltCloudConnection';

const EXPOSURE_SYNC_INTERVAL_MS = 5_000;
const HTTP_PORT_LABEL = 'volt.exposure.http.ports';
const WEBSOCKET_PORT_LABEL = 'volt.exposure.websocket.ports';
const TEAM_ID_LABEL = 'volt.team.id';
const TEAM_CLUSTER_ID_LABEL = 'volt.team-cluster.id';

const readPortSet = (value: string | undefined): Set<number> => {
    if (!value) {
        return new Set();
    }

    const ports = value
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isInteger(entry) && entry > 0);

    return new Set(ports);
};

const readContainerName = (container: ContainerInfo): string => {
    const candidate = container.Names?.[0] || container.Image || container.Id;
    return candidate.replace(/^\/+/, '');
};

export class DaemonExposureRegistryService {
    private syncTimer: NodeJS.Timeout | null = null;
    private exposures = new Map<string, TeamClusterServiceExposure>();

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService: DockerRuntimeService,
        private readonly voltCloudConnection: VoltCloudConnection
    ) {}

    start(): void {
        if (this.syncTimer) {
            return;
        }

        this.sync().catch(() => {});
        this.syncTimer = setInterval(() => {
            this.sync().catch(() => {});
        }, EXPOSURE_SYNC_INTERVAL_MS);
    }

    stop(): void {
        if (!this.syncTimer) {
            return;
        }

        clearInterval(this.syncTimer);
        this.syncTimer = null;
    }

    getExposure(exposureId: string): TeamClusterServiceExposure | null {
        return this.exposures.get(exposureId) || null;
    }

    listExposures(): TeamClusterServiceExposure[] {
        return Array.from(this.exposures.values());
    }

    async sync(): Promise<void> {
        const containers = await this.dockerRuntimeService.listContainers(true, {
            label: ['volt.managed=true']
        });
        const nextExposures = this.buildExposures(containers);
        this.exposures = new Map(nextExposures.map((exposure) => [exposure.id, exposure]));
        this.emitSnapshot(nextExposures);
    }

    private buildExposures(containers: ContainerInfo[]): TeamClusterServiceExposure[] {
        const exposures: TeamClusterServiceExposure[] = [];

        for (const container of containers) {
            const labels = container.Labels || {};
            const teamId = labels[TEAM_ID_LABEL];
            const teamClusterId = labels[TEAM_CLUSTER_ID_LABEL] || this.config.teamClusterId;

            if (!teamId || teamClusterId !== this.config.teamClusterId) {
                continue;
            }

            const httpPorts = readPortSet(labels[HTTP_PORT_LABEL]);
            const websocketPorts = readPortSet(labels[WEBSOCKET_PORT_LABEL]);
            const containerName = readContainerName(container);

            for (const port of container.Ports || []) {
                if (port.Type !== 'tcp' || typeof port.PrivatePort !== 'number' || typeof port.PublicPort !== 'number') {
                    continue;
                }

                const accessModes = [TeamClusterServiceExposureAccessMode.Tcp];
                if (httpPorts.has(port.PrivatePort)) {
                    accessModes.push(TeamClusterServiceExposureAccessMode.Http);
                }
                if (websocketPorts.has(port.PrivatePort)) {
                    accessModes.push(TeamClusterServiceExposureAccessMode.WebSocket);
                }

                exposures.push({
                    id: `${container.Id}:${port.PrivatePort}`,
                    teamClusterId: this.config.teamClusterId,
                    teamId,
                    containerId: container.Id,
                    containerName,
                    exposureName: `${containerName}:${port.PrivatePort}`,
                    accessModes,
                    targetHost: '127.0.0.1',
                    targetPort: port.PublicPort,
                    containerPort: port.PrivatePort,
                    status: container.State === 'running'
                        ? TeamClusterServiceExposureStatus.Active
                        : TeamClusterServiceExposureStatus.Unavailable,
                    labels
                });
            }
        }

        return exposures;
    }

    private emitSnapshot(exposures: TeamClusterServiceExposure[]): void {
        if (!this.voltCloudConnection.isConnectedToCloud()) {
            return;
        }

        const socket = this.voltCloudConnection.getControlSocket();
        if (!socket) {
            return;
        }

        const payload: TeamClusterDaemonExposureSnapshotPayload = {
            type: 'exposure-snapshot',
            exposures
        };

        socket.emit(EventType.TeamClusterDaemonMessage, payload);
    }
};
