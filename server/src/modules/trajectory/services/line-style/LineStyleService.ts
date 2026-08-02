import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import {
    recordSceneArtifact,
    resolveSceneArtifactExecutionContext
} from '@modules/trajectory/services/SceneArtifactService';
import { stripTrailingZstdExtension } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';

import AnalysisEntity from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import { createHash } from 'node:crypto';

import type { LineExportBaseOptions, LineStyleParams } from '@modules/trajectory/services/native/TrajectoryNativeTypes';
import { Readable } from 'node:stream';

export type LineStyleSpec = LineStyleParams;

export interface CreateLineStyledModelResult {
    objectName: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

interface LineStyleStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}

const buildLineStyleObjectName = (
    trajectoryId: string,
    analysisId: string,
    timestep: string | number,
    exposureId: string,
    styleHash: string
): string => {
    return `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/line-style/${exposureId}/${styleHash}.glb.zst`;
};

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

/**
 * Deliberately NOT shared with the same-looking `stableStringify` in
 * `WorkflowProjection`. This one feeds `hashLineStyle`, and that digest is
 * embedded in the MinIO object name of every styled GLB, so it is a storage
 * key. The two copies already disagree: this one sorts keys with `localeCompare`
 * and drops `undefined` entries, the other uses the default `.sort()` and
 * serializes them as `null`. Merging them rewrites one hash family and orphans
 * every artifact already baked under the old keys.
 */
const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
    }
    return JSON.stringify(value);
};

const hashLineStyle = (style: LineStyleSpec): string => {
    return createHash('sha1').update(stableStringify(style)).digest('hex').slice(0, 16);
};

class LineStyleService {
    private readonly teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    async createStyledModel(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: LineStyleSpec
    ): Promise<CreateLineStyledModelResult> {
        const objectName = buildLineStyleObjectName(
            trajectoryId,
            analysisId,
            timestep,
            exposureId,
            hashLineStyle(style)
        );
        const {
            computeClusterId,
            storageClusterId
        } = await resolveSceneArtifactExecutionContext({
            trajectoryId: String(trajectoryId),
            timestep: String(timestep),
            analysisId,
            teamClusterSelectionService: this.teamClusterSelectionService,
            dumpStorage: trajectoryDumpStorageService,
            buildClusterRequiredError
        });

        const baseOptions = await this.resolveExportBaseOptions(analysisId, exposureId);
        const response = await trajectoryNativeDaemonService.exportLineModel({
            teamClusterId: computeClusterId,
            trajectoryId: String(trajectoryId),
            timestep: Number(timestep),
            analysisId: String(analysisId),
            exposureId: String(exposureId),
            objectKey: objectName,
            ownerClusterId: storageClusterId,
            ...(baseOptions ? { baseOptions } : {}),
            style
        });

        const colorMode = style.colorMode ?? 'category';
        const lineWidthLabel = style.lineWidth !== undefined ? ` · w=${style.lineWidth}` : '';
        await recordSceneArtifact({
            trajectory: String(trajectoryId),
            storageClusterId,
            analysis: String(analysisId),
            sourceType: SceneArtifactSourceType.LineStyle,
            timestep: Number(timestep),
            objectName,
            params: {
                exposureId: String(exposureId),
                style: style as Record<string, unknown>
            },
            displayName: `Lines · ${colorMode}${lineWidthLabel} · t=${timestep}`,
            metadata: {
                analysisId: String(analysisId),
                exposureId: String(exposureId),
                entitiesRendered: response.entitiesRendered,
                entitiesTotal: response.entitiesTotal,
                categoryCounts: response.categoryCounts
            }
        });

        return {
            objectName,
            entitiesRendered: response.entitiesRendered,
            entitiesTotal: response.entitiesTotal,
            categoryCounts: response.categoryCounts
        };
    }

    async getModelStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style: LineStyleSpec
    ): Promise<LineStyleStreamResponse> {
        const objectName = buildLineStyleObjectName(
            trajectoryId,
            analysisId,
            timestep,
            exposureId,
            hashLineStyle(style)
        );

        return this.streamModelObject(trajectoryId, objectName);
    }

    async getRangesStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string,
        style?: LineStyleSpec
    ): Promise<LineStyleStreamResponse> {
        const objectName = style
            ? buildLineStyleObjectName(trajectoryId, analysisId, timestep, exposureId, hashLineStyle(style))
            : await this.resolveExposureGlbObjectName(trajectoryId, analysisId, timestep, exposureId);

        return this.streamModelObject(trajectoryId, `${stripTrailingZstdExtension(objectName)}.ranges.json`);
    }

    async getOctreeMetadataStreamResponse(
        trajectoryId: string,
        timestep: string | number,
        analysisId: string,
        exposureId: string
    ): Promise<LineStyleStreamResponse> {
        const objectName = await this.resolveExposureGlbObjectName(trajectoryId, analysisId, timestep, exposureId);

        return this.streamModelObject(trajectoryId, `${stripTrailingZstdExtension(objectName)}.octree.json`);
    }

    private async resolveExportBaseOptions(
        analysisId: string,
        exposureId: string
    ): Promise<LineExportBaseOptions | undefined> {
        const analysis = await AnalysisEntity.findOneBy({ id: String(analysisId) });
        if (!analysis) {
            return undefined;
        }

        const pluginEntity = await PluginEntity.findOneBy({ id: analysis.plugin });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
        const exposures = plugin?.props.exposures ?? [];
        const exposure = exposures.find((candidate) => candidate._id === exposureId);

        return exposure?.export?.options as LineExportBaseOptions | undefined;
    }

    private async resolveExposureGlbObjectName(
        trajectoryId: string,
        analysisId: string,
        timestep: string | number,
        exposureId: string
    ): Promise<string> {
        const artifact = await SceneArtifact.createQueryBuilder('artifact')
            .where('artifact.trajectory = :trajectory', { trajectory: String(trajectoryId) })
            .andWhere('artifact.analysis = :analysis', { analysis: String(analysisId) })
            .andWhere('artifact.sourceType = :sourceType', { sourceType: SceneArtifactSourceType.PluginExposure })
            .andWhere('artifact.timestep = :timestep', { timestep: Number(timestep) })
            .andWhere('artifact.params = :params', { params: JSON.stringify({ exposureId: String(exposureId) }) })
            .getOne();

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                `No baked GLB found for exposure "${exposureId}" at timestep ${timestep}`
            );
        }

        return artifact.objectName;
    }

    private async streamModelObject(trajectoryId: string, objectName: string): Promise<LineStyleStreamResponse> {
        const trajectory = await Trajectory.findOneBy({ id: String(trajectoryId) });
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId })
            : undefined;

        if (!storageClusterId) {
            throw buildClusterRequiredError();
        }

        return trajectoryNativeDaemonService.getObjectStreamResponse(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }
}

export default new LineStyleService();
