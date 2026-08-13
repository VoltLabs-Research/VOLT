import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import PluginEntity from '@modules/plugin/models/Plugin';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import SceneArtifactEntity from '@modules/trajectory/models/SceneArtifact';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports/ITeamClusterObjectGatewayClient';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { GetPluginExposureExportInput } from '@shared/contracts/operations/GetPluginExposureExport';
import type {
    GetPluginExposureGLBInput,
    GetPluginExposureGLBOutput
} from '@shared/contracts/operations/GetPluginExposureGLB';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import type { SceneArtifactParams } from '@volt/contracts/modules/trajectory/domain';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import logger from '@shared/infrastructure/logger';
import type {
    GetPluginExposurePanelsResponse,
    PanelDocument,
    ResolvedPanelBlock
} from '@volt/contracts/modules/plugin/panel';

export interface GetPluginExposurePanelsInput {
    teamId: string;
    analysisId: string;
    timestep: number;
}

export interface GetPluginExposureChartInput {
    teamId: string;
    artifactId: string;
}

const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

const PANEL_EXPORTER = 'PanelExporter';
const SUPPORTED_PANEL_DOCUMENT_VERSION = 1;

/*
 * Ceilings on what one frame can hand the sidebar. A panel is a summary, so these sit far
 * above any honest use and exist only so a malformed run cannot make this endpoint expensive.
 */
const MAX_PANEL_DOCUMENTS = 32;
const MAX_PANEL_TOTAL_BYTES = 4 * 1024 * 1024;

const PANEL_BLOCK_KINDS = new Set(['table', 'chart', 'stat', 'omitted']);

const matchesExposureParams = (params: SceneArtifactParams | null | undefined, exposureId: string): boolean => {
    const entries = Object.entries(params ?? {}).filter(([, value]) => value !== undefined);

    return entries.length === 1
        && entries[0][0] === 'exposureId'
        && entries[0][1] === exposureId;
};

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
                extraHeaders: {
                    ...(response.contentEncoding === 'identity'
                        ? {}
                        : { 'X-Volt-Resource-Encoding': response.contentEncoding }),
                    ...(response.negotiatedContentEncoding
                        ? {
                            'Content-Encoding': response.negotiatedContentEncoding,
                            Vary: 'Accept-Encoding'
                        }
                        : {}),
                    ...(response.etag ? { ETag: response.etag } : {}),
                    ...(response.lastModified
                        ? { 'Last-Modified': response.lastModified.toUTCString() }
                        : {})
                }
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


    async getExposurePanels(input: GetPluginExposurePanelsInput): Promise<GetPluginExposurePanelsResponse>{
        const analysis = await this.#requireTeamAnalysis(input.analysisId, input.teamId);

        const artifacts = await SceneArtifactEntity.findBy({
            trajectory: analysis.trajectory,
            analysis: analysis.id,
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: input.timestep
        });

        /*
         * Filtered on the exporter, not on `params`. The two existing artifact lookups match
         * `params` exactly — one requires it to hold a single entry — which would exclude any
         * artifact that ever gains another param.
         */
        const panelArtifacts = artifacts
            .filter((artifact) => artifact.metadata?.exporter === PANEL_EXPORTER)
            .slice(0, MAX_PANEL_DOCUMENTS);

        const panels: PanelDocument[] = [];
        const unreadable: { exposureId: string; reason: string }[] = [];
        let totalBytes = 0;

        for(const artifact of panelArtifacts){
            const exposureId = artifact.metadata?.exposureId ?? artifact.objectName;

            if(!artifact.storageClusterId){
                unreadable.push({
                    exposureId,
                    reason: 'The artifact has no storage cluster'
                });
                continue;
            }

            try{
                const buffer = await this.#objectGatewayClient.getBuffer(
                    artifact.storageClusterId,
                    artifact.storageBucket,
                    artifact.objectName
                );

                totalBytes += buffer.byteLength;
                if(totalBytes > MAX_PANEL_TOTAL_BYTES){
                    unreadable.push({
                        exposureId,
                        reason: 'Panel documents for this frame exceed the size limit'
                    });
                    break;
                }

                panels.push(this.#parseDocument(buffer, exposureId));
            }catch(error){
                /*
                 * One unreadable panel is reported and the rest are still served: a frame
                 * whose second table failed to upload should still show its first.
                 */
                logger.warn(`Panel document unreadable analysisId=${analysis.id} exposureId=${exposureId}: ${String(error)}`);
                unreadable.push({
                    exposureId,
                    reason: error instanceof ApplicationError ? error.message : 'The panel document could not be read'
                });
            }
        }

        return {
            analysisId: analysis.id,
            timestep: input.timestep,
            panels,
            ...(unreadable.length > 0 ? { unreadable } : {})
        };
    }

    #parseDocument(buffer: Buffer, exposureId: string): PanelDocument{
        const parsed = JSON.parse(buffer.toString('utf8')) as Partial<PanelDocument>;

        if(parsed.version !== SUPPORTED_PANEL_DOCUMENT_VERSION){
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_EXPOSURE_PANEL_UNSUPPORTED_VERSION,
                `Panel document version ${String(parsed.version)} is not supported`
            );
        }

        if(!Array.isArray(parsed.blocks)){
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_EXPOSURE_PANEL_UNSUPPORTED_VERSION,
                'Panel document declares no blocks'
            );
        }

        /*
         * A block kind this server does not know is dropped rather than forwarded: the
         * client switches exhaustively on kind, and an unknown one would reach its default.
         */
        const blocks = parsed.blocks.filter((block): block is ResolvedPanelBlock => {
            return Boolean(block) && PANEL_BLOCK_KINDS.has((block as ResolvedPanelBlock).kind);
        });

        return {
            version: SUPPORTED_PANEL_DOCUMENT_VERSION,
            exposureId: parsed.exposureId ?? exposureId,
            exposureName: parsed.exposureName ?? '',
            timestep: parsed.timestep ?? 0,
            ...(parsed.title ? { title: parsed.title } : {}),
            blocks
        };
    }

    async #requireTeamAnalysis(analysisId: string, teamId: string): Promise<AnalysisEntity> {
        const analysis = await AnalysisEntity.findOneBy({ id: analysisId });

        if (!analysis || analysis.team !== teamId) {
            throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
        }

        return analysis;
    }
}
