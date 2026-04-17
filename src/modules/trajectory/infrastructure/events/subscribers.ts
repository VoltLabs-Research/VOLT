import { createGlbJobStatusDedupeKey, createGlbJobStatusMessage } from '@/core/reverse-channel/contracts/messages/glb-job-status';
import { createRasterJobStatusDedupeKey, createRasterJobStatusMessage } from '@/core/reverse-channel/contracts/messages/raster-job-status';
import { createSshImportJobStatusDedupeKey, createSshImportJobStatusMessage } from '@/core/reverse-channel/contracts/messages/ssh-import-job-status';
import { BufferedTransportEventSubscriber } from '@/core/reverse-channel/infrastructure/events/TransportEventSubscriber';
import { GlbCompletedEvent } from '@/modules/trajectory/domain/events/glb/GlbCompletedEvent';
import { GlbFailedEvent } from '@/modules/trajectory/domain/events/glb/GlbFailedEvent';
import { GlbStartedEvent } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';
import { RasterCompletedEvent } from '@/modules/trajectory/domain/events/raster/RasterCompletedEvent';
import { RasterFailedEvent } from '@/modules/trajectory/domain/events/raster/RasterFailedEvent';
import { RasterStartedEvent } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';
import { SshImportCompletedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportCompletedEvent';
import { SshImportFailedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent';
import { SshImportStartedEvent } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

class RasterStatusSubscriber<TEvent extends RasterStartedEvent | RasterCompletedEvent | RasterFailedEvent>
    extends BufferedTransportEventSubscriber<TEvent> {
    protected getDedupeKey(event: TEvent): string {
        if (event instanceof RasterStartedEvent) {
            return createRasterJobStatusDedupeKey(event.payload, 'running');
        }

        if (event instanceof RasterCompletedEvent) {
            return createRasterJobStatusDedupeKey(event.payload, 'completed');
        }

        return createRasterJobStatusDedupeKey(event.payload, 'failed');
    }
}

class GlbStatusSubscriber<TEvent extends GlbStartedEvent | GlbCompletedEvent | GlbFailedEvent>
    extends BufferedTransportEventSubscriber<TEvent> {
    protected getDedupeKey(event: TEvent): string {
        if (event instanceof GlbStartedEvent) {
            return createGlbJobStatusDedupeKey(event.payload, 'running');
        }

        if (event instanceof GlbCompletedEvent) {
            return createGlbJobStatusDedupeKey(event.payload, 'completed');
        }

        return createGlbJobStatusDedupeKey(event.payload, 'failed');
    }
}

class SshImportStatusSubscriber<TEvent extends SshImportStartedEvent | SshImportCompletedEvent | SshImportFailedEvent>
    extends BufferedTransportEventSubscriber<TEvent> {
    protected getDedupeKey(event: TEvent): string {
        if (event instanceof SshImportStartedEvent) {
            return createSshImportJobStatusDedupeKey(event.payload, 'running');
        }

        if (event instanceof SshImportCompletedEvent) {
            return createSshImportJobStatusDedupeKey(event.payload, 'completed');
        }

        return createSshImportJobStatusDedupeKey(event.payload, 'failed');
    }
}

export class RasterStartedEventSubscriber extends RasterStatusSubscriber<RasterStartedEvent> {
    static readonly subscribedTo = RasterStartedEvent.eventName;

    protected buildMessage(event: RasterStartedEvent) {
        return createRasterJobStatusMessage(this.getMessageContext(), event.payload, 'running');
    }
}

export class RasterCompletedEventSubscriber extends RasterStatusSubscriber<RasterCompletedEvent> {
    static readonly subscribedTo = RasterCompletedEvent.eventName;

    protected buildMessage(event: RasterCompletedEvent) {
        return createRasterJobStatusMessage(this.getMessageContext(), event.payload, 'completed');
    }
}

export class RasterFailedEventSubscriber extends RasterStatusSubscriber<RasterFailedEvent> {
    static readonly subscribedTo = RasterFailedEvent.eventName;

    protected buildMessage(event: RasterFailedEvent) {
        return createRasterJobStatusMessage(this.getMessageContext(), event.payload, 'failed');
    }
}

export class GlbStartedEventSubscriber extends GlbStatusSubscriber<GlbStartedEvent> {
    static readonly subscribedTo = GlbStartedEvent.eventName;

    protected buildMessage(event: GlbStartedEvent) {
        return createGlbJobStatusMessage(this.getMessageContext(), event.payload, 'running');
    }
}

export class GlbCompletedEventSubscriber extends GlbStatusSubscriber<GlbCompletedEvent> {
    static readonly subscribedTo = GlbCompletedEvent.eventName;

    protected buildMessage(event: GlbCompletedEvent) {
        return createGlbJobStatusMessage(this.getMessageContext(), event.payload, 'completed');
    }
}

export class GlbFailedEventSubscriber extends GlbStatusSubscriber<GlbFailedEvent> {
    static readonly subscribedTo = GlbFailedEvent.eventName;

    protected buildMessage(event: GlbFailedEvent) {
        return createGlbJobStatusMessage(this.getMessageContext(), event.payload, 'failed');
    }
}

export class SshImportStartedEventSubscriber extends SshImportStatusSubscriber<SshImportStartedEvent> {
    static readonly subscribedTo = SshImportStartedEvent.eventName;

    protected buildMessage(event: SshImportStartedEvent) {
        return createSshImportJobStatusMessage(this.getMessageContext(), event.payload, 'running');
    }
}

export class SshImportCompletedEventSubscriber extends SshImportStatusSubscriber<SshImportCompletedEvent> {
    static readonly subscribedTo = SshImportCompletedEvent.eventName;

    protected buildMessage(event: SshImportCompletedEvent) {
        return createSshImportJobStatusMessage(this.getMessageContext(), event.payload, 'completed');
    }
}

export class SshImportFailedEventSubscriber extends SshImportStatusSubscriber<SshImportFailedEvent> {
    static readonly subscribedTo = SshImportFailedEvent.eventName;

    protected buildMessage(event: SshImportFailedEvent) {
        return createSshImportJobStatusMessage(this.getMessageContext(), event.payload, 'failed');
    }
}
