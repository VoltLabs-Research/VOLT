import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService, IPluginRepository } from '@shared/contracts/ports';
import type { PluginLike } from '@shared/contracts/types';
import { CLUSTER_ACCESS_TOKENS, COMPUTE_TOKENS } from '@shared/contracts/tokens';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { buildLineStyleObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { stripTrailingZstdExtension } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { container as diContainer } from 'tsyringe';

import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import trajectoryNativeDaemonService from '@modules/trajectory/services/native/TrajectoryNativeDaemonService';
import { createHash } from 'node:crypto';

import type { LineExportBaseOptions, LineStyleParams } from '@modules/trajectory/contracts/native';
import { Readable } from 'node:stream';

export type LineStyleSpec = LineStyleParams;

export interface CreateLineStyledModelResult {
    objectName: string;
    entitiesRendered: number;
    entitiesTotal: number;
    categoryCounts: Record<string, number>;
}

export interface LineStyleStreamResponse {
    stream: Readable;
    contentEncoding?: string;
    contentLength?: number;
}

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

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

export const hashLineStyle = (style: LineStyleSpec): string => {
    return createHash('sha1').update(stableStringify(style)).digest('hex').slice(0, 16);
};

export class LineStyleService {
    #pluginRepositoryCache?: IPluginRepository<PluginLike>;
    private get pluginRepository(): IPluginRepository<PluginLike> {
        return (this.#pluginRepositoryCache ??= diContainer.resolve<IPluginRepository<PluginLike>>(COMPUTE_TOKENS.PluginRepository));
    }

    #teamClusterSelectionServiceCache?: ITeamClusterSelectionService;
    private get teamClusterSelectionService(): ITeamClusterSelectionService {
        return (this.#teamClusterSelectionServiceCache ??= diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService));
    }

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
        const analysis = await AnalysisModel.findById(String(analysisId));
        if (!analysis) {
            return undefined;
        }

        const plugin = await this.pluginRepository.findById(analysis.plugin.toString());
        const exposures = Array.isArray(plugin?.props.exposures) ? plugin.props.exposures : [];
        const exposure = exposures.find((candidate: { _id?: unknown }) => (
            typeof candidate === 'object'
            && candidate !== null
            && String(candidate._id) === String(exposureId)
        )) as { export?: { options?: LineExportBaseOptions } | null } | undefined;

        return exposure?.export?.options ?? undefined;
    }

    private async resolveExposureGlbObjectName(
        trajectoryId: string,
        analysisId: string,
        timestep: string | number,
        exposureId: string
    ): Promise<string> {
        const artifact = await SceneArtifactModel.findOne({
            trajectory: String(trajectoryId),
            analysis: String(analysisId),
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: Number(timestep),
            params: { exposureId: String(exposureId) }
        });

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                `No baked GLB found for exposure "${exposureId}" at timestep ${timestep}`
            );
        }

        return artifact.objectName;
    }

    private async streamModelObject(trajectoryId: string, objectName: string): Promise<LineStyleStreamResponse> {
        const trajectory = await TrajectoryModel.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId?.toString() })
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
