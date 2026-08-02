import { ErrorCodes } from '@core/constants/error-codes';

import AnalysisEntity from '@modules/analysis/models/Analysis';
import { AnalysisRelation } from '@modules/analysis/contracts/analysis';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import { toAnalysisLike } from '@modules/analysis/services/AnalysisQueries';

import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import PluginService from '@modules/plugin/services/PluginService';
import RasterService from '@modules/raster/services/RasterService';
import SimulationCellService from '@modules/simulation-cell/services/SimulationCellService';
import { isTeamMember } from '@modules/team/services/team/team-membership-guard';

import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import { PublicCanvasAccessMode } from '@modules/trajectory/services/TrajectoryServiceTypes';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import TrajectoryAccessGuard from '@modules/trajectory/services/trajectory/TrajectoryAccessGuard';
import {
    ANALYSIS_LIST_MAX_LIMIT,
    findAnalyses
} from '@modules/trajectory/services/trajectory/TrajectoryQueries';
import { getTrajectoryFrames, readTrajectoryPreview } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import { createPreviewOutput } from '@modules/trajectory/services/trajectory/TrajectoryPreviewService';
import { buildTrajectoryGlbObjectName } from '@modules/trajectory/services/trajectory/TrajectoryStoragePaths';

import ApplicationError from '@shared/application/errors/ApplicationError';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';

import type Trajectory from '@modules/trajectory/models/Trajectory';
import type { TrajectoryFrame } from '@shared/contracts/types/Trajectory';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import type { StreamableOutput } from '@shared/contracts/types/StreamableOutput';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type {
    CreateColoredModelInput,
    GetAtomsColumnarOutput,
    GetColorCodingPropertiesOutput,
    GetColorCodingStatsInput,
    GetColorCodingStatsOutput,
    GetFilteredModelStreamInput,
    GetParticleFilterPropertiesOutput,
    GetParticleFilterUniqueValuesInput,
    GetParticleFilterUniqueValuesOutput,
    GetPublicCanvasBootstrapOutput,
    GetPublicCanvasGLBInput,
    GetPublicCanvasGLBOutput,
    GetPublicCanvasRasterFrameInput,
    ListTrajectorySceneArtifactsInput,
    PreviewParticleFilterInput,
    PreviewParticleFilterOutput,
    PublicCanvasBootstrapTrajectoryView,
    TrajectoryExposureScope,
    TrajectoryPreviewResult,
    TrajectoryRecord
} from '@modules/trajectory/services/TrajectoryServiceTypes';
import type { GetAnalysesByTrajectoryIdOutput } from '@shared/contracts/operations/GetAnalysesByTrajectoryId';
import type { GetAnalysisFrameLogOutput } from '@shared/contracts/operations/GetAnalysisFrameLog';
import type { GetRasterMetadataOutput } from '@shared/contracts/operations/GetRasterMetadata';
import type { GetSimulationCellByTrajectoryOutput } from '@shared/contracts/operations/GetSimulationCellByTrajectory';
import type {
    GetPluginByIdOutput,
    GetPluginExposureGLBOutput,
    GetPluginListingDocumentsOutput,
    GetSubListingOutput
} from '@shared/contracts/operations';

/** Every canvas call is trajectory-scoped; the viewer may be an anonymous guest. */
interface PublicCanvasRequest{
    trajectoryId: string;
    userId?: string;
}

type Guest<TInput> = TInput & { userId?: string };

interface AnalysisScopedRequest extends PublicCanvasRequest{
    analysisId: string;
}

/**
 * Object-storage misses surface as driver errors; the canvas reports them as a
 * plain 404 rather than leaking a 500.
 */
const notFound = (error: unknown, message: string): never => {
    if(error instanceof ApplicationError) throw error;
    throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, message, 404);
};

/**
 * Read-only canvas surface reachable without team membership. Every entry point
 * authorizes through TrajectoryAccessGuard and then delegates to the owning service.
 */
export default class PublicCanvasService{
    #access = new TrajectoryAccessGuard();
    #trajectories = new TrajectoryService();
    #plugins = new PluginService();
    #raster = new RasterService();
    #simulationCells = new SimulationCellService();

