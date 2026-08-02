import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';

import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { FindOptionsWhere } from 'typeorm';
import type {
    ListTeamSceneArtifactsInput,
    ListTrajectorySceneArtifactsInput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

const LIST_DEFAULT_LIMIT = 100;

/** Exporters whose artifacts the canvas can actually render. */
const RENDERABLE_SCENE_EXPORTERS = new Set(['AtomisticExporter', 'MeshExporter', 'LineExporter']);

/**
 * Collapses plugin-exposure artifacts to the newest one per exposure and shapes
 * them as the renderable-layer descriptors the canvas consumes.
 */
const projectRenderableExposures = (artifacts: SceneArtifact[]) => {
    const byExposureId = new Map<string, SceneArtifact>();

    for (const artifact of artifacts) {
        const exposureId = artifact.params.exposureId;
        if (!exposureId) continue;
        if (!artifact.metadata.exporter || !RENDERABLE_SCENE_EXPORTERS.has(artifact.metadata.exporter)) continue;

        const current = byExposureId.get(exposureId);
        if (!current || new Date(artifact.updatedAt).getTime() > new Date(current.updatedAt).getTime()) {
            byExposureId.set(exposureId, artifact);
        }
    }

    return Array.from(byExposureId.entries())
        .map(([exposureId, artifact]) => {
            const metadata = artifact.metadata;
            const exposureName = metadata.exposureName?.trim();
            if (!artifact.plugin || !metadata.pluginId || !exposureName) return null;

            return {
                pluginId: metadata.pluginId,
                analysisId: artifact.analysis ?? undefined,
                exposureId,
                name: exposureName,
                icon: undefined,
                results: 'glb',
                canvas: true,
                raster: false,
                export: {
                    exporter: metadata.exporter,
                    type: metadata.exportType,
                    options: {}
                }
            };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
};

class SceneArtifactQueryService {
    async listByTrajectory(input: ListTrajectorySceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        const where: FindOptionsWhere<SceneArtifact> = { trajectory: input.trajectoryId };
        if (input.sourceType) where.sourceType = input.sourceType;
        if (input.analysisId) where.analysis = input.analysisId;
        if (input.timestep !== undefined) where.timestep = Number(input.timestep);

        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_DEFAULT_LIMIT });

        const [artifacts, total] = await SceneArtifact.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        if (input.sourceType === 'plugin-exposure' && input.projection === 'renderable-exposures') {
            const data = projectRenderableExposures(artifacts);
            return {
                ...paginate([data, total], pageRequest),
                total: data.length,
                data
            };
        }

        return paginate([artifacts.map((artifact) => artifact.toJSON()), total], pageRequest);
    }

    /**
     * Team-wide listing. Joins through the trajectory both to scope by team and
     * to expose the cluster names the storage column only references by id.
     */
    async listByTeam(input: ListTeamSceneArtifactsInput): Promise<PaginatedResult<unknown>> {
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_DEFAULT_LIMIT });

        const query = SceneArtifact.createQueryBuilder('artifact')
            .innerJoinAndSelect('artifact.trajectoryRef', 'trajectory')
            .leftJoinAndSelect('trajectory.storageClusterIdRef', 'trajectoryStorageCluster')
            .leftJoinAndSelect('artifact.storageClusterIdRef', 'artifactStorageCluster')
            .select([
                'artifact',
                'trajectory.id',
                'trajectory.name',
                'trajectory.storageClusterId',
                'trajectoryStorageCluster.id',
                'trajectoryStorageCluster.name',
                'artifactStorageCluster.id',
                'artifactStorageCluster.name'
            ])
            .where('trajectory.team = :teamId', { teamId: input.teamId });

        if (input.sourceType) {
            query.andWhere('artifact.sourceType = :sourceType', { sourceType: input.sourceType });
        }
        if (input.analysisId) {
            query.andWhere('artifact.analysis = :analysisId', { analysisId: input.analysisId });
        }
        if (input.timestep !== undefined) {
            query.andWhere('artifact.timestep = :timestep', { timestep: input.timestep });
        }

        const [artifacts, total] = await query
            .orderBy('artifact.updatedAt', 'DESC')
            .addOrderBy('artifact.id', 'DESC')
            .skip(skipFor(pageRequest))
            .take(pageRequest.limit)
            .getManyAndCount();

        return paginate([artifacts.map((artifact) => artifact.toJSON()), total], pageRequest);
    }
}

export default new SceneArtifactQueryService();
