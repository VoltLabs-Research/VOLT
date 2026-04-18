import { TeamClusterServiceExposureAccessMode, TeamClusterServiceExposureSourceKind, TeamClusterServiceExposureStatus } from '@/contracts';
import type { TeamClusterServiceExposure } from '@/contracts';
import type { DaemonConfig } from '@/core/config';
import type { EventDispatcher } from '@/core/events/EventDispatcher';
import { logger } from '@/core/logger';
import { isIP } from 'node:net';
import type Dockerode from 'dockerode';
import type { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import { ExposureSnapshotUpdatedEvent } from '@/modules/container/application/events/ExposureSnapshotUpdatedEvent';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';

type ContainerInfo = Dockerode.ContainerInfo;
type ContainerInspection = Awaited<ReturnType<DockerRuntime['getContainer']>>;

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
        .map(Number)
        .filter((entry) => entry > 0);

    return new Set(ports);
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
    private lastObservedSnapshotSignature: string | null = null;
    private lastSentSnapshotSignature: string | null = null;
    private lastCloudConnectionState = false;
    private inFlightSync: Promise<void> | null = null;
    private inFlightSyncStartedAt: number | null = null;

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

        if (this.syncTimer.unref) {
            this.syncTimer.unref();
        }
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
        this.inFlightSync = this.runSync(startedAt).finally(() => {
            this.inFlightSync = null;
            this.inFlightSyncStartedAt = null;
        });

        return this.inFlightSync;
    }

    private async runSync(startedAt: number): Promise<void> {
        const includeStoppedContainers = true;
        const containers = await this.dockerRuntime.listContainers(includeStoppedContainers, {
            label: ['volt.managed=true']
        });
        const exposureContexts = await Promise.all(containers.map((container) => this.readContainerExposureContext(container)));
        const nextExposures = exposureContexts.flatMap((context) => {
            if (!context) {
                return [];
            }

            return context.publishedPorts.map((containerPort) => this.createContainerExposure(context, containerPort));
        });
        const previousSnapshotSignature = this.lastObservedSnapshotSignature;
        this.publishExposures(nextExposures);
        const changed = this.lastObservedSnapshotSignature !== previousSnapshotSignature;
        const cloudConnectionRestored = this.voltCloudConnection.isConnectedToCloud() && !this.lastCloudConnectionState;

        if (changed || cloudConnectionRestored) {
            return;
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
        this.lastObservedSnapshotSignature = snapshotSignature;
        this.emitSnapshot(mergedExposures, snapshotSignature);

        return mergedExposures;
    }

    private async readContainerExposureContext(container: ContainerInfo): Promise<ContainerExposureContext | null> {
        try {
            const inspection = await this.dockerRuntime.getContainer(container.Id);
            const labels = inspection.Config.Labels;
            const teamId = labels[TEAM_ID_LABEL];
            const teamClusterId = labels[TEAM_CLUSTER_ID_LABEL];

            if (!teamId || !teamClusterId || teamClusterId !== this.config.teamClusterId) {
                return null;
            }

            const containerName = (inspection.Name || container.Names[0] || container.Image || container.Id).replace(/^\/+/, '');

            return {
                container,
                containerName,
                httpPorts: readPortSet(labels[HTTP_PORT_LABEL]),
                labels,
                publishedPorts: readPublishedTcpPorts(inspection),
                status: inspection.State.Running
                    ? TeamClusterServiceExposureStatus.Active
                    : TeamClusterServiceExposureStatus.Unavailable,
                targetHost: readInspectionInternalIp(inspection) || containerName,
                teamClusterId,
                teamId,
                websocketPorts: readPortSet(labels[WEBSOCKET_PORT_LABEL])
            };
        } catch {
            return null;
        }
    }

    private createContainerExposure(context: ContainerExposureContext, containerPort: number): TeamClusterServiceExposure {
        const accessModes = [TeamClusterServiceExposureAccessMode.Tcp];
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
