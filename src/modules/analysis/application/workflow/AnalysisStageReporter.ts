import type {
    AnalysisStageStatus,
    AnalysisStageStatusPayload,
    AnalysisStageType
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events';

export interface AnalysisStageReportInput {
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    timestep?: number;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: Date;
    finishedAt?: Date;
    durationMs?: number;
}

export interface AnalysisStageReporter {
    report(input: AnalysisStageReportInput): Promise<void>;
}

type AnalysisStageReporterTransport = Pick<DaemonJobReporter, 'reportAnalysisStageStatus' | 'reportAnalysisLogChunk'>;

const TERMINAL_STAGE_STATUSES = new Set<AnalysisStageStatus>(['completed', 'failed', 'cached']);

export const createAnalysisStageReporter = (
    daemonJobReporter: AnalysisStageReporterTransport,
    basePayload: BaseAnalysisEventData
): AnalysisStageReporter => {
    const startedAtByStageKey = new Map<string, Date>();

    const createTimingKey = (stageKey: string, timestep?: number): string => {
        return `${stageKey}:${typeof timestep === 'number' ? timestep : 'global'}`;
    };

    const resolveTiming = (input: AnalysisStageReportInput, timestep?: number) => {
        const now = new Date();
        const timingKey = createTimingKey(input.stageKey, timestep);
        const startedAt = input.startedAt
            ?? startedAtByStageKey.get(timingKey)
            ?? (input.stageStatus === 'running' ? now : undefined);
        const finishedAt = input.finishedAt
            ?? (TERMINAL_STAGE_STATUSES.has(input.stageStatus) ? now : undefined);

        if (input.stageStatus === 'running') {
            startedAtByStageKey.set(timingKey, startedAt ?? now);
        }

        if (finishedAt) {
            startedAtByStageKey.delete(timingKey);
        }

        return {
            startedAt,
            finishedAt,
            durationMs: input.durationMs
                ?? (startedAt && finishedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : undefined)
        };
    };

    return {
        async report(input) {
            const timestep = input.timestep ?? basePayload.timestep;
            const timing = resolveTiming(input, timestep);
            const payload: AnalysisStageStatusPayload = {
                ...basePayload,
                timestep,
                stageKey: input.stageKey,
                label: input.label,
                stageType: input.stageType,
                stageStatus: input.stageStatus,
                pluginId: input.pluginId,
                pluginDisplayName: input.pluginDisplayName,
                nodeId: input.nodeId,
                exposureId: input.exposureId,
                configHash: input.configHash,
                cacheHit: input.cacheHit,
                detail: input.detail,
                startedAt: timing.startedAt?.toISOString(),
                finishedAt: timing.finishedAt?.toISOString(),
                durationMs: timing.durationMs
            };

            await daemonJobReporter.reportAnalysisStageStatus(payload);

            if (
                typeof timestep !== 'number'
                || typeof basePayload.analysisId !== 'string'
                || typeof basePayload.trajectoryId !== 'string'
                || payload.stageStatus === 'pending'
            ) {
                return;
            }

            const durationText = typeof payload.durationMs === 'number'
                ? ` (${payload.durationMs}ms)`
                : '';
            const cacheText = payload.cacheHit ? ' cache hit' : '';
            const detailText = payload.detail ? ` - ${payload.detail}` : '';

            await daemonJobReporter.reportAnalysisLogChunk({
                analysisId: basePayload.analysisId,
                jobId: basePayload.jobId,
                teamId: basePayload.teamId,
                trajectoryId: basePayload.trajectoryId,
                timestep,
                segments: [{
                    stream: 'system',
                    text: `[Volt] ${payload.label}: ${payload.stageStatus}${durationText}${cacheText}${detailText}\n`,
                    occurredAt: new Date().toISOString(),
                    nodeId: payload.nodeId,
                    nodeType: payload.stageType,
                    nodeLabel: payload.label,
                    pluginId: payload.pluginId
                }]
            });
        }
    };
};
