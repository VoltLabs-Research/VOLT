import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { buildClusterRequiredError } from '@modules/trajectory/services/SceneArtifactService';
import { stripTrailingZstdExtension } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import ApplicationError from '@shared/application/errors/ApplicationError';

import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';

import { Readable } from 'node:stream';

interface OctreeStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}

/**
 * Streams the LOD octree metadata baked next to an exposure's GLB.
 *
 * Extracted from the retired LineStyleService: styled-model creation is gone, but
 * the octree sidecar is what lets large exposures stream progressively, and the
 * `lodOctreeMetadata` route still serves it.
 */
class ExposureOctreeService {
    async getOctreeMetadataStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string
    ): Promise<OctreeStreamResponse> {
        const objectName = await this.resolveExposureGlbObjectName(trajectoryId, analysisId, timestep, exposureId);

        return this.streamModelObject(trajectoryId, `${stripTrailingZstdExtension(objectName)}.octree.json`);
    }

    private async resolveExposureGlbObjectName(
        trajectoryId: string,
        analysisId: string,
        timestep: string | number,
        exposureId: string
    ): Promise<string> {
        const artifact = await SceneArtifact.createQueryBuilder('artifact')
            .where('artifact.trajectory = :trajectory', { trajectory: trajectoryId })
            .andWhere('artifact.analysis = :analysis', { analysis: analysisId })
            .andWhere('artifact.sourceType = :sourceType', { sourceType: SceneArtifactSourceType.PluginExposure })
            .andWhere('artifact.timestep = :timestep', { timestep: Number(timestep) })
            .andWhere('artifact.params = :params', { params: JSON.stringify({ exposureId }) })
            .getOne();

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                `No baked GLB found for exposure "${exposureId}" at timestep ${timestep}`
            );
        }

        return artifact.objectName;
    }

    private async streamModelObject(trajectoryId: string, objectName: string): Promise<OctreeStreamResponse> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if (!trajectory) {
            throw buildClusterRequiredError();
        }

        return trajectoryNativeDaemonService.getObjectStreamResponse(
            trajectory.storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }
}

export default new ExposureOctreeService();
