import { singleton } from '@shared/application/utilities/singleton';
import { getEventDispatcher, type EventDispatcher } from '@shared/infrastructure/events/EventDispatcher';
import type { DomainEventClass, PayloadOf } from '@shared/domain/events/create-domain-event';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import {
    AnalysisCompletedEvent,
    AnalysisFailedEvent,
    AnalysisLogChunkReportedEvent,
    AnalysisStageStatusReportedEvent,
    AnalysisStartedEvent,
    DebugLogChunkReportedEvent
} from '@modules/analysis/events/analysis-events';
import {
    ArtifactUploadCompletedEvent,
    ArtifactUploadFailedEvent,
    ArtifactUploadStartedEvent
} from '@modules/plugin/events/plugin-events';
import {
    GlbCompletedEvent,
    GlbFailedEvent,
    GlbStartedEvent,
    RasterCompletedEvent,
    RasterFailedEvent,
    RasterStartedEvent
} from '@modules/trajectory/events/trajectory-events';

type AnyDomainEventClass = new (payload: never) => IDomainEvent;

interface ReporterEntry<TEvent extends AnyDomainEventClass> {
    readonly event: TEvent;
    readonly skipIf?: (input: PayloadOf<TEvent>) => boolean;
}

type ReporterSpec<TEvent extends AnyDomainEventClass> = TEvent | ReporterEntry<TEvent>;

const entry = <TEvent extends AnyDomainEventClass>(spec: ReporterSpec<TEvent>): ReporterEntry<TEvent> =>
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
    ArtifactUploadStarted: ArtifactUploadStartedEvent,
    ArtifactUploadCompleted: ArtifactUploadCompletedEvent,
    ArtifactUploadFailed: ArtifactUploadFailedEvent
} as const;

type ReportKey = keyof typeof REPORT_MAP;
type EventFor<K extends ReportKey> = (typeof REPORT_MAP)[K] extends ReporterEntry<infer E>
    ? E
    : (typeof REPORT_MAP)[K];

export type DaemonJobReporter = {
    [K in ReportKey as `report${K}`]: (input: PayloadOf<EventFor<K>>) => Promise<void>;
};

const createDaemonJobReporterService = (eventDispatcher: EventDispatcher): DaemonJobReporter => {
    const entries = Object.entries(REPORT_MAP).map(([key, spec]) => {
        const { event: EventClass, skipIf } = entry(spec as ReporterSpec<DomainEventClass<object>>);
        const method = (input: object): Promise<void> => {
            if (skipIf?.(input)) {
                return Promise.resolve();
            }
            return eventDispatcher.publish(new EventClass(input));
        };
        return [`report${key}`, method];
    });

    return Object.fromEntries(entries) as DaemonJobReporter;
};

export const getDaemonJobReporter = singleton((): DaemonJobReporter => createDaemonJobReporterService(getEventDispatcher()));
