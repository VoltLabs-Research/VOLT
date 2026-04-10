import mongoose from 'mongoose';
import { inject, injectable } from 'tsyringe';
import LammpsContainerModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsContainerModel';
import LammpsDumpModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsDumpModel';
import LammpsExecutionModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsExecutionModel';
import { LammpsContainerStatus, LammpsDumpStatus, LammpsExecutionStatus } from '@modules/lammps/domain/LammpsTypes';
import { LammpsRealtimeService } from './LammpsRealtimeService';

const MAX_TERMINAL_BUFFER_BYTES = 512 * 1024;

const asString = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : undefined;
};

const asRawString = (value: unknown): string | undefined => {
    return typeof value === 'string'
        ? value
        : undefined;
};

const asNumber = (value: unknown): number | undefined => {
    return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
};

const appendTerminalBuffer = (currentValue: string, nextChunk: string): string => {
    const combined = `${currentValue}${nextChunk}${nextChunk.endsWith('\n') ? '' : '\n'}`;
    const combinedBuffer = Buffer.from(combined, 'utf8');

    if (combinedBuffer.byteLength <= MAX_TERMINAL_BUFFER_BYTES) {
        return combined;
    }

    return combinedBuffer.subarray(combinedBuffer.byteLength - MAX_TERMINAL_BUFFER_BYTES).toString('utf8');
};

const buildExecutionEventLogLine = (
    status: LammpsExecutionStatus,
    stage?: string,
    step?: string
): string => {
    const fragments = [status, stage, step].filter((value): value is string => typeof value === 'string' && value.length > 0);
    return `[event] ${fragments.join(' · ')}`;
};

const buildDumpLogLine = (fileName: string, timestep: number): string => {
    return `[dump] Exported ${fileName} (${timestep})`;
};

@injectable()
export class LammpsProgressProjectorService {
    constructor(
        @inject(LammpsRealtimeService)
        private readonly realtimeService: LammpsRealtimeService
    ) {}

    async handleRuntimeProgress(
        teamClusterId: string,
        payload: {
            action: string;
            stage: string;
            timestamp: string;
            payload?: Record<string, unknown>;
        }
    ): Promise<void> {
        if (payload.action === 'lammps-container-provision') {
            await this.handleContainerProgress(teamClusterId, payload);
            return;
        }

        if (payload.action === 'lammps-run') {
            await this.handleRunProgress(teamClusterId, payload);
        }
    }

    private async handleContainerProgress(
        _teamClusterId: string,
        event: {
            stage: string;
            timestamp: string;
            payload?: Record<string, unknown>;
        }
    ): Promise<void> {
        const operationId = asString(event.payload?.operationId);
        const lammpsContainerId = asString(event.payload?.lammpsContainerId);
        const status = asString(event.payload?.status);
        const lastError = asString(event.payload?.message);

        const filter: Record<string, unknown> = {};
        if (lammpsContainerId && mongoose.Types.ObjectId.isValid(lammpsContainerId)) {
            filter._id = lammpsContainerId;
        } else if (operationId) {
            filter.operationId = operationId;
        } else {
            return;
        }

        const container = await LammpsContainerModel.findOne(filter).exec();
        if (!container) {
            return;
        }

        if (status === 'ready') {
            container.status = LammpsContainerStatus.Ready;
        } else if (status === 'failed') {
            container.status = LammpsContainerStatus.Failed;
        } else {
            container.status = LammpsContainerStatus.Provisioning;
        }

        container.operationId = operationId ?? container.operationId;
        container.imageTag = asString(event.payload?.imageTag) ?? container.imageTag;
        container.imageHash = asString(event.payload?.imageHash) ?? container.imageHash;
        container.workspaceContainerId = asString(event.payload?.workspaceContainerId) ?? container.workspaceContainerId;
        container.workspaceContainerName = asString(event.payload?.workspaceContainerName) ?? container.workspaceContainerName;
        container.workspaceRootPath = asString(event.payload?.workspaceRootPath) ?? container.workspaceRootPath;
        container.lastError = lastError;

        await container.save();

        this.realtimeService.emitToTeam(String(container.team), 'lammps_container_progress', {
            lammpsContainerId: String(container._id),
            operationId: container.operationId,
            teamClusterId: String(container.teamClusterId),
            status: container.status,
            stage: event.stage,
            step: asString(event.payload?.step),
            imageTag: container.imageTag,
            imageHash: container.imageHash,
            workspaceContainerId: container.workspaceContainerId,
            workspaceContainerName: container.workspaceContainerName,
            message: lastError,
            timestamp: event.timestamp
        });
    }

