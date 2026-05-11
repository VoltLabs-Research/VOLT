import { Factory } from '@/core/decorators/service';
import type { EventDispatcher } from '@/core/events/EventDispatcher';
import type { DomainEventClass, PayloadOf } from '@/core/events/createDomainEvent';
import {
    AnalysisCompletedEvent,
    AnalysisFailedEvent,
    AnalysisLogChunkReportedEvent,
    AnalysisStageStatusReportedEvent,
    AnalysisStartedEvent,
    DebugLogChunkReportedEvent
} from '@/modules/analysis/domain/events';
import {
    ArtifactUploadCompletedEvent,
    ArtifactUploadFailedEvent,
    ArtifactUploadStartedEvent
} from '@/modules/plugin/domain/events';
import {
    GlbCompletedEvent,
    GlbFailedEvent,
    GlbStartedEvent,
    RasterCompletedEvent,
    RasterFailedEvent,
    RasterStartedEvent,
    SshImportCompletedEvent,
    SshImportFailedEvent,
    SshImportStartedEvent
} from '@/modules/trajectory/domain/events';

interface ReporterEntry<TEvent extends DomainEventClass<any>> {
    readonly event: TEvent;
    readonly skipIf?: (input: PayloadOf<TEvent>) => boolean;
}

type ReporterSpec<TEvent extends DomainEventClass<any>> = TEvent | ReporterEntry<TEvent>;

const entry = <TEvent extends DomainEventClass<any>>(spec: ReporterSpec<TEvent>): ReporterEntry<TEvent> =>
    typeof spec === 'function' ? { event: spec } : spec;

const REPORT_MAP = {
    AnalysisStarted: AnalysisStartedEvent,
    AnalysisCompleted: AnalysisCompletedEvent,
    AnalysisFailed: AnalysisFailedEvent,
    AnalysisStageStatus: AnalysisStageStatusReportedEvent,
    AnalysisLogChunk: {
        event: AnalysisLogChunkReportedEvent,
        skipIf: (input: PayloadOf<typeof AnalysisLogChunkReportedEvent>) => input.segments.length === 0
    },
    DebugLogChunk: {
        event: DebugLogChunkReportedEvent,
        skipIf: (input: PayloadOf<typeof DebugLogChunkReportedEvent>) => input.segments.length === 0
    },
    RasterStarted: RasterStartedEvent,
    RasterCompleted: RasterCompletedEvent,
    RasterFailed: RasterFailedEvent,
    GlbStarted: GlbStartedEvent,
    GlbCompleted: GlbCompletedEvent,
    GlbFailed: GlbFailedEvent,
    SshImportStarted: SshImportStartedEvent,
    SshImportCompleted: SshImportCompletedEvent,
    SshImportFailed: SshImportFailedEvent,
    ArtifactUploadStarted: ArtifactUploadStartedEvent,
    ArtifactUploadCompleted: ArtifactUploadCompletedEvent,
    ArtifactUploadFailed: ArtifactUploadFailedEvent
} as const satisfies Record<string, ReporterSpec<DomainEventClass<any>>>;

type ReportKey = keyof typeof REPORT_MAP;
type EventFor<K extends ReportKey> = (typeof REPORT_MAP)[K] extends ReporterEntry<infer E>
    ? E
    : (typeof REPORT_MAP)[K] extends DomainEventClass<any>
        ? (typeof REPORT_MAP)[K]
        : never;

export type DaemonJobReporter = {
    [K in ReportKey as `report${K}`]: (input: PayloadOf<EventFor<K>>) => Promise<void>;
};

export const createDaemonJobReporterService = Factory('daemonJobReporter')((eventDispatcher: EventDispatcher): DaemonJobReporter => {
    const entries = Object.entries(REPORT_MAP).map(([key, spec]) => {
        const { event: EventClass, skipIf } = entry(spec as ReporterSpec<DomainEventClass<any>>);
        const method = (input: object): Promise<void> => {
            if (skipIf?.(input)) {
                return Promise.resolve();
            }
            return eventDispatcher.publish(new EventClass(input));
        };
        return [`report${key}`, method];
    });

    return Object.fromEntries(entries) as DaemonJobReporter;
});
