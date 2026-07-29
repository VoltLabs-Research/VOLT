import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { getDockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import { getVoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';
import { getEventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus } from '@shared/contracts';
import type { TeamClusterServiceExposure } from '@shared/contracts';
import type { DaemonConfig } from '@core/config/daemon';
import type { EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import { logger } from '@shared/infrastructure/logger';
import {
    HTTP_PORTS_LABEL_KEY,
    READINESS_HTTP_PATH_LABEL_KEY,
    READINESS_HTTP_PORT_LABEL_KEY,
    READINESS_HTTP_QUERY_LABEL_KEY,
    TEAM_CLUSTER_ID_LABEL_KEY,
    TEAM_ID_LABEL_KEY,
    VOLT_MANAGED_CONTAINER_LABEL_KEY,
    VOLT_MANAGED_CONTAINER_LABEL_VALUE,
    WEBSOCKET_PORTS_LABEL_KEY
} from '@shared/contracts/types/runtime-container';
import { isIP } from 'node:net';
import type Dockerode from 'dockerode';
import type { DockerRuntime } from '@shared/infrastructure/runtime/DockerRuntime';
import { ExposureSnapshotUpdatedEvent } from '@modules/container/events/container-events';
import type { VoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';

type ContainerInfo = Dockerode.ContainerInfo;
type ContainerInspection = Awaited<ReturnType<DockerRuntime['getContainer']>>;

interface ContainerReadinessProbe {
    path: string;
    query?: string;
    port?: number;
}

interface ContainerExposureContext {
    container: ContainerInfo;
    containerName: string;
    httpPorts: Set<number>;
    labels: Record<string, string>;
    publishedPorts: number[];
    status: TeamClusterServiceExposureStatus;
    targetHost: string;
    teamClusterId: string;
    teamId: string;
    websocketPorts: Set<number>;
}

const EXPOSURE_SYNC_INTERVAL_MS = 5_000;
const READINESS_PROBE_TIMEOUT_MS = 2_000;

const readPortSet = (value: string | undefined): Set<number> => {
    if (!value) {
        return new Set();
    }

    const ports = value
        .split(',')
        .map(Number)
        .filter((entry) => entry > 0);

    return new Set(ports);
};

const readReadinessProbe = (labels: Record<string, string>): ContainerReadinessProbe | null => {
    const path = labels[READINESS_HTTP_PATH_LABEL_KEY]?.trim();
    if (!path) {
        return null;
    }

    const rawPort = Number(labels[READINESS_HTTP_PORT_LABEL_KEY]);
    return {
        path: path.startsWith('/') ? path : `/${path}`,
        query: labels[READINESS_HTTP_QUERY_LABEL_KEY]?.trim() || undefined,
        port: Number.isFinite(rawPort) && rawPort > 0 ? rawPort : undefined
    };
};

const readInspectionInternalIp = (inspection: ContainerInspection): string | null => {
    const networks = Object.values(inspection.NetworkSettings.Networks);
    let ipv6Address: string | null = null;

    for (const network of networks) {
        if (isIP(network.IPAddress) !== 0) {
            return network.IPAddress;
        }

        if (!ipv6Address && isIP(network.GlobalIPv6Address) !== 0) {
            ipv6Address = network.GlobalIPv6Address;
        }
    }

    if (isIP(inspection.NetworkSettings.IPAddress) !== 0) {
        return inspection.NetworkSettings.IPAddress;
    }

    if (ipv6Address) {
        return ipv6Address;
    }

    if (isIP(inspection.NetworkSettings.GlobalIPv6Address) !== 0) {
        return inspection.NetworkSettings.GlobalIPv6Address;
    }

    return null;
};

const readPublishedTcpPorts = (inspection: ContainerInspection): number[] => {
    const publishedPorts = inspection.NetworkSettings.Ports;
    const containerPorts: number[] = [];

    for (const [portDefinition, bindings] of Object.entries(publishedPorts)) {
        const [rawPort, protocol] = portDefinition.split('/');
        if (protocol !== 'tcp') {
            continue;
        }

        if (!bindings || bindings.length === 0) {
            continue;
        }

        const containerPort = Number(rawPort);
        if (containerPort <= 0) {
            continue;
        }

        containerPorts.push(containerPort);
    }

    return containerPorts;
};

export class DaemonExposureRegistry {
    private syncTimer: NodeJS.Timeout | null = null;
    private exposures = new Map<string, TeamClusterServiceExposure>();
    private readonly daemonExposures = new Map<string, TeamClusterServiceExposure>();
    private lastContainerExposures: TeamClusterServiceExposure[] = [];
    private lastSentSnapshotSignature: string | null = null;
    private lastCloudConnectionState = false;
    private inFlightSync: Promise<void> | null = null;
    private inFlightSyncStartedAt: number | null = null;

    private readonly readyContainerIds = new Set<string>();

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly eventDispatcher: EventDispatcher
    ) {}

    start(): void {
        if (this.syncTimer) {
            return;
        }

        this.sync().catch(() => {});
        this.syncTimer = setInterval(() => {
            this.sync().catch(() => {});
        }, EXPOSURE_SYNC_INTERVAL_MS);

        this.syncTimer.unref();
    }

    stop(): void {
        if (!this.syncTimer) {
            return;
        }

        clearInterval(this.syncTimer);
        this.syncTimer = null;
    }

    getExposure(exposureId: string): TeamClusterServiceExposure | null {
        const exposure = this.exposures.get(exposureId);
        return exposure === undefined ? null : exposure;
    }

    upsertDaemonExposure(exposure: TeamClusterServiceExposure): void {
        this.daemonExposures.set(exposure.id, exposure);
        this.publishExposures(this.lastContainerExposures);
    }

    removeDaemonExposure(exposureId: string): void {
        if (!this.daemonExposures.delete(exposureId)) {
            return;
        }

        this.publishExposures(this.lastContainerExposures);
    }

    sync(): Promise<void> {
        if (this.inFlightSync) {
            logger.debug(
                {
                    durationMs: this.inFlightSyncStartedAt ? Date.now() - this.inFlightSyncStartedAt : null
                },
                'Skipping overlapping daemon exposure sync'
            );

            return this.inFlightSync;
        }

        const startedAt = Date.now();
        this.inFlightSyncStartedAt = startedAt;
        this.inFlightSync = this.runSync().finally(() => {
            this.inFlightSync = null;
            this.inFlightSyncStartedAt = null;
        });

        return this.inFlightSync;
    }

    private async runSync(): Promise<void> {
        const includeStoppedContainers = true;
        const containers = await this.dockerRuntime.listContainers(includeStoppedContainers, {
            label: [`${VOLT_MANAGED_CONTAINER_LABEL_KEY}=${VOLT_MANAGED_CONTAINER_LABEL_VALUE}`]
        });
        this.forgetReadinessForMissingContainers(containers);
        const exposureContexts = await Promise.all(containers.map((container) => this.readContainerExposureContext(container)));
        const nextExposures = exposureContexts.flatMap((context) => {
            if (!context) {
                return [];
            }

            return context.publishedPorts.map((containerPort) => this.createContainerExposure(context, containerPort));
        });
        this.publishExposures(nextExposures);
    }

    private forgetReadinessForMissingContainers(containers: ContainerInfo[]): void {
        const liveContainerIds = new Set(containers.map((container) => container.Id));
        for (const containerId of this.readyContainerIds) {
            if (!liveContainerIds.has(containerId)) {
                this.readyContainerIds.delete(containerId);
            }
        }
    }

    private publishExposures(containerExposures: TeamClusterServiceExposure[]): TeamClusterServiceExposure[] {
        this.lastContainerExposures = [...containerExposures];

        const mergedExposures = [
            ...containerExposures,
            ...this.daemonExposures.values()
        ];
        const snapshotSignature = JSON.stringify([
            ...mergedExposures
        ].sort((left, right) => left.id.localeCompare(right.id)).map((exposure) => ({
            ...exposure,
            accessModes: [...exposure.accessModes].sort(),
            labels: Object.fromEntries(Object.entries(exposure.labels).sort((left, right) => left[0].localeCompare(right[0])))
        })));

        this.exposures = new Map(mergedExposures.map((exposure) => [exposure.id, exposure]));
        this.emitSnapshot(mergedExposures, snapshotSignature);

        return mergedExposures;
    }

    private async readContainerExposureContext(container: ContainerInfo): Promise<ContainerExposureContext | null> {
        try {
            const inspection = await this.dockerRuntime.getContainer(container.Id);
            const labels = inspection.Config.Labels;
            const teamId = labels[TEAM_ID_LABEL_KEY];
            const teamClusterId = labels[TEAM_CLUSTER_ID_LABEL_KEY];

            if (!teamId || !teamClusterId || teamClusterId !== this.config.teamClusterId) {
                return null;
            }

            const containerName = (inspection.Name || container.Names[0] || container.Image || container.Id).replace(/^\/+/, '');
            const targetHost = readInspectionInternalIp(inspection) || containerName;
            const isRunning = inspection.State.Running;
            const status = isRunning
                ? await this.resolveReadinessGatedStatus(container.Id, labels, targetHost)
                : TeamClusterServiceExposureStatus.Unavailable;

            return {
                container,
                containerName,
                httpPorts: readPortSet(labels[HTTP_PORTS_LABEL_KEY]),
                labels,
                publishedPorts: readPublishedTcpPorts(inspection),
                status,
                targetHost,
                teamClusterId,
                teamId,
                websocketPorts: readPortSet(labels[WEBSOCKET_PORTS_LABEL_KEY])
            };
        } catch {
            return null;
        }
    }

    private async resolveReadinessGatedStatus(
        containerId: string,
        labels: Record<string, string>,
        targetHost: string
    ): Promise<TeamClusterServiceExposureStatus> {
        const probe = readReadinessProbe(labels);
        if (!probe) {
            return TeamClusterServiceExposureStatus.Active;
        }

        if (this.readyContainerIds.has(containerId)) {
            return TeamClusterServiceExposureStatus.Active;
        }

        const probePort = probe.port
            ?? readPortSet(labels[HTTP_PORTS_LABEL_KEY]).values().next().value;
        if (!probePort) {
            return TeamClusterServiceExposureStatus.Unavailable;
        }

        const ready = await this.probeHttpReadiness(targetHost, probePort, probe);
        if (ready) {
            this.readyContainerIds.add(containerId);
            return TeamClusterServiceExposureStatus.Active;
        }

        return TeamClusterServiceExposureStatus.Unavailable;
    }

    private async probeHttpReadiness(
        host: string,
        port: number,
        probe: ContainerReadinessProbe
    ): Promise<boolean> {
        const normalizedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
        const query = probe.query ? (probe.query.startsWith('?') ? probe.query : `?${probe.query}`) : '';
        const url = `http://${normalizedHost}:${port}${probe.path}${query}`;

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(READINESS_PROBE_TIMEOUT_MS)
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    private createContainerExposure(context: ContainerExposureContext, containerPort: number): TeamClusterServiceExposure {
        const accessModes: TeamClusterServiceExposureAccessMode[] = [TeamClusterServiceExposureAccessMode.Tcp];
        if (context.httpPorts.has(containerPort)) {
            accessModes.push(TeamClusterServiceExposureAccessMode.Http);
        }
        if (context.websocketPorts.has(containerPort)) {
            accessModes.push(TeamClusterServiceExposureAccessMode.WebSocket);
        }

        const exposure: TeamClusterServiceExposure = {
            id: `${context.container.Id}:${containerPort}`,
            teamClusterId: context.teamClusterId,
            teamId: context.teamId,
            sourceKind: TeamClusterServiceExposureSourceKind.Container,
            containerId: context.container.Id,
            containerName: context.containerName,
            exposureName: `${context.containerName}:${containerPort}`,
            accessModes,
            targetHost: context.targetHost,
            targetPort: containerPort,
            containerPort,
            status: context.status,
            labels: context.labels
        };

        return exposure;
    }

    private emitSnapshot(exposures: TeamClusterServiceExposure[], snapshotSignature: string): void {
        const connectedToCloud = this.voltCloudConnection.isConnectedToCloud();
        const cloudConnectionRestored = connectedToCloud && !this.lastCloudConnectionState;
        this.lastCloudConnectionState = connectedToCloud;

        if (!connectedToCloud) {
            return;
        }

        if (!cloudConnectionRestored && this.lastSentSnapshotSignature === snapshotSignature) {
            return;
        }

        this.eventDispatcher.publish(new ExposureSnapshotUpdatedEvent({ exposures })).catch((error) => {
            logger.warn(`Failed to publish exposure snapshot event: ${error instanceof Error ? error.message : String(error)}`);
        });
        this.lastSentSnapshotSignature = snapshotSignature;
    }
};

export const getDaemonExposureRegistry = singleton((): DaemonExposureRegistry => new DaemonExposureRegistry(getConfig(), getDockerRuntime(), getVoltCloudConnection(), getEventDispatcher()));
