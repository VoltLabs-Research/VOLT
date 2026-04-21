import { ErrorCodes } from '@core/constants/error-codes';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';

interface ImportedFrameInput {
    timestep: number;
    natoms: number;
    simulationCell: Record<string, unknown> | null;
    size: number;
};

export interface ProcessDaemonTrajectoryImportInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    trajectoryId: string;
    teamId: string;
    userId: string;
    success: boolean;
    frames?: ImportedFrameInput[];
    failureCode?: string;
    failureDetails?: string;
};

interface ProcessDaemonTrajectoryImportOutputDTO {
    acknowledged: boolean;
};

@injectable()
export default class ProcessDaemonTrajectoryImportUseCase implements IUseCase<
    ProcessDaemonTrajectoryImportInputDTO,
    ProcessDaemonTrajectoryImportOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(SHARED_TOKENS.DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepository: ISimulationCellRepository,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: ProcessDaemonTrajectoryImportInputDTO): Promise<Result<ProcessDaemonTrajectoryImportOutputDTO, ApplicationError>> {
        try {
            const authenticatedTeamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(
                input.teamClusterId,
                input.daemonPassword
            );

            if (input.teamId !== authenticatedTeamCluster.props.team) {
                throw ApplicationError.forbidden(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_TEAM_MISMATCH',
                    'Trajectory import payload does not belong to the authenticated team cluster'
                );
            }

            const trajectory = await this.trajectoryRepository.findById(input.trajectoryId);
            if (!trajectory) {
                throw ApplicationError.notFound(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_NOT_FOUND',
                    'Trajectory must exist before daemon import completion is accepted'
                );
            }

            this.assertTrajectoryOwnership(trajectory, input);

            const targetStatus = input.success
                ? TrajectoryStatus.Completed
                : TrajectoryStatus.Failed;
            if (trajectory.props.status === targetStatus) {
                await this.publishImportJobStatus(
                    trajectory,
                    input,
                    input.success ? JobStatus.Completed : JobStatus.Failed,
                    input.failureDetails
                );
                return Result.ok({ acknowledged: true });
            }

            if (this.isTerminalStatus(trajectory.props.status)) {
                throw ApplicationError.conflict(
                    'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_ALREADY_FINALIZED',
                    'Trajectory import has already been finalized'
                );
            }

            if (!input.success) {
                await this.trajectoryRepository.updateById(trajectory.id, {
                    status: TrajectoryStatus.Failed
                });

                await this.publishImportJobStatus(trajectory, input, JobStatus.Failed, input.failureDetails);

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId: trajectory.id,
                    teamId: trajectory.props.team,
                    updates: {
                        status: TrajectoryStatus.Failed,
                        failureCode: input.failureCode as typeof ErrorCodes[keyof typeof ErrorCodes] | undefined,
                        failureDetails: input.failureDetails
                    },
                    updatedAt: new Date()
                }));

                return Result.ok({ acknowledged: true });
            }

            const importedFrames = input.frames || [];
            const framesWithCells = importedFrames.filter((frame) => Boolean(frame.simulationCell));
            const cellInputs = framesWithCells.map((frame) => ({
                ...(frame.simulationCell as Record<string, unknown>),
                team: trajectory.props.team,
                trajectory: trajectory.id,
                timestep: frame.timestep
            }));

            const createdCells = cellInputs.length > 0
                ? await this.simulationCellRepository.createMany(cellInputs as never)
                : [];
            const cellIdByTimestep = new Map<number, string>(
                framesWithCells.map((frame, index) => [frame.timestep, createdCells[index]!._id])
            );

            let totalSize = 0;
            const persistedFrames = importedFrames.map((frame) => {
                totalSize += frame.size;
                return {
                    timestep: frame.timestep,
                    natoms: frame.natoms,
                    simulationCell: cellIdByTimestep.get(frame.timestep) ?? ''
                };
            });

            await this.trajectoryRepository.updateById(trajectory.id, {
                status: TrajectoryStatus.Completed,
                frames: persistedFrames,
                stats: {
                    totalFiles: persistedFrames.length,
                    totalSize
                }
            });

            await this.storagePlacementService.ensurePlacement('trajectory', trajectory.id);
            await this.publishImportJobStatus(trajectory, input, JobStatus.Completed);

            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId: trajectory.id,
                teamId: trajectory.props.team,
                updates: {
                    status: TrajectoryStatus.Completed,
                    frames: persistedFrames,
                    stats: {
                        totalFiles: persistedFrames.length,
                        totalSize
                    }
                },
                updatedAt: new Date()
            }));

            return Result.ok({ acknowledged: true });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to process daemon trajectory import'));
        }
    }

    private assertTrajectoryOwnership(
        trajectory: Trajectory,
        input: ProcessDaemonTrajectoryImportInputDTO
    ): void {
        if (trajectory.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_TEAM_MISMATCH',
                'Trajectory does not belong to the provided team'
            );
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
        if (storageClusterId && storageClusterId !== input.teamClusterId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_CLUSTER_MISMATCH',
                'Trajectory storage does not belong to the authenticated team cluster'
            );
        }
    }

    private isTerminalStatus(status: TrajectoryStatus): boolean {
        return status === TrajectoryStatus.Completed || status === TrajectoryStatus.Failed;
    }

    private async publishImportJobStatus(
        trajectory: Trajectory,
        input: ProcessDaemonTrajectoryImportInputDTO,
        status: JobStatus.Completed | JobStatus.Failed,
        error?: string
    ): Promise<void> {
        await this.eventBus.publish(new JobStatusChangedEvent({
            jobId: `ssh-import:${trajectory.id}`,
            teamId: trajectory.props.team,
            status,
            queueType: 'ssh_import',
            name: 'Import trajectory from SSH',
            source: 'projected',
            backingSource: 'daemon',
            cleanupScope: 'ssh-import',
            teamClusterId: input.teamClusterId,
            trajectoryId: trajectory.id,
            trajectoryName: trajectory.props.name,
            error
        }));
    }
}