    async bootstrap(input: PublicCanvasRequest): Promise<GetPublicCanvasBootstrapOutput>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);
        const frames = await getTrajectoryFrames(trajectory.id);

        return {
            access: {
                mode: PublicCanvasAccessMode.ReadOnly,
                isGuest: !input.userId,
                isPublic: trajectory.isPublic,
                hasTeamMembership: await this.#hasTeamMembership(trajectory.team, input.userId)
            },
            trajectory: this.#toBootstrapTrajectory(trajectory, frames)
        };
    }

    async trajectory(input: PublicCanvasRequest): Promise<TrajectoryRecord>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getById({ trajectoryId: input.trajectoryId });
    }

    async preview(input: PublicCanvasRequest): Promise<TrajectoryPreviewResult>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);

        const preview = await readTrajectoryPreview({
            trajectoryId: input.trajectoryId,
            storageClusterId: trajectory.storageClusterId,
            objectGatewayClient,
            createOutput: createPreviewOutput
        });
        if(!preview) throw new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404);

        return preview;
    }

    async rasterFrame(input: GetPublicCanvasRasterFrameInput): Promise<DownloadStreamOutput>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#raster.getRasterFramePNG({
            trajectoryId: input.trajectoryId,
            teamId: trajectory.team,
            timestep: input.timestep,
            analysisId: input.analysisId,
            model: input.model
        });
    }

    async rasterMetadata(input: PublicCanvasRequest): Promise<GetRasterMetadataOutput>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#raster.getRasterMetadata({
            trajectoryId: input.trajectoryId,
            teamId: trajectory.team
        });
    }

    async dump(input: PublicCanvasRequest & { timestep: string }): Promise<DownloadStreamOutput>{
        try{
            await this.#access.assertReadable(input.trajectoryId, input.userId);

            const response = await trajectoryDumpStorageService.getDumpResponse(input.trajectoryId, input.timestep);
            const isZstd = response.contentEncoding === 'zstd';

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'application/octet-stream',
                filename: isZstd
                    ? `timestep-${input.timestep}.dump.zst`
                    : `timestep-${input.timestep}.dump`,
                disposition: 'inline',
                contentLength: response.contentLength,
                extraHeaders: response.contentEncoding
                    ? { 'X-Volt-Resource-Encoding': response.contentEncoding }
                    : {},
                cacheControl: 'public, max-age=31536000, immutable'
            });
        }catch(error){
            return notFound(error, 'Trajectory dump not found');
        }
    }

    async glb(input: GetPublicCanvasGLBInput): Promise<GetPublicCanvasGLBOutput>{
        try{
            const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);

            return await getClusterGlbStream(
                objectGatewayClient,
                trajectory.storageClusterId,
                buildTrajectoryGlbObjectName(input.trajectoryId, input.timestep),
                { acceptEncoding: input.acceptEncoding }
            );
        }catch(error){
            return notFound(error, 'GLB model not found');
        }
    }

    async listAnalyses(input: PublicCanvasRequest & { page?: number; limit?: number }): Promise<GetAnalysesByTrajectoryIdOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);

        const analyses = await findAnalyses({
            where: { trajectory: input.trajectoryId },
            relations: [AnalysisRelation.Trajectory, AnalysisRelation.Plugin],
            page: input.page,
            limit: input.limit,
            order: { createdAt: 'DESC' }
        });

        const data = analyses.data.map((entity) => {
            const analysis = toAnalysisLike(entity);
            return {
                ...analysis.props,
                _id: analysis._id,
                plugin: analysis.props.plugin
            };
        });

        return {
            ...analyses,
            data
        } as unknown as GetAnalysesByTrajectoryIdOutput;
    }

    async simulationCell(input: PublicCanvasRequest & { timestep?: number }): Promise<GetSimulationCellByTrajectoryOutput>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#simulationCells.getByTrajectory({
            teamId: trajectory.team,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep
        });
    }

    async listSceneArtifacts(input: Guest<ListTrajectorySceneArtifactsInput>): Promise<PaginatedResult<unknown>>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getSceneArtifacts(input);
    }

    async colorCodingProperties(input: Guest<TrajectoryExposureScope>): Promise<GetColorCodingPropertiesOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getColorCodingProperties(input);
    }

    async colorCodingStats(input: Guest<GetColorCodingStatsInput>): Promise<GetColorCodingStatsOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getColorCodingStats(input);
    }

    async coloredModelStream(input: Guest<CreateColoredModelInput>): Promise<StreamableOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getColoredModelStream(input);
    }

    async particleFilterProperties(input: Guest<TrajectoryExposureScope>): Promise<GetParticleFilterPropertiesOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getParticleFilterProperties(input);
    }

    async particleFilterUniqueValues(
        input: Guest<GetParticleFilterUniqueValuesInput>
    ): Promise<GetParticleFilterUniqueValuesOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getParticleFilterUniqueValues(input);
    }

    async particleFilterPreview(input: Guest<PreviewParticleFilterInput>): Promise<PreviewParticleFilterOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.previewParticleFilter(input);
    }

    async filteredModelStream(input: Guest<GetFilteredModelStreamInput>): Promise<StreamableOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getFilteredModelStream(input);
    }

    async atoms(input: PublicCanvasRequest & {
        analysisId?: string;
        timestep: number;
        page?: number;
        limit?: number;
    }): Promise<GetAtomsColumnarOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        return this.#trajectories.getAtoms(input);
    }

    async plugin(input: PublicCanvasRequest & { pluginId: string }): Promise<GetPluginByIdOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);

        const analyses = await findAnalyses({
            where: { trajectory: input.trajectoryId },
            limit: ANALYSIS_LIST_MAX_LIMIT
        });
        const pluginAttached = analyses.data.some((analysis) => analysis.plugin === input.pluginId);
        if(!pluginAttached) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');

        return this.#plugins.getPluginById({ pluginId: input.pluginId });
    }

    async pluginListing(input: PublicCanvasRequest & {
        pluginId: string;
        exposureName?: string;
        exposureId?: string;
        analysisId?: string;
        page?: number;
        limit?: number;
        sortAsc?: boolean;
    }): Promise<GetPluginListingDocumentsOutput>{
        const trajectory = await this.#access.assertReadable(input.trajectoryId, input.userId);
        if(input.analysisId) await this.#requireOwnedAnalysis(input.analysisId, input.trajectoryId, input.pluginId);

        return this.#plugins.getPluginListingDocuments({
            pluginId: input.pluginId,
            exposureName: input.exposureName,
            exposureId: input.exposureId,
            teamId: trajectory.team,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            page: input.page,
            limit: input.limit,
            sortAsc: input.sortAsc
        });
    }

    async subListing(input: AnalysisScopedRequest & {
        exposureId: string;
        timestep: number;
        subListingName: string;
        page?: number;
        limit?: number;
    }): Promise<GetSubListingOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        const analysis = await this.#requireOwnedAnalysis(input.analysisId, input.trajectoryId);

        return this.#plugins.getSubListing({
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            subListingName: input.subListingName,
            teamId: analysis.team,
            page: input.page,
            limit: input.limit
        });
    }

    async pluginExposureGLB(input: AnalysisScopedRequest & {
        exposureId: string;
        timestep: string;
        acceptEncoding?: string;
    }): Promise<GetPluginExposureGLBOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        const analysis = await this.#requireOwnedAnalysis(input.analysisId, input.trajectoryId);

        return this.#plugins.getPluginExposureGLB({
            teamId: analysis.team,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            exposureId: input.exposureId,
            timestep: input.timestep,
            acceptEncoding: input.acceptEncoding
        });
    }

    async analysisFrameLog(input: AnalysisScopedRequest & {
        timestep: number;
        afterCursor?: string;
    }): Promise<GetAnalysisFrameLogOutput>{
        await this.#access.assertReadable(input.trajectoryId, input.userId);
        const analysis = await this.#requireOwnedAnalysis(input.analysisId, input.trajectoryId);

        return analysisExecutionLogService.getFrameLog({
            teamId: analysis.team,
            analysisId: input.analysisId,
            trajectoryId: input.trajectoryId,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }

    async #hasTeamMembership(teamId: string, userId?: string): Promise<boolean>{
        return isTeamMember(teamId, userId);
    }

    /**
     * Guards against reading one trajectory's analysis through another's canvas
     * URL, and optionally against a plugin id that does not own that analysis.
     */
    async #requireOwnedAnalysis(analysisId: string, trajectoryId: string, pluginId?: string): Promise<AnalysisEntity>{
        const analysis = await AnalysisEntity.findOneBy({ id: analysisId });
        if(!analysis) throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');

        if(analysis.trajectory !== trajectoryId){
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                'Analysis does not belong to the requested trajectory'
            );
        }

        if(pluginId !== undefined && analysis.plugin !== pluginId){
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                'Analysis does not belong to the requested plugin'
            );
        }

        return analysis;
    }

    #toBootstrapTrajectory(trajectory: Trajectory, frames: TrajectoryFrame[]): PublicCanvasBootstrapTrajectoryView{
        return {
            _id: trajectory.id,
            name: trajectory.name,
            status: trajectory.status,
            isPublic: trajectory.isPublic,
            teamId: trajectory.team,
            analysisIds: [],
            frames: frames.map((frame) => ({
                timestep: frame.timestep,
                natoms: frame.natoms,
                simulationCell: (typeof frame.simulationCell === 'string'
                    ? frame.simulationCell
                    : frame.simulationCell?._id) ?? ''
            }))
        };
    }
}
