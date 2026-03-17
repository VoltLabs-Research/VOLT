import { type TeamClusterDaemonExposureSnapshotPayload, TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureStatus, type TeamClusterServiceExposure } from '@/shared/contracts';
import type { DaemonConfig } from '@/core/config';
import { isIP } from 'node:net';
import type { ContainerInfo } from 'dockerode';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { VoltCloudConnection } from './VoltCloudConnection';

const EXPOSURE_SYNC_INTERVAL_MS = 5_000;
const HTTP_PORT_LABEL = 'volt.exposure.http.ports';
const WEBSOCKET_PORT_LABEL = 'volt.exposure.websocket.ports';
const TEAM_ID_LABEL = 'volt.team.id';
const TEAM_CLUSTER_ID_LABEL = 'volt.team-cluster.id';

type ContainerInspection = Awaited<ReturnType<DockerRuntimeService['getContainer']>>;

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

const readInspectionContainerName = (container: ContainerInfo, inspection: ContainerInspection): string => {
    const candidate = inspection.Name || container.Names?.[0] || container.Image || container.Id;
    return candidate.replace(/^\/+/, '');
};

const readInspectionInternalIp = (inspection: ContainerInspection): string | null => {
    const networks = Object.values(inspection.NetworkSettings.Networks || {});
    let ipv6Address: string | null = null;

    for (const network of networks) {
        const ipv4Address = network?.IPAddress?.trim();
        if (ipv4Address && isIP(ipv4Address) !== 0) {
            return ipv4Address;
        }

        const candidateIpv6Address = network?.GlobalIPv6Address?.trim();
        if (!ipv6Address && candidateIpv6Address && isIP(candidateIpv6Address) !== 0) {
            ipv6Address = candidateIpv6Address;
        }
    }

    const fallbackIpv4Address = inspection.NetworkSettings.IPAddress?.trim();
    if (fallbackIpv4Address && isIP(fallbackIpv4Address) !== 0) {
        return fallbackIpv4Address;
    }

    if (ipv6Address) {
        return ipv6Address;
    }

    const fallbackIpv6Address = inspection.NetworkSettings.GlobalIPv6Address?.trim();
    if (fallbackIpv6Address && isIP(fallbackIpv6Address) !== 0) {
        return fallbackIpv6Address;
    }

    return null;
};

const readPublishedTcpPorts = (inspection: ContainerInspection): number[] => {
    const publishedPorts = inspection.NetworkSettings.Ports || {};
    const containerPorts: number[] = [];

    for (const [portDefinition, bindings] of Object.entries(publishedPorts)) {
        const [rawPort, protocol] = portDefinition.split('/');
        const containerPort = Number(rawPort);

        if (protocol !== 'tcp' || !Number.isInteger(containerPort) || containerPort <= 0 || !bindings || bindings.length === 0) {
            continue;
        }

        containerPorts.push(containerPort);
    }

    return containerPorts;
};

export class DaemonExposureRegistryService {
    private syncTimer: NodeJS.Timeout | null = null;
    private exposures = new Map<string, TeamClusterServiceExposure>();
    private latestSyncToken = 0;

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
        const syncToken = ++this.latestSyncToken;
        const containers = await this.dockerRuntimeService.listContainers(true, {
            label: ['volt.managed=true']
        });
        const nextExposures = await this.buildExposures(containers);

        if (syncToken !== this.latestSyncToken) {
            return;
        }

        this.exposures = new Map(nextExposures.map((exposure) => [exposure.id, exposure]));
        this.emitSnapshot(nextExposures);
    }

    private async buildExposures(containers: ContainerInfo[]): Promise<TeamClusterServiceExposure[]> {
        const exposureGroups = await Promise.all(containers.map(async (container) => {
            try {
                const inspection = await this.dockerRuntimeService.getContainer(container.Id);
                const labels = inspection.Config.Labels || container.Labels || {};
                const teamId = labels[TEAM_ID_LABEL];
                const teamClusterId = labels[TEAM_CLUSTER_ID_LABEL];

                if (!teamId || !teamClusterId || teamClusterId !== this.config.teamClusterId) {
                    return [];
                }

                const httpPorts = readPortSet(labels[HTTP_PORT_LABEL]);
                const websocketPorts = readPortSet(labels[WEBSOCKET_PORT_LABEL]);
                const containerName = readInspectionContainerName(container, inspection);
                const targetHost = readInspectionInternalIp(inspection) || containerName;
                const publishedPorts = readPublishedTcpPorts(inspection);
                const status = inspection.State.Running
                    ? TeamClusterServiceExposureStatus.Active
                    : TeamClusterServiceExposureStatus.Unavailable;

                return publishedPorts.map((containerPort) => {
                    const accessModes = [TeamClusterServiceExposureAccessMode.Tcp];
                    if (httpPorts.has(containerPort)) {
                        accessModes.push(TeamClusterServiceExposureAccessMode.Http);
                    }
                    if (websocketPorts.has(containerPort)) {
                        accessModes.push(TeamClusterServiceExposureAccessMode.WebSocket);
                    }

                    return {
                        id: `${container.Id}:${containerPort}`,
                        teamClusterId,
                        teamId,
                        containerId: container.Id,
                        containerName,
                        exposureName: `${containerName}:${containerPort}`,
                        accessModes,
                        targetHost,
                        targetPort: containerPort,
                        containerPort,
                        status,
                        labels
                    };
                });
            } catch {
                return [];
            }
        }));

        return exposureGroups.flat();
    }

    private emitSnapshot(exposures: TeamClusterServiceExposure[]): void {
        if (!this.voltCloudConnection.isConnectedToCloud()) {
            return;
        }

        const payload: TeamClusterDaemonExposureSnapshotPayload = {
            type: 'exposure-snapshot',
            exposures
        };

        this.voltCloudConnection.emitMessage(payload);
    }
};
