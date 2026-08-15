import type {
    Analysis,
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage
} from '@shared/contracts/types/AnalysisProps';
import type { AnalysisArtifactStatus, AnalysisStageStatus } from '@volt/contracts/modules/analysis/domain';
import { areArtifactsSettled } from '@modules/cluster/services/daemon/analysis-artifact-state';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type { DaemonAnalysisStageStatusInput } from '@shared/contracts/ports/IDaemonAnalysisCompletionService';

const toEpochMs = (value: Date | string | undefined): number | undefined => {
    if (!value) {
        return undefined;
    }

    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isNaN(time) ? undefined : time;
};

const isTerminalStageStatus = (status: AnalysisStageStatus): boolean => {
    return status === 'completed' || status === 'failed' || status === 'cached';
};

interface StageProgress {
    status: AnalysisStageStatus;
    startedAt?: Date;
    finishedAt?: Date;
}

export default class AnalysisStageProjection {
    toAnalysisStage(input: DaemonAnalysisStageStatusInput, timestep?: number): AnalysisStage {
        return {
            stageKey: input.stageKey,
            label: input.label,
            type: input.stageType,
            status: input.stageStatus,
            timestep,
            pluginId: input.pluginId,
            pluginDisplayName: input.pluginDisplayName,
            nodeId: input.nodeId,
            exposureId: input.exposureId,
            configHash: input.configHash,
            cacheHit: input.cacheHit,
            detail: input.detail,
            startedAt: this.#parseDate(input.startedAt),
            finishedAt: this.#parseDate(input.finishedAt),
            durationMs: input.durationMs
        };
    }

    upsertStage(stages: AnalysisStage[], stage: AnalysisStage): AnalysisStage[] {
        const index = stages.findIndex((candidate) => this.isSameStageIdentity(candidate, stage));
        if (index < 0) {
            return [...stages, stage];
        }

        const previous = stages[index];
        if (previous && this.shouldIgnoreStaleUpdate(previous, stage)) {
            return stages;
        }

        const next = [...stages];
        next[index] = {
            ...previous,
            ...stage,
            startedAt: stage.startedAt ?? previous.startedAt,
            finishedAt: stage.finishedAt ?? previous.finishedAt,
            durationMs: stage.durationMs ?? previous.durationMs
        };
        return next;
    }

    isSameStageIdentity(left: AnalysisStage, right: AnalysisStage): boolean {
        return left.stageKey === right.stageKey
            && left.timestep === right.timestep;
    }

    shouldIgnoreStaleUpdate(previous: StageProgress, next: StageProgress): boolean {
        if (!isTerminalStageStatus(previous.status) || isTerminalStageStatus(next.status)) {
            return false;
        }

        const previousFinishedAt = toEpochMs(previous.finishedAt);
        const nextStartedAt = toEpochMs(next.startedAt);
        return previousFinishedAt !== undefined
            && nextStartedAt !== undefined
            && nextStartedAt <= previousFinishedAt;
    }

