import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import type { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/SceneArtifact';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import normalizePerAtomProperties from '@shared/infrastructure/utilities/normalize-per-atom-properties';


export interface ListTrajectorySceneArtifactsInput {
    trajectoryId: string;
    sourceType?: SceneArtifactSourceType;
    analysisId?: string;
    projection?: 'raw' | 'renderable-exposures';
    timestep?: number;
    page?: number;
    limit?: number;
}

@injectable()
export class ListTrajectorySceneArtifactsUseCase implements IUseCase<ListTrajectorySceneArtifactsInput, PaginatedResult<any>, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ) {}

    async execute(input: ListTrajectorySceneArtifactsInput) {
        const {
            trajectoryId,
            sourceType,
            analysisId,
            projection,
            timestep
        } = input;
        const page = Number(input.page ?? 1);
        const limit = Number(input.limit ?? 50);
        const parsedTimestep = timestep !== undefined ? Number(timestep) : undefined;

        const filter: Record<string, unknown> = {
            trajectory: trajectoryId
        };

        if (sourceType) filter.sourceType = sourceType;
        if (analysisId) filter.analysis = analysisId;
        if (parsedTimestep !== undefined) filter.timestep = parsedTimestep;

        const artifacts = await this.sceneArtifactRepository.findAll({
            filter,
            page,
            limit,
            sort: { createdAt: -1 }
        });

        if (sourceType === 'plugin-exposure' && projection === 'renderable-exposures') {
            const byExposureId = new Map<string, any>();

            for (const artifact of artifacts.data) {
                const exposureId = artifact.props.params?.exposureId;
                if (!exposureId) continue;

                const current = byExposureId.get(exposureId);
                if (!current) {
                    byExposureId.set(exposureId, artifact);
                    continue;
                }

                const artifactUpdatedAt = new Date(artifact.props.updatedAt).getTime();
                const currentUpdatedAt = new Date(current.props.updatedAt).getTime();
                if (artifactUpdatedAt > currentUpdatedAt) {
                    byExposureId.set(exposureId, artifact);
                }
            }

            const data = Array.from(byExposureId.values())
                .filter((artifact) => {
                    const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
                    return typeof artifact.props.plugin === 'string'
                        && artifact.props.plugin.length > 0
                        && typeof metadata?.pluginSlug === 'string'
                        && metadata.pluginSlug.length > 0;
                })
                .map((artifact) => {
                    const metadata = artifact.props.metadata as Record<string, unknown> | undefined;
                    const pluginId = artifact.props.plugin as string;
                    const exposureName = typeof metadata?.exposureName === 'string'
                        ? metadata.exposureName.trim()
                        : '';
                    const perAtomProperties = normalizePerAtomProperties(metadata?.perAtomProperties);

                    if (!exposureName) return null;

                    return {
                        pluginId,
                        pluginSlug: metadata!.pluginSlug as string,
                        analysisId: artifact.props.analysis,
                        exposureId: String(artifact.props.params.exposureId),
                        name: exposureName,
                        icon: undefined,
                        results: 'glb',
                        canvas: true,
                        raster: false,
                        perAtomProperties,
                        export: {
                            exporter: typeof metadata?.exporter === 'string' ? metadata.exporter : undefined,
                            type: typeof metadata?.exportType === 'string' ? metadata.exportType : undefined,
                            options: {}
                        }
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            return Result.ok({
                ...artifacts,
                total: data.length,
                data
            });
        }

        return Result.ok({
            ...artifacts,
            data: artifacts.data.map((artifact) => ({
                _id: artifact.id,
                ...artifact.props
            }))
        });
    }
}
