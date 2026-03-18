import { ErrorCodes } from '@core/constants/error-codes';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
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
    trajectoryName: string;
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

            const existingTrajectory = await this.trajectoryRepository.findById(input.trajectoryId);
            if (existingTrajectory) {
                this.assertTrajectoryOwnership(existingTrajectory, input);

                const targetStatus = input.success
                    ? TrajectoryStatus.Completed
                    : TrajectoryStatus.Failed;
                if (existingTrajectory.props.status === targetStatus) {
                    return Result.ok({ acknowledged: true });
                }

                if (this.isTerminalStatus(existingTrajectory.props.status)) {
                    throw ApplicationError.conflict(
                        'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_ALREADY_FINALIZED',
                        'Trajectory import has already been finalized'
                    );
                }
            }

            const trajectory = existingTrajectory || await this.trajectoryRepository.createWithId(input.trajectoryId, {
                name: input.trajectoryName,
                team: authenticatedTeamCluster.props.team,
                teamCluster: authenticatedTeamCluster.id,
                createdBy: input.userId,
                status: TrajectoryStatus.WaitingForProcess,
                frames: [],
                stats: {
                    totalFiles: 0,
                    totalSize: 0
                },
                analysis: [],
                rasterSceneViews: 0,
                isPublic: true,
                updatedAt: new Date(),
                createdAt: new Date()
            });

            if (!existingTrajectory) {
                await this.eventBus.publish(new TrajectoryCreatedEvent({
                    trajectoryId: trajectory.id,
                    trajectoryName: input.trajectoryName,
                    teamId: authenticatedTeamCluster.props.team,
                    userId: input.userId
                }));
            }

            if (!input.success) {
                await this.trajectoryRepository.updateById(trajectory.id, {
                    status: TrajectoryStatus.Failed
                });

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
            const persistedFrames = [] as Array<{ timestep: number; natoms: number; simulationCell: string; }>;
            let totalSize = 0;

            for (const frame of importedFrames) {
                let simulationCellId = '';

                if (frame.simulationCell) {
                    const simulationCell = await this.simulationCellRepository.create({
                        ...(frame.simulationCell as Record<string, unknown>),
                        team: trajectory.props.team,
                        trajectory: trajectory.id,
                        timestep: frame.timestep
                    });
                    simulationCellId = simulationCell.id;
                }

                persistedFrames.push({
                    timestep: frame.timestep,
                    natoms: frame.natoms,
                    simulationCell: simulationCellId
                });
                totalSize += frame.size;
            }

            await this.trajectoryRepository.updateById(trajectory.id, {
                status: TrajectoryStatus.Completed,
                frames: persistedFrames,
                stats: {
                    totalFiles: persistedFrames.length,
                    totalSize
                }
            });

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

        if (trajectory.props.teamCluster && trajectory.props.teamCluster !== input.teamClusterId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_IMPORT_CLUSTER_MISMATCH',
                'Trajectory does not belong to the authenticated team cluster'
            );
        }
    }

    private isTerminalStatus(status: TrajectoryStatus): boolean {
        return status === TrajectoryStatus.Completed || status === TrajectoryStatus.Failed;
    }
}
