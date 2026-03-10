import { ErrorCodes } from '@core/constants/error-codes';
import { SIMULATION_CELL_TOKENS } from '@modules/simulation-cell/infrastructure/di/SimulationCellTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { secureCompare } from '@modules/team-cluster/utilities/secureCompare';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryCreatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryCreatedEvent';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ISimulationCellRepository } from '@modules/simulation-cell/domain/port/ISimulationCellRepository';
import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

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
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher)
        private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SIMULATION_CELL_TOKENS.SimulationCellRepository)
        private readonly simulationCellRepository: ISimulationCellRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: ProcessDaemonTrajectoryImportInputDTO): Promise<Result<ProcessDaemonTrajectoryImportOutputDTO, ApplicationError>> {
        try {
            await this.authenticate(input.teamClusterId, input.daemonPassword);

            const existingTrajectory = await this.trajectoryRepository.findById(input.trajectoryId);
            const trajectory = existingTrajectory || await this.trajectoryRepository.createWithId(input.trajectoryId, {
                name: input.trajectoryName,
                team: input.teamId,
                teamCluster: input.teamClusterId,
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
                    teamId: input.teamId,
                    userId: input.userId
                }));
            }

            if (!input.success) {
                await this.trajectoryRepository.updateById(trajectory.id, {
                    status: TrajectoryStatus.Failed
                });

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId: trajectory.id,
                    teamId: input.teamId,
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
                        team: input.teamId,
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
                teamId: input.teamId,
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

    private async authenticate(teamClusterId: string, daemonPassword: string): Promise<void> {
        const teamCluster = await this.teamClusterRepository.findByIdWithSensitiveData(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        const persistedDaemonPassword = teamCluster.props.services.daemon.password;
        if (!persistedDaemonPassword) {
            throw ApplicationError.internalServerError(`Missing daemon password for team cluster ${teamClusterId}`);
        }

        const decryptedDaemonPassword = this.teamClusterCredentialsCipher.decrypt(persistedDaemonPassword);
        if (!secureCompare(decryptedDaemonPassword, daemonPassword)) {
            throw ApplicationError.unauthorized('TeamCluster::DaemonUnauthorized', 'Invalid daemon credentials');
        }
    }
}
