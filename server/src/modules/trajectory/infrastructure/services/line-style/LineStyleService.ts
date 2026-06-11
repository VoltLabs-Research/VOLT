import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { SceneArtifactSourceType } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';
import { recordSceneArtifact } from '@modules/trajectory/utilities/scene-artifacts/record-scene-artifact';
import { resolveSceneArtifactExecutionContext } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-execution-context';
import { buildLineStyleObjectName } from '@modules/trajectory/utilities/trajectory/minio-path-builder';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
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
import type { LineExportBaseOptions } from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

// Key-sorted stringify so equal styles always map to the same object name —
// the styled GLB cache in MinIO falls out of the path being deterministic.
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

        private readonly analysisRepository: AnalysisRepository,

        private readonly pluginRepository: PluginRepository,

        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService
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

        return this.streamModelObject(trajectoryId, `${objectName}.ranges.json`);
    }

    // The export node options declared in the plugin definition (colorBy,
    // propertyColors, material) are the daemon's styling baseline.
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