    #elapsedMs(startedAt: Date | string | undefined, finishedAt: Date): number | undefined {
        const startedAtMs = toEpochMs(startedAt);
        return startedAtMs === undefined ? undefined : Math.max(0, finishedAt.getTime() - startedAtMs);
    }

    updateExpectedArtifactsForStage(
        artifacts: AnalysisExpectedArtifact[],
        stage: AnalysisStage,
        producedArtifacts?: boolean
    ): AnalysisExpectedArtifact[] {
        if (stage.type !== 'exposure' || !stage.exposureId) {
            return artifacts;
        }

        const nextStatus = stage.status === 'failed'
            ? 'failed'
            : stage.status === 'running'
                ? 'generating'
                : stage.status === 'completed' || stage.status === 'cached'
                    ? 'uploading'
                    : undefined;

        if (!nextStatus) {
            return artifacts;
        }

        const nothingProduced = producedArtifacts === false && nextStatus === 'uploading';

        return artifacts.map((artifact) => {
            if (artifact.exposureId !== stage.exposureId) {
                return artifact;
            }

            if (artifact.status === 'ready' && nextStatus !== 'failed') {
                return artifact;
            }

            if (nothingProduced) {
                return {
                    ...artifact,
                    status: 'pending' as const,
                    produced: false
                };
            }

            return {
                ...artifact,
                status: nextStatus,
                produced: nextStatus === 'generating'
                    ? undefined
                    : (producedArtifacts ?? artifact.produced)
            };
        });
    }

    upsertChildAnalysisForStage(
        childAnalyses: AnalysisChildAnalysis[],
        stage: AnalysisStage
    ): AnalysisChildAnalysis[] {
        if (stage.type !== 'plugin-ref' || !stage.pluginId) {
            return childAnalyses;
        }

        const child: AnalysisChildAnalysis = {
            id: stage.stageKey,
            pluginId: stage.pluginId,
            pluginDisplayName: stage.pluginDisplayName,
            configHash: stage.configHash,
            timestep: stage.timestep,
            status: stage.status,
            cacheHit: stage.cacheHit,
            startedAt: stage.startedAt,
            finishedAt: stage.finishedAt,
            durationMs: stage.durationMs
        };
        const index = childAnalyses.findIndex((candidate) => this.#isSameChildAnalysisIdentity(candidate, child));
        if (index < 0) {
            return [...childAnalyses, child];
        }

        const next = [...childAnalyses];
        if (this.shouldIgnoreStaleUpdate(next[index]!, child)) {
            return childAnalyses;
        }

        next[index] = {
            ...next[index],
            ...child,
            startedAt: child.startedAt ?? next[index].startedAt,
            finishedAt: child.finishedAt ?? next[index].finishedAt,
            durationMs: child.durationMs ?? next[index].durationMs
        };
        return next;
    }

    #isSameChildAnalysisIdentity(left: AnalysisChildAnalysis, right: AnalysisChildAnalysis): boolean {
        return left.id === right.id
            && left.timestep === right.timestep;
    }

    resolveArtifactStatusForStage(
        currentStatus: AnalysisArtifactStatus,
        expectedArtifacts: AnalysisExpectedArtifact[],
        stage: AnalysisStage
    ): AnalysisArtifactStatus {
        if (stage.status === 'failed') {
            return 'failed';
        }
        if (currentStatus === 'ready') {
            return currentStatus;
        }
        if (stage.type === 'exposure' && stage.status === 'running') {
            return 'generating';
        }
        if (stage.type === 'exposure' && (stage.status === 'completed' || stage.status === 'cached')) {
            return this.#areArtifactsSettled(expectedArtifacts) ? 'ready' : 'uploading';
        }
        if (stage.type === 'artifact-upload' && stage.status === 'running') {
            return 'uploading';
        }
        if (stage.type === 'artifact-upload' && stage.status === 'completed') {
            return this.#areArtifactsSettled(expectedArtifacts) ? 'ready' : 'uploading';
        }
        return currentStatus;
    }

    resolveArtifactStatusForUpload(
        expectedArtifacts: AnalysisExpectedArtifact[],
        status: JobStatus
    ): AnalysisArtifactStatus {
        if (status === JobStatus.Failed) {
            return 'failed';
        }
        if (status === JobStatus.Queued || status === JobStatus.Running || status === JobStatus.Completed) {
            return this.#areArtifactsSettled(expectedArtifacts) ? 'ready' : 'uploading';
        }
        return 'pending';
    }

    #areArtifactsSettled(expectedArtifacts: AnalysisExpectedArtifact[]): boolean {
        return areArtifactsSettled(expectedArtifacts);
    }

    #parseDate(value: string | undefined): Date | undefined {
        if (!value) {
            return undefined;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    closeRunningStages(
        stages: AnalysisStage[] | undefined,
        finalStatus: Analysis['props']['status'],
        finishedAt: Date
    ): AnalysisStage[] | undefined {
        if (!stages?.length) {
            return stages;
        }

        const stageStatus: AnalysisStageStatus = finalStatus === 'failed' ? 'failed' : 'completed';
        return stages.map((stage) => {
            if (stage.status !== 'running') {
                return stage;
            }

            return {
                ...stage,
                status: stageStatus,
                finishedAt,
                durationMs: stage.durationMs
                    ?? this.#elapsedMs(stage.startedAt, finishedAt)
            };
        });
    }

    closeRunningChildAnalyses(
        childAnalyses: AnalysisChildAnalysis[] | undefined,
        finalStatus: Analysis['props']['status'],
        finishedAt: Date
    ): AnalysisChildAnalysis[] | undefined {
        if (!childAnalyses?.length) {
            return childAnalyses;
        }

        const stageStatus: AnalysisStageStatus = finalStatus === 'failed' ? 'failed' : 'completed';
        return childAnalyses.map((child) => {
            if (child.status !== 'running') {
                return child;
            }

            return {
                ...child,
                status: stageStatus,
                finishedAt,
                durationMs: child.durationMs
                    ?? this.#elapsedMs(child.startedAt, finishedAt)
            };
        });
    }

    closeGeneratingArtifacts(
        expectedArtifacts: AnalysisExpectedArtifact[] | undefined,
        finalStatus: Analysis['props']['status']
    ): AnalysisExpectedArtifact[] | undefined {
        if (!expectedArtifacts?.length) {
            return expectedArtifacts;
        }

        let changed = false;
        const nextArtifacts = expectedArtifacts.map((artifact) => {
            if (artifact.status !== 'generating') {
                return artifact;
            }

            changed = true;
            const nextStatus: AnalysisExpectedArtifact['status'] = finalStatus === 'failed' ? 'failed' : 'uploading';
            return {
                ...artifact,
                status: nextStatus
            };
        });

        return changed ? nextArtifacts : expectedArtifacts;
    }
}
