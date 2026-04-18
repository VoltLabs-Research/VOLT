import { EventGroup, OnEvent } from '@/core/events/decorators';
import { ClusterDaemonTransportEvents } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonTransportEvents';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import {
    createGlbJobStatusDedupeKey,
    createGlbJobStatusMessage,
    createRasterJobStatusDedupeKey,
    createRasterJobStatusMessage,
    createSshImportJobStatusDedupeKey,
    createSshImportJobStatusMessage
} from '@/modules/trajectory/contracts/reverse-channel-trajectory';
import { GlbCompletedEvent } from '@/modules/trajectory/domain/events/glb/GlbCompletedEvent';
import { GlbFailedEvent } from '@/modules/trajectory/domain/events/glb/GlbFailedEvent';
import { GlbStartedEvent } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';
import { RasterCompletedEvent } from '@/modules/trajectory/domain/events/raster/RasterCompletedEvent';
import { RasterFailedEvent } from '@/modules/trajectory/domain/events/raster/RasterFailedEvent';
import { RasterStartedEvent } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';
import { SshImportCompletedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportCompletedEvent';
import { SshImportFailedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent';
import { SshImportStartedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

type RasterStatus = 'running' | 'completed' | 'failed';
type GlbStatus = 'running' | 'completed' | 'failed';
type SshImportStatus = 'running' | 'completed' | 'failed';

@EventGroup('trajectory')
export class TrajectoryEvents extends ClusterDaemonTransportEvents {
    constructor(voltCloudConnection: ClusterDaemonEventPublisher) {
        super(voltCloudConnection);
    }

    @OnEvent('raster.started')
    rasterStarted(event: RasterStartedEvent): void {
        this.emitRasterStatus(event, 'running');
    }

    @OnEvent('raster.completed')
    rasterCompleted(event: RasterCompletedEvent): void {
        this.emitRasterStatus(event, 'completed');
    }

    @OnEvent('raster.failed')
    rasterFailed(event: RasterFailedEvent): void {
        this.emitRasterStatus(event, 'failed');
    }

    @OnEvent('glb.started')
    glbStarted(event: GlbStartedEvent): void {
        this.emitGlbStatus(event, 'running');
    }

    @OnEvent('glb.completed')
    glbCompleted(event: GlbCompletedEvent): void {
        this.emitGlbStatus(event, 'completed');
    }

    @OnEvent('glb.failed')
    glbFailed(event: GlbFailedEvent): void {
        this.emitGlbStatus(event, 'failed');
    }

    @OnEvent('ssh-import.started')
    sshImportStarted(event: SshImportStartedEvent): void {
        this.emitSshImportStatus(event, 'running');
    }

    @OnEvent('ssh-import.completed')
    sshImportCompleted(event: SshImportCompletedEvent): void {
        this.emitSshImportStatus(event, 'completed');
    }

    @OnEvent('ssh-import.failed')
    sshImportFailed(event: SshImportFailedEvent): void {
        this.emitSshImportStatus(event, 'failed');
    }

    private emitRasterStatus(
        event: RasterStartedEvent | RasterCompletedEvent | RasterFailedEvent,
        status: RasterStatus
    ): void {
        this.emitBufferedMessage(
            createRasterJobStatusMessage(this.getMessageContext(), event.payload, status),
            { dedupeKey: createRasterJobStatusDedupeKey(event.payload, status) }
        );
    }

    private emitGlbStatus(
        event: GlbStartedEvent | GlbCompletedEvent | GlbFailedEvent,
        status: GlbStatus
    ): void {
        this.emitBufferedMessage(
            createGlbJobStatusMessage(this.getMessageContext(), event.payload, status),
            { dedupeKey: createGlbJobStatusDedupeKey(event.payload, status) }
        );
    }

    private emitSshImportStatus(
        event: SshImportStartedEvent | SshImportCompletedEvent | SshImportFailedEvent,
        status: SshImportStatus
    ): void {
        this.emitBufferedMessage(
            createSshImportJobStatusMessage(this.getMessageContext(), event.payload, status),
            { dedupeKey: createSshImportJobStatusDedupeKey(event.payload, status) }
        );
    }
}
