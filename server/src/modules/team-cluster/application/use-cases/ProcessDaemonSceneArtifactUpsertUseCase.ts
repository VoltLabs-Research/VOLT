import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';

export interface ProcessDaemonSceneArtifactUpsertInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    trajectory: string;
    teamCluster?: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
};

interface ProcessDaemonSceneArtifactUpsertOutputDTO {
    acknowledged: boolean;
};

@injectable()
export default class ProcessDaemonSceneArtifactUpsertUseCase implements IUseCase<
    ProcessDaemonSceneArtifactUpsertInputDTO,
    ProcessDaemonSceneArtifactUpsertOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(
        input: ProcessDaemonSceneArtifactUpsertInputDTO
    ): Promise<Result<ProcessDaemonSceneArtifactUpsertOutputDTO, ApplicationError>> {
        try {
            await this.teamClusterLifecycleService.authenticateDaemonConnection(
                input.teamClusterId,
                input.daemonPassword
            );

            await recordSceneArtifact(this.sceneArtifactRepository, {
                objectName: input.objectName,
                trajectory: input.trajectory,
                teamCluster: input.teamCluster,
                analysis: input.analysis,
                plugin: input.plugin,
                sourceType: input.sourceType,
                timestep: input.timestep,
                params: input.params,
                displayName: input.displayName,
                status: input.status,
                storageBucket: input.storageBucket,
                metadata: input.metadata
            });

            return Result.ok({ acknowledged: true });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to process daemon scene artifact upsert')
            );
        }
    }
};
