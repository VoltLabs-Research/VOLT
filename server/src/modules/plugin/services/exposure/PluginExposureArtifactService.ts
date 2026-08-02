import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import SceneArtifactEntity from '@modules/trajectory/models/SceneArtifact';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { GetPluginExposureExportInput } from '@shared/contracts/operations/GetPluginExposureExport';
import type {
    GetPluginExposureGLBInput,
    GetPluginExposureGLBOutput
} from '@shared/contracts/operations/GetPluginExposureGLB';
import { SceneArtifactSourceType } from '@shared/contracts/types';
import type { SceneArtifactParams } from '@shared/contracts/types/SceneArtifact';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import logger from '@shared/infrastructure/logger';

export interface GetPluginExposureChartInput {
    teamId: string;
    artifactId: string;
}

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * A GLB artifact belongs to exactly one exposure, so its params must name that
 * exposure and nothing else — a broader match would serve another exposure's model.
 */
const matchesExposureParams = (params: SceneArtifactParams | null | undefined, exposureId: string): boolean => {
    const entries = Object.entries(params ?? {}).filter(([, value]) => value !== undefined);

    return entries.length === 1
        && entries[0][0] === 'exposureId'
        && entries[0][1] === exposureId;
};

/**
 * Serves the artifacts a plugin exposure produced: the GLB model the canvas
 * renders, the chart PNG, and the downloadable bundle of everything an analysis
 * exposed.
 */
export default class PluginExposureArtifactService {
    #exposureExportService: PluginExposureExportService;
    #objectGatewayClient: ITeamClusterObjectGatewayClient;

    constructor(
        objectGatewayClient: ITeamClusterObjectGatewayClient,
        exposureExportService: PluginExposureExportService
    ) {
        this.#objectGatewayClient = objectGatewayClient;
        this.#exposureExportService = exposureExportService;
    }

    async getExposureGLB(input: GetPluginExposureGLBInput): Promise<GetPluginExposureGLBOutput> {
        await this.#requireTeamAnalysis(input.analysisId, input.teamId);

        const artifactCandidates = await SceneArtifactEntity.findBy({
            trajectory: input.trajectoryId,
            analysis: input.analysisId,
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: Number(input.timestep)
        });

        const artifact = artifactCandidates.find((candidate) =>
            matchesExposureParams(candidate.params, input.exposureId));

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        }

        try {
            const response = await getClusterGlbStream(
                this.#objectGatewayClient,
                artifact.storageClusterId,
                artifact.objectName,
                { acceptEncoding: input.acceptEncoding }
            );

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'model/gltf-binary',
                contentLength: response.size,
                disposition: 'inline',
                filename: response.objectName,
                cacheControl: IMMUTABLE_CACHE_CONTROL,
                extraHeaders: response.contentEncoding === 'identity'
                    ? {}
                    : { 'X-Volt-Resource-Encoding': response.contentEncoding }
            });
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                    ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
                );
            }

            if (error instanceof ApplicationError && error.statusCode < HttpStatus.InternalServerError) {
                throw error;
            }

            logger.error(error, `Unexpected failure reading plugin exposure GLB teamClusterId=${artifact.storageClusterId} objectName=${artifact.objectName}`);

            throw ApplicationError.internalServerError(
                'Failed to read plugin exposure GLB from team cluster daemon'
            );
        }
    }

    async getExposureChart(input: GetPluginExposureChartInput): Promise<DownloadStreamOutput> {
        const artifact = await SceneArtifactEntity.findOneBy({ id: input.artifactId });
        if (!artifact || artifact.sourceType !== SceneArtifactSourceType.PluginExposure) {
            throw ApplicationError.notFound(ErrorCodes.FILE_NOT_FOUND, 'File not found');
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: artifact.trajectory });
        if (!trajectory || trajectory.team !== input.teamId) {
            throw ApplicationError.notFound(ErrorCodes.FILE_NOT_FOUND, 'File not found');
        }

        const isChart = artifact.objectName.endsWith('.png')
            && (artifact.metadata.exporter === 'ChartExporter' || artifact.metadata.exportType === 'chart-png');
        if (!isChart) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_EXPOSURE_CHART_UNSUPPORTED_ARTIFACT,
                'Scene artifact is not a plugin chart'
            );
        }

        try {
            const response = await this.#objectGatewayClient.getStream(
                artifact.storageClusterId,
                artifact.storageBucket,
                artifact.objectName
            );

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'image/png',
                contentLength: response.contentLength,
                disposition: 'inline',
                filename: artifact.displayName || 'plugin-chart.png',
                cacheControl: IMMUTABLE_CACHE_CONTROL
            });
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(ErrorCodes.FILE_NOT_FOUND, 'File not found');
            }

            throw ApplicationError.internalServerError(
                'Failed to read plugin chart from team cluster daemon'
            );
        }
    }

    async getExposureExport(input: GetPluginExposureExportInput): Promise<DownloadStreamOutput> {
        const analysis = await this.#requireTeamAnalysis(input.analysisId, input.teamId);
        const pluginEntity = await PluginEntity.findOneBy({ id: analysis.plugin });
        const pluginName = pluginEntity
            ? toPluginLike(pluginEntity).props.modifier?.name || analysis.plugin
            : analysis.plugin;

        return this.#exposureExportService.exportAnalysisExposureBundle({
            analysisId: input.analysisId,
            trajectoryId: analysis.trajectory,
            pluginName
        });
    }

    async #requireTeamAnalysis(analysisId: string, teamId: string): Promise<AnalysisEntity> {
        const analysis = await AnalysisEntity.findOneBy({ id: analysisId });

        if (!analysis || analysis.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        return analysis;
    }
}
