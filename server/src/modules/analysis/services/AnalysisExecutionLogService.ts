import { ErrorCodes } from '@core/constants/error-codes';
import type {
    AnalysisFrameLogIdentity,
    AnalysisFrameLogJobIdentity,
    AppendFrameSegmentsInput,
    GetFrameLogInput,
    SealFrameLogInput,
    StoredAnalysisFrameLogRecord
} from '@modules/analysis/contracts/analysis-execution-log';
import {
    measureRecordBytes,
    takeSegmentsWithinBudget
} from '@modules/analysis/services/AnalysisFrameLogBudget';
import {
    buildFrameLogSnapshot,
    buildPendingFrameLogSnapshot,
    resolveFrameLogCursor
} from '@modules/analysis/services/AnalysisFrameLogProjection';
import analysisFrameLogRuntime from '@modules/analysis/services/AnalysisFrameLogRuntime';
import type { FrameLogRuntimeState } from '@modules/analysis/services/AnalysisFrameLogRuntime';
import { readStoredFrameLog } from '@modules/analysis/services/AnalysisFrameLogStore';
import { emitAnalysisLogChunk } from '@modules/analysis/socket/AnalysisLogSocketProtocol';
import Trajectory from '@modules/trajectory/models/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    AnalysisFrameLogSnapshot,
    AnalysisFrameLogStatus
} from '@shared/contracts/types/AnalysisFrameLog';

class AnalysisExecutionLogService {
    async markFrameRunning(input: AnalysisFrameLogJobIdentity): Promise<void> {
        await analysisFrameLogRuntime.serialize(input.analysisId, input.timestep, async () => {
            const state = await this.loadFrameState(input);
            const current = state.record;
            if (current?.jobId === input.jobId && current.sealed) {
                return;
            }

            const nextRecord: StoredAnalysisFrameLogRecord = !current || current.jobId !== input.jobId
                ? this.createEmptyRecord(input, 'running')
                : {
                    ...current,
                    status: 'running',
                    sealed: false,
                    nextCursor: resolveFrameLogCursor(current.nextCursor, current.segments.length),
                    bytes: measureRecordBytes(current)
                };

            state.record = nextRecord;
            await analysisFrameLogRuntime.flush(state);
        });
    }

    async appendFrameSegments(input: AppendFrameSegmentsInput): Promise<void> {
        const segments = input.segments.filter((segment) => segment.text.length > 0);

        if (segments.length === 0) {
            return;
        }

        const chunk = await analysisFrameLogRuntime.serialize(input.analysisId, input.timestep, async () => {
            const state = await this.loadFrameState(input);
            const current = state.record;
            const record = !current || current.jobId !== input.jobId
                ? this.createEmptyRecord(input, 'running')
                : current;

            if (record.truncated) {
                return null;
            }

            const budget = takeSegmentsWithinBudget(record, segments);
            record.segments.push(...budget.acceptedSegments);

            const updatedRecord: StoredAnalysisFrameLogRecord = {
                ...record,
                status: record.sealed ? record.status : 'running',
                truncated: budget.truncated,
                nextCursor: resolveFrameLogCursor(null, record.segments.length),
                bytes: budget.totalBytes
            };

            state.record = updatedRecord;
            analysisFrameLogRuntime.schedulePersist(state);

            return {
                analysisId: input.analysisId,
                timestep: input.timestep,
                cursor: updatedRecord.nextCursor,
                segments: budget.acceptedSegments,
                sealed: updatedRecord.sealed,
                status: updatedRecord.status,
                truncated: updatedRecord.truncated
            };
        });

        if (chunk) {
            emitAnalysisLogChunk(chunk);
        }
    }

    async sealFrameLog(input: SealFrameLogInput): Promise<void> {
        const chunk = await analysisFrameLogRuntime.serialize(input.analysisId, input.timestep, async () => {
            const state = await this.loadFrameState(input);
            const current = state.record;
            const record = !current || current.jobId !== input.jobId
                ? this.createEmptyRecord(input, input.status)
                : current;

            const updatedRecord: StoredAnalysisFrameLogRecord = {
                ...record,
                status: input.status,
                sealed: true,
                nextCursor: resolveFrameLogCursor(record.nextCursor, record.segments.length),
                bytes: measureRecordBytes(record)
            };

            state.record = updatedRecord;
            await analysisFrameLogRuntime.flush(state);
            analysisFrameLogRuntime.discard(input.analysisId, input.timestep);

            return {
                analysisId: input.analysisId,
                timestep: input.timestep,
                cursor: updatedRecord.nextCursor,
                segments: [],
                sealed: true,
                status: input.status,
                truncated: updatedRecord.truncated
            };
        });

        emitAnalysisLogChunk(chunk);
    }

    async getFrameLog(input: GetFrameLogInput): Promise<AnalysisFrameLogSnapshot> {
        await analysisFrameLogRuntime.waitForPendingMutations(input.analysisId, input.timestep);

        const cached = analysisFrameLogRuntime.getCachedState(input.analysisId, input.timestep);
        const record = cached
            ? cached.record
            : await readStoredFrameLog(await this.requireStorageClusterId(input.trajectoryId), input);

        return record
            ? buildFrameLogSnapshot(record, input.afterCursor)
            : buildPendingFrameLogSnapshot(input);
    }

    async clearRuntimeState(analysisId: string): Promise<void> {
        await analysisFrameLogRuntime.drainAnalysis(analysisId);
    }

    private async loadFrameState(identity: AnalysisFrameLogIdentity): Promise<FrameLogRuntimeState> {
        return analysisFrameLogRuntime.loadState(
            await this.requireStorageClusterId(identity.trajectoryId),
            identity
        );
    }

    private async requireStorageClusterId(trajectoryId: string): Promise<string> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        const storageClusterId = trajectory?.storageClusterId;

        if (!storageClusterId) {
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_STORAGE_CLUSTER_REQUIRED,
                `Trajectory ${trajectoryId} does not have a storage cluster assigned`
            );
        }

        return storageClusterId;
    }

    private createEmptyRecord(
        input: AnalysisFrameLogJobIdentity,
        status: AnalysisFrameLogStatus
    ): StoredAnalysisFrameLogRecord {
        return {
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            jobId: input.jobId,
            status,
            sealed: status === 'completed' || status === 'failed',
            truncated: false,
            nextCursor: null,
            bytes: 0,
            segments: []
        };
    }
}

export default new AnalysisExecutionLogService();
