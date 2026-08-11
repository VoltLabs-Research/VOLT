import { ErrorCodes } from '@core/constants/error-codes';
import type {
    Analysis,
    TrajectoryLike,
    TrajectoryStatus
} from '@shared/contracts/types';
import type {
    DaemonJobCompletionInput,
    DaemonRasterJobStatusInput
} from '@shared/contracts/ports/IDaemonAnalysisCompletionService';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import type { AnalysisArtifactStatus as AnalysisArtifactStatusColumn, AnalysisStatus } from '@modules/analysis/contracts/analysis';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import { toTrajectoryLike } from '@modules/trajectory/contracts/trajectory-like';
import ApplicationError from '@shared/application/errors/ApplicationError';

export interface JobTrajectoryContext {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
}

export interface ResolvedTrajectoryOwnership {
    teamId: string;
    trajectory: TrajectoryLike;
    trajectoryContext: JobTrajectoryContext;
}

export interface ResolvedAnalysisOwnership extends ResolvedTrajectoryOwnership {
    analysis: Analysis;
}

type AnalysisOwnershipQuery = Pick<
    DaemonJobCompletionInput,
    'teamClusterId' | 'analysisId' | 'teamId' | 'trajectoryId' | 'timestep'
>;

type TrajectoryOwnershipQuery = Pick<DaemonRasterJobStatusInput, 'trajectoryId' | 'teamId' | 'timestep'>;

/**
 * Resolves which analysis / trajectory a daemon job report belongs to and
 * asserts that the reporting team cluster actually owns it. Also owns the
 * entity <-> domain mapping for the two aggregates it reads and writes.
 */
class DaemonJobOwnershipResolver {
    async resolveAnalysisOwnership(input: AnalysisOwnershipQuery): Promise<ResolvedAnalysisOwnership> {
        const analysis = await this.findAnalysisById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        if (analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH,
                'Analysis does not belong to the provided team'
            );
        }

        const analysisComputeClusterId = analysis.props.computeClusterId;
        if (analysisComputeClusterId && analysisComputeClusterId !== input.teamClusterId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH,
                'Analysis compute ownership does not belong to the authenticated team cluster'
            );
        }

        const trajectory = await this.findTrajectoryById(analysis.props.trajectory);
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        if (trajectory.props.team !== analysis.props.team) {
            throw ApplicationError.conflict(
                ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_TEAM_MISMATCH,
                'Analysis ownership does not match its trajectory'
            );
        }

        if (input.trajectoryId && input.trajectoryId !== trajectory._id) {
            throw ApplicationError.badRequest(
                ErrorCodes.TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH,
                'Payload trajectory does not match persisted analysis ownership'
            );
        }

        return {
            analysis,
            trajectory,
            teamId: analysis.props.team,
            trajectoryContext: {
                trajectoryId: trajectory._id,
                trajectoryName: trajectory.props.name,
                timestep: input.timestep
            }
        };
    }

    async resolveTrajectoryOwnership(input: TrajectoryOwnershipQuery): Promise<ResolvedTrajectoryOwnership> {
        const trajectory = await this.findTrajectoryById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND, 'Trajectory not found');
        }

        if (trajectory.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_CLUSTER_DAEMON_TRAJECTORY_TEAM_MISMATCH,
                'Trajectory does not belong to the provided team'
            );
        }

        return {
            teamId: trajectory.props.team,
            trajectory,
            trajectoryContext: {
                trajectoryId: trajectory._id,
                trajectoryName: trajectory.props.name,
                timestep: input.timestep
            }
        };
    }

    async findAnalysisById(analysisId: string): Promise<Analysis | null> {
        const entity = await AnalysisEntity.findOneBy({ id: analysisId });
        return entity ? this.toAnalysisLike(entity) : null;
    }

    async updateAnalysisById(analysisId: string, data: Partial<Analysis['props']>): Promise<Analysis | null> {
        const entity = await AnalysisEntity.findOneBy({ id: analysisId });
        if (!entity) {
            return null;
        }

        const patch: Partial<AnalysisEntity> = {};
        if (data.status !== undefined) patch.status = data.status as AnalysisStatus;
        if (data.artifactStatus !== undefined) patch.artifactStatus = data.artifactStatus as AnalysisArtifactStatusColumn;
        if (data.expectedArtifacts !== undefined) patch.expectedArtifacts = data.expectedArtifacts;
        if (data.stages !== undefined) patch.stages = data.stages;
        if (data.childAnalyses !== undefined) patch.childAnalyses = data.childAnalyses;
        if (data.totalFrames !== undefined) patch.totalFrames = data.totalFrames;
        if (data.startedAt !== undefined) patch.startedAt = data.startedAt;
        if (data.finishedAt !== undefined) patch.finishedAt = data.finishedAt;

        return this.toAnalysisLike(await Object.assign(entity, patch).save());
    }

    async updateTrajectoryById(
        trajectoryId: string,
        data: Partial<{ hasPreview: boolean; status: TrajectoryStatus }>
    ): Promise<void> {
        await TrajectoryEntity.update({ id: trajectoryId }, data);
    }

    private async findTrajectoryById(trajectoryId: string): Promise<TrajectoryLike | null> {
        const entity = await TrajectoryEntity.findOneBy({ id: trajectoryId });
        return entity ? toTrajectoryLike(entity) : null;
    }

    private toAnalysisLike(entity: AnalysisEntity): Analysis {
        return {
            _id: entity.id,
            props: {
                plugin: entity.plugin,
                pluginDisplayName: entity.pluginDisplayName,
                computeClusterId: entity.computeClusterId ?? undefined,
                storageClusterId: entity.storageClusterId ?? undefined,
                config: entity.config,
                trajectory: entity.trajectory,
                createdBy: entity.createdBy,
                pipelineStageHash: entity.pipelineStageHash ?? undefined,
                totalFrames: entity.totalFrames,
                startedAt: entity.startedAt ?? undefined,
                finishedAt: entity.finishedAt ?? undefined,
                team: entity.team,
                status: entity.status,
                artifactStatus: entity.artifactStatus,
                expectedArtifacts: entity.expectedArtifacts,
                stages: entity.stages,
                childAnalyses: entity.childAnalyses,
                createdAt: entity.createdAt,
                updatedAt: entity.updatedAt
            }
        };
    }
}

export default new DaemonJobOwnershipResolver();
