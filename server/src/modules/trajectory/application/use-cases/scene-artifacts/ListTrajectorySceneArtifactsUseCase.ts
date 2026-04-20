import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

import type { ListTrajectorySceneArtifactsInputDTO } from '@modules/trajectory/application/dtos/scene-artifacts/ListTrajectorySceneArtifactsDTO';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type SceneArtifact from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { IUseCase } from '@shared/application/IUseCase';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

interface SceneArtifactOutput {
    _id: string;
    trajectory: string;
    storageClusterId?: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactProps['sourceType'];
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactProps['params'];
    displayName: string;
    status: SceneArtifactProps['status'];
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
};

const toOutput = (artifact: SceneArtifact): SceneArtifactOutput => ({
    _id: artifact._id,
    ...artifact.props
});

const projectRenderableExposures = (artifacts: SceneArtifact[]) => {
    const byExposureId = new Map<string, SceneArtifact>();

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
export class ListTrajectorySceneArtifactsUseCase implements IUseCase<ListTrajectorySceneArtifactsInputDTO, PaginatedResult<unknown>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(input: ListTrajectorySceneArtifactsInputDTO) {
        const { trajectoryId, sourceType, analysisId, projection, timestep } = input;
        const parsedTimestep = timestep !== undefined ? Number(timestep) : undefined;

        const filter: Record<string, unknown> = { trajectory: trajectoryId };
        if (sourceType) filter.sourceType = sourceType;
        if (analysisId) filter.analysis = analysisId;
        if (parsedTimestep !== undefined) filter.timestep = parsedTimestep;

        const result = await this.sceneArtifactRepository.findAll({
            filter,
            page: input.page,
            limit: input.limit,
            sort: { createdAt: -1 }
        });

        if (sourceType === 'plugin-exposure' && projection === 'renderable-exposures') {
            const data = projectRenderableExposures(result.data);

            return Result.ok({
                ...result,
                total: data.length,
                data
            });
        }

        return Result.ok({
            ...result,
            data: result.data.map(toOutput)
        });
    }
};
