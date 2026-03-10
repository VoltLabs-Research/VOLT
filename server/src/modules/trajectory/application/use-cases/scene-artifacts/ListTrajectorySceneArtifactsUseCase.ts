import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import { resolveSceneArtifactTeamCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-team-cluster';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { injectable, inject } from 'tsyringe';

import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

interface DaemonSceneArtifact {
    _id: string;
    trajectory: string;
    teamCluster?: string;
    analysis?: string;
    plugin?: string;
    sourceType: string;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: string;
    metadata?: Record<string, unknown>;
    createdAt: string | Date;
    updatedAt: string | Date;
};

interface SceneArtifactRecord {
    _id: string;
    props: SceneArtifactProps;
};

interface SceneArtifactDomainLike {
    _id: string;
    props: SceneArtifactProps;
};

const toDate = (value: string | Date): Date => {
    return value instanceof Date ? value : new Date(value);
};

const toSceneArtifactRecord = (artifact: DaemonSceneArtifact): SceneArtifactRecord => {
    return {
        _id: artifact._id,
        props: {
            trajectory: artifact.trajectory,
            teamCluster: artifact.teamCluster,
            analysis: artifact.analysis,
            plugin: artifact.plugin,
            sourceType: artifact.sourceType as SceneArtifactProps['sourceType'],
            timestep: artifact.timestep,
            objectName: artifact.objectName,
            storageBucket: artifact.storageBucket,
            params: artifact.params,
            displayName: artifact.displayName,
            status: artifact.status as SceneArtifactProps['status'],
            metadata: artifact.metadata,
            createdAt: toDate(artifact.createdAt),
            updatedAt: toDate(artifact.updatedAt)
        }
    };
};

const toSceneArtifactOutput = (artifact: SceneArtifactRecord) => ({
    _id: artifact._id,
    ...artifact.props
});

const projectRenderableExposures = (artifacts: SceneArtifactRecord[]) => {
    const byExposureId = new Map<string, SceneArtifactRecord>();

    for (const artifact of artifacts) {
        const exposureId = artifact.props.params?.exposureId;
        if (!exposureId) continue;

        const current = byExposureId.get(String(exposureId));
        if (!current) {
            byExposureId.set(String(exposureId), artifact);
            continue;
        }

        const artifactUpdatedAt = new Date(artifact.props.updatedAt).getTime();
        const currentUpdatedAt = new Date(current.props.updatedAt).getTime();
        if (artifactUpdatedAt > currentUpdatedAt) {
            byExposureId.set(String(exposureId), artifact);
        }
    }

    return Array.from(byExposureId.values())
        .filter((artifact) => {
            const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
            return typeof artifact.props.plugin === 'string'
                && artifact.props.plugin.length > 0
                && typeof metadata?.pluginId === 'string'
                && metadata.pluginId.length > 0;
        })
        .map((artifact) => {
            const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
            const exposureName = typeof metadata?.exposureName === 'string'
                ? metadata.exposureName.trim()
                : '';
            if (!exposureName) return null;

            const pluginId = typeof metadata?.pluginId === 'string' ? metadata.pluginId : '';
            if (!pluginId) return null;

            return {
                pluginId,
                analysisId: artifact.props.analysis,
                exposureId: String(artifact.props.params.exposureId),
                name: exposureName,
                icon: undefined,
                results: 'glb',
                canvas: true,
                raster: false,
                export: {
                    exporter: typeof metadata?.exporter === 'string' ? metadata.exporter : undefined,
                    type: typeof metadata?.exportType === 'string' ? metadata.exportType : undefined,
                    options: {}
                }
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
};

@injectable()
export class ListTrajectorySceneArtifactsUseCase implements IUseCase<ListTrajectorySceneArtifactsInputDTO, PaginatedResult<any>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(input: ListTrajectorySceneArtifactsInputDTO) {
        const {
            trajectoryId,
            sourceType,
            analysisId,
            projection,
            timestep
        } = input;
        const parsedTimestep = timestep !== undefined ? Number(timestep) : undefined;

        const filter: Record<string, unknown> = {
            trajectory: trajectoryId
        };

        if (sourceType) filter.sourceType = sourceType;
        if (analysisId) filter.analysis = analysisId;
        if (parsedTimestep !== undefined) filter.timestep = parsedTimestep;

        const teamClusterId = await resolveSceneArtifactTeamCluster({
            trajectoryId,
            analysisId,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository
        });

        const artifacts = teamClusterId
            ? await this.listFromDaemon(teamClusterId, input, parsedTimestep)
            : await this.sceneArtifactRepository.findAll({
                filter,
                page: input.page,
                limit: input.limit,
                sort: { createdAt: -1 }
            });

        const normalizedArtifacts = artifacts.data.map((artifact) => {
            if ('props' in artifact) {
                return {
                    _id: artifact._id,
                    props: artifact.props
                } satisfies SceneArtifactDomainLike;
            }

            return toSceneArtifactRecord(artifact as DaemonSceneArtifact);
        });

        if (sourceType === 'plugin-exposure' && projection === 'renderable-exposures') {
            const data = projectRenderableExposures(normalizedArtifacts);

            return Result.ok({
                ...artifacts,
                total: data.length,
                data
            });
        }

        return Result.ok({
            ...artifacts,
            data: normalizedArtifacts.map(toSceneArtifactOutput)
        });
    }

    private async listFromDaemon(
        teamClusterId: string,
        input: ListTrajectorySceneArtifactsInputDTO,
        parsedTimestep?: number
    ): Promise<PaginatedResult<DaemonSceneArtifact>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Number(input.limit || 100));

        return this.teamClusterDaemonClient.command<PaginatedResult<DaemonSceneArtifact>>(
            teamClusterId,
            'plugin.scene-artifacts.list',
            {
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                sourceType: input.sourceType,
                timestep: parsedTimestep,
                page,
                limit
            }
        );
    }
};