    private async handleRunProgress(
        _teamClusterId: string,
        event: {
            stage: string;
            timestamp: string;
            payload?: Record<string, unknown>;
        }
    ): Promise<void> {
        const executionId = asString(event.payload?.executionId);
        if (!executionId || !mongoose.Types.ObjectId.isValid(executionId)) {
            return;
        }

        const execution = await LammpsExecutionModel.findById(executionId).exec();
        if (!execution) {
            return;
        }

        const kind = asString(event.payload?.kind);
        const runtimeRunId = asString(event.payload?.runtimeRunId);
        if (runtimeRunId) {
            execution.runtimeRunId = runtimeRunId;
        }

        const status = asString(event.payload?.status);
        const timestampDate = new Date(event.timestamp);

        if (kind === 'log') {
            const line = asRawString(event.payload?.line);
            if (line === undefined) {
                return;
            }

            execution.terminalBuffer = appendTerminalBuffer(execution.terminalBuffer || '', line);
            await execution.save();

            this.realtimeService.emitToExecution(executionId, 'lammps_execution_log', {
                executionId,
                stream: asString(event.payload?.stream) ?? 'stdout',
                line,
                timestamp: event.timestamp
            });
            return;
        }

        if (kind === 'dump') {
            const timestep = asNumber(event.payload?.timestep);
            if (typeof timestep !== 'number') {
                return;
            }

            const fileName = asString(event.payload?.fileName) ?? `timestep-${timestep}.dump`;
            execution.lastTimestep = Math.max(execution.lastTimestep ?? timestep, timestep);
            execution.dumpCount = (execution.dumpCount || 0) + 1;
            execution.terminalBuffer = appendTerminalBuffer(
                execution.terminalBuffer || '',
                buildDumpLogLine(fileName, timestep)
            );

            const [dump] = await Promise.all([
                LammpsDumpModel.findOneAndUpdate({
                    execution: execution._id,
                    timestep
                }, {
                    $set: {
                        team: execution.team,
                        script: execution.script,
                        execution: execution._id,
                        stagedTrajectoryId: execution.stagedTrajectoryId,
                        timestep,
                        fileName,
                        dumpObjectKey: asString(event.payload?.dumpObjectKey) ?? '',
                        modelObjectKey: asString(event.payload?.modelObjectKey),
                        storageClusterId: execution.storageClusterId,
                        sizeBytes: asNumber(event.payload?.sizeBytes),
                        natoms: asNumber(event.payload?.natoms),
                        simulationCell: (event.payload?.simulationCell as Record<string, unknown> | null | undefined) ?? null,
                        status: LammpsDumpStatus.Ready,
                        exportedAt: event.timestamp
                    }
                }, {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }).exec(),
                execution.save()
            ]);

            if (!dump) {
                return;
            }

            this.realtimeService.emitToExecution(executionId, 'lammps_dump_updated', {
                executionId,
                dumpId: String(dump._id),
                timestep,
                fileName: dump.fileName,
                dumpObjectKey: dump.dumpObjectKey,
                modelObjectKey: dump.modelObjectKey,
                natoms: dump.natoms,
                simulationCell: dump.simulationCell,
                sizeBytes: dump.sizeBytes,
                timestamp: event.timestamp
            });

            this.realtimeService.emitToScript(String(execution.script), 'lammps_execution_updated', {
                executionId,
                lastTimestep: timestep,
                dumpCount: execution.dumpCount
            });
            return;
        }

        if (status === 'starting') {
            execution.status = LammpsExecutionStatus.Starting;
        } else if (status === 'created') {
            execution.status = LammpsExecutionStatus.Created;
        } else if (status === 'running') {
            execution.status = LammpsExecutionStatus.Running;
        } else if (status === 'stopping') {
            execution.status = LammpsExecutionStatus.Stopping;
        } else if (status === 'killing') {
            execution.status = LammpsExecutionStatus.Killing;
        } else if (status === 'completed') {
            execution.status = LammpsExecutionStatus.Completed;
            execution.finishedAt = timestampDate;
        } else if (status === 'cancelled') {
            execution.status = LammpsExecutionStatus.Cancelled;
            execution.finishedAt = timestampDate;
        } else if (status === 'failed') {
            execution.status = LammpsExecutionStatus.Failed;
            execution.finishedAt = timestampDate;
        }

        if (execution.status === LammpsExecutionStatus.Starting && !execution.startedAt) {
            execution.startedAt = timestampDate;
        }

        execution.errorMessage = asString(event.payload?.message) ?? execution.errorMessage;
        const exitCode = asNumber(event.payload?.exitCode);
        if (typeof exitCode === 'number') {
            execution.exitCode = exitCode;
        }

        const timestep = asNumber(event.payload?.timestep);
        if (typeof timestep === 'number') {
            execution.lastTimestep = timestep;
        }

        execution.terminalBuffer = appendTerminalBuffer(
            execution.terminalBuffer || '',
            buildExecutionEventLogLine(
                execution.status,
                event.stage,
                asString(event.payload?.step)
            )
        );

        await execution.save();

        const executionPayload = {
            executionId,
            scriptId: String(execution.script),
            runtimeRunId: execution.runtimeRunId,
            status: execution.status,
            lastTimestep: execution.lastTimestep,
            dumpCount: execution.dumpCount,
            startedAt: execution.startedAt,
            finishedAt: execution.finishedAt,
            exitCode: execution.exitCode,
            errorMessage: execution.errorMessage,
            stage: event.stage,
            timestamp: event.timestamp,
            step: asString(event.payload?.step)
        };

        this.realtimeService.emitToExecution(executionId, 'lammps_execution_updated', executionPayload);
        this.realtimeService.emitToScript(String(execution.script), 'lammps_execution_updated', executionPayload);
    }
}
