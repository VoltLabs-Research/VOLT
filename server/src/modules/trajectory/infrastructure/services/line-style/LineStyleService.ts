import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService, IAnalysisRepository, IPluginRepository } from '@shared/contracts/ports';
import type { PluginLike } from '@shared/contracts/types';
import { CLUSTER_ACCESS_TOKENS, COMPUTE_TOKENS } from '@shared/contracts/tokens';
import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { buildLineStyleObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import { stripTrailingZstdExtension } from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import { createHash } from 'node:crypto';

import type {
    CreateLineStyledModelResult,
    ILineStyleService,
    LineStyleSpec,
    LineStyleStreamResponse
} from '@modules/trajectory/domain/port/line-style/ILineStyleService';
import type { ITrajectoryNativeDaemonService } from '@modules/trajectory/domain/port/native/ITrajectoryNativeDaemonService';
import type { LineExportBaseOptions } from '@modules/trajectory/domain/contracts/native';

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

@Singleton(TRAJECTORY_TOKENS.LineStyleService)
export default class LineStyleService implements ILineStyleService {
    constructor(

        private readonly dumpStorage: TrajectoryDumpStorageService,

        private readonly sceneArtifactRepository: SceneArtifactRepository,

        private readonly trajectoryRepository: TrajectoryRepository,

        @inject(COMPUTE_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(COMPUTE_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository<PluginLike>,

        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService)
        private readonly teamClusterSelectionService: ITeamClusterSelectionService,

        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: ITrajectoryNativeDaemonService
    ) { }

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
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository,
            teamClusterSelectionService: this.teamClusterSelectionService,
            dumpStorage: this.dumpStorage,
            buildClusterRequiredError
        });

        const baseOptions = await this.resolveExportBaseOptions(analysisId, exposureId);
        const response = await this.trajectoryNativeDaemonService.exportLineModel({
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
        await recordSceneArtifact(this.sceneArtifactRepository, {
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
        const analysis = await this.analysisRepository.findById(String(analysisId));
        if (!analysis) {
            return undefined;
        }

        const plugin = await this.pluginRepository.findById(analysis.props.plugin);
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
        const artifact = await this.sceneArtifactRepository.findOne({
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

        return artifact.props.objectName;
    }

    private async streamModelObject(trajectoryId: string, objectName: string): Promise<LineStyleStreamResponse> {
        const trajectory = await this.trajectoryRepository.findById(String(trajectoryId));
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (!storageClusterId) {
            throw buildClusterRequiredError();
        }

        return this.trajectoryNativeDaemonService.getObjectStreamResponse(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.MODELS,
            objectName
        );
    }
};
